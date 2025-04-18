import { AddressHeader } from "@/feat/address/address-header";
import { AddressMoreInfo } from "@/feat/address/address-more-info";
import { AddressOverview } from "@/feat/address/address-overview";
import { ExternalTransactionsTable } from "@/feat/address/external-transactions-table";
import { InternalTransactionsTable } from "@/feat/address/internal-transactions-table";
import {
  addressExternalTxQueryOptions,
  addressInfoQueryOptions,
  addressInternalTxQueryOptions,
  externalNeighborsQueryOptions,
  internalNeighborsQueryOptions,
} from "@/lib/query-options";
import {
  AddressExternalTxQuery,
  AddressInternalTxQuery,
} from "@/types/address-tx-query";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  NeighborGraph,
  GraphNode,
  GraphLink,
} from "@/feat/graph/neighbor-graph";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toChecksumAddress } from "@/lib/utils";
import { ethers } from "ethers"; // 重新导入 ethers
import { ExternalNeighborInteractionContext } from "@/types/transaction"; // 重新导入类型
import ReactMarkdown from "react-markdown"; // 只导入 ReactMarkdown

type SelectedTxType = "external" | "internal"; // 直接使用字符串联合类型

export const Route = createFileRoute("/_details-layout/address/$hash")({
  component: AddressDetailsComponent,
  // 移除 page, pageSize from loaderDeps
  loaderDeps: () => ({}), // No deps from search needed
  loader: async ({ context: { queryClient }, params: { hash } }) => {
    // Loader 只加载地址信息
    await queryClient.ensureQueryData(addressInfoQueryOptions(hash));
    return {};
  },
});

