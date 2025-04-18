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
} from "@/lib/query-options";
import {
  AddressExternalTxQuery,
  AddressInternalTxQuery,
} from "@/types/address-tx-query";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import {
  NeighborGraph,
  GraphNode,
  GraphLink,
} from "@/feat/graph/neighbor-graph";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toChecksumAddress } from "@/lib/utils";
import { ethers } from "ethers"; // 重新导入 ethers
import { ExternalNeighborInteractionContext } from "@/types/transaction"; // 重新导入类型

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

  const { data: addressInfo } = useSuspenseQuery(addressInfoQueryOptions(hash));

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
  console.log("Interactions Context for 2nd Hop Query:", interactionsContext);

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

  // --- 数据转换为图形格式 ...
  const graphData = useMemo(() => {
    // ... (graph data generation logic)
    // Ensure nodes Map usage is correct
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const targetChecksum = toChecksumAddress(hash);
    nodes.set(targetChecksum, {
      id: targetChecksum,
      name: targetChecksum,
      val: 8,
      color: "hsl(var(--primary))",
    });

    if (transactions) {
      transactions.forEach((tx) => {
        const from = toChecksumAddress(tx.from_address);
        const to = toChecksumAddress(tx.to_address);
        // Skip self-loops or invalid 'to'
        if (!to || from === to) return;
        const neighbor = from === targetChecksum ? to : from;
        if (neighbor === targetChecksum) return; // Should not happen if 'to' is checked, but safety first

        if (!nodes.has(neighbor)) {
          nodes.set(neighbor, {
            id: neighbor,
            name: neighbor,
            val: 4,
          });
        }
        links.push({
          source: targetChecksum,
          target: neighbor,
          label: `${ethers.formatEther(tx.value_raw)} ETH`,
        });
      });
    }

    if (neighborData) {
      neighborData.forEach((hop) => {
        const hop1Address = toChecksumAddress(hop.b_address_string);
        if (!nodes.has(hop1Address)) {
          nodes.set(hop1Address, {
            id: hop1Address,
            name: hop1Address,
            val: 4,
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
            });
          }
          links.push({
            source: hop1Address,
            target: hop2Address,
            label: `Tx: ${link.transaction.hash.substring(0, 8)}...`,
          });
        });
      });
    }
    console.log("Generated Graph Data:", {
      nodes: Array.from(nodes.values()),
      links,
    });
    return { nodes: Array.from(nodes.values()), links };
  }, [hash, transactions, neighborData]);

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
      <Card className="col-span-1 md:col-span-1 h-[400px]">
        <CardHeader>
          <CardTitle>AI 总结</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">即将推出...</p>
        </CardContent>
      </Card>

      {/* 第二行：邻居关系图卡片 */}
      <Card className="col-span-1 md:col-span-1 h-[500px] flex flex-col">
        {" "}
        {/* 保持 flex-col */}
        <CardHeader className="pb-2">
          <CardTitle>邻居关系图 (外部交易)</CardTitle>
        </CardHeader>
        <CardContent className="relative flex-1 p-0">
          {" "}
          {/* 保持 flex-1 */}
          {/* Loading/Error/Empty States (保持不变) */}
          {selectedTxType !== "external" && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
              请切换到外部交易查看关系图
            </div>
          )}
          {selectedTxType === "external" && externalTxQuery.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
              加载一跳邻居中...
            </div>
          )}
          {selectedTxType === "external" &&
            externalTxQuery.isSuccess &&
            interactionsContext.length === 0 &&
            !externalNeighborsQuery.isFetching && (
              <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                当前页面无外部交易可用于分析邻居
              </div>
            )}
          {selectedTxType === "external" &&
            externalTxQuery.isSuccess &&
            interactionsContext.length > 0 &&
            externalNeighborsQuery.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                加载二跳邻居中...
              </div>
            )}
          {selectedTxType === "external" && externalNeighborsQuery.isError && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-destructive p-4">
              加载二跳邻居失败
            </div>
          )}
          {/* Graph Rendering - NeighborGraph 内部会动态获取尺寸 */}
          {selectedTxType === "external" &&
            externalTxQuery.isSuccess &&
            graphData.nodes.length > 1 && (
              <NeighborGraph
                graphData={graphData}
                onNodeClick={handleGraphNodeClick}
                targetNodeId={toChecksumAddress(hash)}
              />
            )}
          {/* No substantial data state (保持不变) */}
          {selectedTxType === "external" &&
            externalTxQuery.isSuccess &&
            !externalNeighborsQuery.isLoading &&
            !externalNeighborsQuery.isError &&
            interactionsContext.length > 0 &&
            !neighborData?.length &&
            graphData.nodes.length > 1 && (
              <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                仅显示一跳邻居 (未找到相关的二跳邻居数据)
              </div>
            )}
          {selectedTxType === "external" &&
            externalTxQuery.isSuccess &&
            !externalNeighborsQuery.isLoading &&
            !externalNeighborsQuery.isError &&
            graphData.nodes.length <= 1 && (
              <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                未找到足够的邻居数据来生成图形
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