function AddressDetailsComponent() {
  const { hash } = Route.useParams();
  const navigate = useNavigate();
  const [selectedTxType, setSelectedTxType] =
    useState<SelectedTxType>("external");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  // 新增 AI 总结状态
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const { data: addressInfo } = useSuspenseQuery(addressInfoQueryOptions(hash));

  // --- AI 总结 SSE 请求 ---
  useEffect(() => {
    setAiSummary(""); // 重置总结
    setIsAiLoading(true);
    setAiError(null);

    const eventSource = new EventSource(
      `/api/ai/analyze/${hash.toLowerCase()}`
    );

    eventSource.onmessage = (event) => {
      console.log("SSE message received:", event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ai_content") {
          setAiSummary((prev) => prev + data.content);
        }
        // 你可以根据后端是否发送特定的结束信号来设置 setIsAiLoading(false)
        // 例如: if (data.type === 'analysis_complete') { setIsAiLoading(false); }
        // 如果没有明确的结束信号，可以在 onError 或长时间无消息后设置
      } catch (error) {
        console.error("Error parsing SSE message:", error);
        // 如果解析错误也认为加载结束或者设置错误
        // setAiError("无法解析分析结果");
        // setIsAiLoading(false);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
      setAiError("加载 AI 分析时出错，请稍后重试。");
      setIsAiLoading(false);
      eventSource.close(); // 出错时关闭连接
    };

    // 清理函数：组件卸载或 hash 变化时关闭连接
    return () => {
      console.log("Closing SSE connection for:", hash);
      eventSource.close();
      setIsAiLoading(false); // 确保在清理时停止加载状态
    };
  }, [hash]); // 依赖于 hash

  // --- 外部交易查询 (第一跳数据来源) ---
  const externalTxQuery = useQuery({
    ...addressExternalTxQueryOptions({
      address: hash,
      page: currentPage, // Use local state
      page_size: pageSize, // Use local state
    }),
    enabled: selectedTxType === "external",
  });

  const externalTransactions = externalTxQuery.data?.data?.transactions;
  console.log(
    "External Transactions (1st Hop Data Source):",
    externalTransactions
  );

  // 3. 使用 useQuery 获取内部交易 (使用本地分页状态)
  const internalTxQuery = useQuery({
    ...addressInternalTxQueryOptions({
      address: hash,
      page: currentPage, // Use local state
      page_size: pageSize, // Use local state
    }),
    enabled: selectedTxType === "internal",
  });

  // 4. 根据 selectedTxType 确定当前要显示的数据和状态
  const currentQuery =
    selectedTxType === "external" ? externalTxQuery : internalTxQuery;
  const transactions = currentQuery.data?.data?.transactions;
  const totalTransactions = currentQuery.data?.data?.total;
  const isLoading = currentQuery.isLoading;
  const isFetching = currentQuery.isFetching; // 用于显示分页加载状态

  const internalTransactions = internalTxQuery.data?.data?.transactions; // Get internal txs
  console.log(
    "Internal Transactions (1st Hop Data Source):",
    internalTransactions
  );

  // 使用当前类型的 totalTransactions 计算 pageCount
  const pageCount = Math.ceil((totalTransactions ?? 0) / pageSize);

  // 更新本地分页状态
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // 处理交易类型切换 (更新本地状态)
  const handleTxTypeChange = (newTxType: SelectedTxType) => {
    setSelectedTxType(newTxType);
    setCurrentPage(1); // 切换类型时，重置分页到第一页
  };

  // --- 构建二跳查询的 context ...
  const interactionsContext = useMemo<
    ExternalNeighborInteractionContext[]
  >(() => {
    if (!externalTransactions) return [];
    return externalTransactions
      .map((tx) => {
        const from = toChecksumAddress(tx.from_address);
        const to = toChecksumAddress(tx.to_address);
        if (!to || from === to) return null; // 过滤掉无效或自环交易
        const neighbor = from === toChecksumAddress(hash) ? to : from;
        if (neighbor === toChecksumAddress(hash)) return null; // 过滤掉指向自己的 (理论上不会发生)
        return {
          b_address: neighbor.toLowerCase(), // 邻居地址转为小写
          t1_block_number: tx.block_number,
        };
      })
      .filter((ctx): ctx is ExternalNeighborInteractionContext => ctx !== null); // 类型守卫过滤 null
  }, [externalTransactions, hash]);
  console.log(
    "External Interactions Context for 2nd Hop Query:",
    interactionsContext
  );

  // --- 构建内部交易二跳查询的 context ---
  const internalInteractionsContext = useMemo<
    ExternalNeighborInteractionContext[] // Reuse type for now
  >(() => {
    if (!internalTransactions) return [];
    return internalTransactions
      .map((tx) => {
        const from = toChecksumAddress(tx.from_address);
        const to = toChecksumAddress(tx.to_address);
        if (!to || from === to) return null;
        const neighbor = from === toChecksumAddress(hash) ? to : from;
        if (neighbor === toChecksumAddress(hash)) return null;
        return {
          b_address: neighbor.toLowerCase(), // Ensure lowercase
          t1_block_number: tx.block_number,
        };
      })
      .filter((ctx): ctx is ExternalNeighborInteractionContext => ctx !== null);
  }, [internalTransactions, hash]);
  console.log(
    "Internal Interactions Context for 2nd Hop Query:",
    internalInteractionsContext
  );

  // --- 二跳邻居查询 ---
  const isNeighborQueryEnabled =
    selectedTxType === "external" &&
    externalTxQuery.isSuccess &&
    interactionsContext.length > 0;
  console.log("Is Neighbor Query Enabled?", isNeighborQueryEnabled); // Keep this log

  const externalNeighborsQuery = useQuery({
    ...externalNeighborsQueryOptions({
      target_address: hash.toLowerCase(), // target_address 转为小写
      interactions_context: interactionsContext, // context 中的 b_address 已经是小写
      base_hop2_limit: 10,
      max_hop2_limit: 50, // Default
      busy_threshold: 1000,
      block_window: 6,
    }),
    enabled: isNeighborQueryEnabled,
  });
  const neighborData = externalNeighborsQuery.data?.data;
  console.log("Neighbor Query Status:", externalNeighborsQuery.status); // Keep this log
  console.log(
    "Neighbor Data (2nd Hop Result - Increased Limit):",
    neighborData
  ); // Update log message

  // --- 外部二跳邻居查询 ---
  const isExternalNeighborQueryEnabled =
    selectedTxType === "external" &&
    externalTxQuery.isSuccess &&
    interactionsContext.length > 0;
  console.log(
    "Is External Neighbor Query Enabled?",
    isExternalNeighborQueryEnabled
  );

  const externalNeighborsQueryHook = useQuery({
    ...externalNeighborsQueryOptions({
      target_address: hash.toLowerCase(),
      interactions_context: interactionsContext,
      base_hop2_limit: 10,
      max_hop2_limit: 50,
      busy_threshold: 1000,
      block_window: 6,
    }),
    enabled: isExternalNeighborQueryEnabled,
  });
  const externalNeighborData = externalNeighborsQueryHook.data?.data;
  console.log(
    "External Neighbor Query Status:",
    externalNeighborsQueryHook.status
  );
  console.log("External Neighbor Data:", externalNeighborData);

  // --- 内部二跳邻居查询 ---
  const isInternalNeighborQueryEnabled =
    selectedTxType === "internal" &&
    internalTxQuery.isSuccess &&
    internalInteractionsContext.length > 0;
  console.log(
    "Is Internal Neighbor Query Enabled?",
    isInternalNeighborQueryEnabled
  );

  const internalNeighborsQuery = useQuery({
    ...internalNeighborsQueryOptions({
      target_address: hash.toLowerCase(),
      interactions_context: internalInteractionsContext,
      base_hop2_limit: 10,
      max_hop2_limit: 50,
      busy_threshold: 1000,
      block_window: 6,
    }),
    enabled: isInternalNeighborQueryEnabled,
  });
  const internalNeighborData = internalNeighborsQuery.data?.data;
  console.log("Internal Neighbor Query Status:", internalNeighborsQuery.status);
  console.log("Internal Neighbor Data:", internalNeighborData);

  // --- 数据转换为图形格式 (根据 selectedTxType 动态选择数据源) ---
  const graphData = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const targetChecksum = toChecksumAddress(hash);

    // Determine data sources based on selected type
    const firstHopTxs =
      selectedTxType === "external"
        ? externalTransactions
        : internalTransactions;
    const secondHopData =
      selectedTxType === "external"
        ? externalNeighborData
        : internalNeighborData;

    // Target Node
    nodes.set(targetChecksum, {
      id: targetChecksum,
      name: targetChecksum,
      val: 8,
      color: "hsl(var(--primary))",
    });

    // First Hop Nodes & Links
    if (firstHopTxs) {
      firstHopTxs.forEach((tx) => {
        const from = toChecksumAddress(tx.from_address);
        const to = toChecksumAddress(tx.to_address);
        if (!to || from === to) return;
        const neighbor = from === targetChecksum ? to : from;
        if (neighbor === targetChecksum) return;

        if (!nodes.has(neighbor)) {
          nodes.set(neighbor, {
            id: neighbor,
            name: neighbor,
            val: 4,
            // Color handled by NeighborGraph component
          });
        }
        links.push({
          source: targetChecksum,
          target: neighbor,
          label: `${ethers.formatEther(tx.value_raw)} ETH`, // TODO: Adjust label for internal tx if needed
        });
      });
    }

    // Second Hop Nodes & Links
    if (secondHopData) {
      secondHopData.forEach((hop) => {
        const hop1Address = toChecksumAddress(hop.b_address_string);
        if (!nodes.has(hop1Address)) {
          nodes.set(hop1Address, {
            id: hop1Address,
            name: hop1Address,
            val: 4,
            // Color handled by NeighborGraph component
          });
        }
        hop.second_hop_links.forEach((link) => {
          const hop2Address = toChecksumAddress(link.neighbor_address.address);
          // Avoid linking node to itself and linking back to target
          if (hop2Address === hop1Address || hop2Address === targetChecksum)
            return;

          if (!nodes.has(hop2Address)) {
            nodes.set(hop2Address, {
              id: hop2Address,
              name: hop2Address,
              val: 2,
              // Color handled by NeighborGraph component
            });
          }
          links.push({
            source: hop1Address,
            target: hop2Address,
            label: `Tx: ${
              link.transaction.hash
                ? link.transaction.hash.substring(0, 8) + "..."
                : "N/A"
            }`,
          });
        });
      });
    }
    console.log("Generated Graph Data:", {
      nodes: Array.from(nodes.values()),
      links,
    });
    return { nodes: Array.from(nodes.values()), links };
  }, [
    hash,
    selectedTxType,
    externalTransactions,
    internalTransactions,
    externalNeighborData,
    internalNeighborData,
  ]); // Add dependencies

  const handleGraphNodeClick = useCallback(
    (node: GraphNode) => {
      if (node && node.id) {
        // 确保 node 和 id 存在
        console.log("Navigating to:", node.id);
        navigate({ to: "/address/$hash", params: { hash: node.id } });
      }
    },
    [navigate]
  );

  return (
    <div key={hash} className="space-y-4">
      <AddressHeader addressInfo={addressInfo} />

      {/* 第一行：AI 总结卡片 */}
      <Card className="col-span-1 md:col-span-1 min-h-[200px]">
        <CardHeader>
          <CardTitle>AI 总结</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
          {isAiLoading && aiSummary === "" && (
            <p className="text-muted-foreground">正在分析中，请稍候...</p>
          )}
          {aiError && <p className="text-destructive">{aiError}</p>}
          {!isAiLoading && !aiError && aiSummary === "" && (
            <p className="text-muted-foreground">暂无 AI 分析结果。</p>
          )}
          <ReactMarkdown>{aiSummary}</ReactMarkdown>
        </CardContent>
      </Card>

      {/* 第二行：邻居关系图卡片 */}
      <Card className="col-span-1 md:col-span-1 h-[500px] flex flex-col">
        {" "}
        {/* 保持 flex-col */}
        <CardHeader className="pb-2">
          <CardTitle>
            邻居关系图 ({selectedTxType === "external" ? "外部" : "内部"}交易)
          </CardTitle>
        </CardHeader>
        <CardContent className="relative flex-1 p-0">
          {" "}
          {/* 保持 flex-1 */}
          {/* Loading/Error/Empty States (Adapt based on selectedTxType) */}
          {/* --- External States --- */}
          {selectedTxType === "external" && (
            <>
              {externalTxQuery.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                  加载外部一跳邻居中...
                </div>
              )}
              {externalTxQuery.isSuccess &&
                interactionsContext.length === 0 &&
                !externalNeighborsQueryHook.isFetching && (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                    当前页面无外部交易可用于分析邻居
                  </div>
                )}
              {externalTxQuery.isSuccess &&
                interactionsContext.length > 0 &&
                externalNeighborsQueryHook.isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                    加载外部二跳邻居中...
                  </div>
                )}
              {externalNeighborsQueryHook.isError && (
                <div className="absolute inset-0 flex items-center justify-center text-center text-destructive p-4">
                  加载外部二跳邻居失败:{" "}
                  {externalNeighborsQueryHook.error.message}
                </div>
              )}
              {/* No substantial external data state */}
              {externalTxQuery.isSuccess &&
                !externalNeighborsQueryHook.isLoading &&
                !externalNeighborsQueryHook.isError &&
                interactionsContext.length > 0 &&
                !externalNeighborData?.length &&
                graphData.nodes.length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                    仅显示一跳邻居 (未找到相关的外部二跳邻居数据)
                  </div>
                )}
            </>
          )}
          {/* --- Internal States --- */}
          {selectedTxType === "internal" && (
            <>
              {internalTxQuery.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                  加载内部一跳邻居中...
                </div>
              )}
              {internalTxQuery.isSuccess &&
                internalInteractionsContext.length === 0 &&
                !internalNeighborsQuery.isFetching && (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                    当前页面无内部交易可用于分析邻居
                  </div>
                )}
              {internalTxQuery.isSuccess &&
                internalInteractionsContext.length > 0 &&
                internalNeighborsQuery.isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                    加载内部二跳邻居中...
                  </div>
                )}
              {internalNeighborsQuery.isError && (
                <div className="absolute inset-0 flex items-center justify-center text-center text-destructive p-4">
                  加载内部二跳邻居失败: {internalNeighborsQuery.error.message}
                </div>
              )}
              {/* No substantial internal data state */}
              {internalTxQuery.isSuccess &&
                !internalNeighborsQuery.isLoading &&
                !internalNeighborsQuery.isError &&
                internalInteractionsContext.length > 0 &&
                !internalNeighborData?.length &&
                graphData.nodes.length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                    仅显示一跳邻居 (未找到相关的内部二跳邻居数据)
                  </div>
                )}
            </>
          )}
          {/* --- Common States (No data / Graph display) --- */}
          {/* Graph Rendering - Renders if data is available for the selected type */}
          {((selectedTxType === "external" && externalTxQuery.isSuccess) ||
            (selectedTxType === "internal" && internalTxQuery.isSuccess)) &&
            graphData.nodes.length > 1 && (
              <NeighborGraph
                graphData={graphData} // graphData is now dynamic
                onNodeClick={handleGraphNodeClick}
                targetNodeId={toChecksumAddress(hash)}
              />
            )}
          {/* No graph data available for selected type (after loading & no errors) */}
          {((selectedTxType === "external" &&
            externalTxQuery.isSuccess &&
            !externalNeighborsQueryHook.isLoading &&
            !externalNeighborsQueryHook.isError) ||
            (selectedTxType === "internal" &&
              internalTxQuery.isSuccess &&
              !internalNeighborsQuery.isLoading &&
              !internalNeighborsQuery.isError)) &&
            graphData.nodes.length <= 1 && (
              <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                未找到足够的邻居数据来生成图形 (
                {selectedTxType === "external" ? "外部" : "内部"})
              </div>
            )}
        </CardContent>
      </Card>

      {/* 第三行：概览 和 更多信息 (使用 Grid) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <AddressOverview addressInfo={addressInfo} />
        <AddressMoreInfo addressInfo={addressInfo} />
      </div>

      {/* 切换按钮 (保持不变) */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium cursor-pointer ${
            selectedTxType === "external" // 使用本地状态
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTxTypeChange("external")}
        >
          外部交易 ({addressInfo.external_transactions_count})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium cursor-pointer ${
            selectedTxType === "internal" // 使用本地状态
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTxTypeChange("internal")}
        >
          内部交易 ({addressInfo.internal_transactions_count})
        </button>
      </div>

      {/* 条件渲染交易表格 + 处理加载状态 */}
      <div className="relative min-h-[200px]">
        {" "}
        {/* Container for positioning loading state */}
        {isLoading ? (
          // 1. Initial Loading State
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            正在加载...
          </div>
        ) : currentQuery.isError ? (
          // 2. Error State
          <div className="text-center p-4 text-destructive">
            加载交易数据时出错。
          </div>
        ) : transactions && transactions.length > 0 ? (
          // 3. Data Loaded and Available State
          <>
            {selectedTxType === "external" && (
              <ExternalTransactionsTable
                data={transactions as AddressExternalTxQuery["transactions"]}
                pageCount={pageCount}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                totalTransactions={totalTransactions ?? 0}
                isFetching={isFetching} // Pass fetching state
              />
            )}
            {selectedTxType === "internal" && (
              <InternalTransactionsTable
                data={transactions as AddressInternalTxQuery["transactions"]}
                pageCount={pageCount}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                totalTransactions={totalTransactions ?? 0}
                isFetching={isFetching} // Pass fetching state
              />
            )}
          </>
        ) : (
          // 4. No Results State (after loading, no error)
          <div className="text-center p-4 text-muted-foreground">
            无交易记录。
          </div>
        )}
      </div>
    </div>
  );
}
