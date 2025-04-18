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
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import remarkGfm from "remark-gfm"; // 导入 remark-gfm
import { Components } from "react-markdown"; // 导入 Components type

type SelectedTxType = "external" | "internal"; // 直接使用字符串联合类型

// 模拟 SSE 流数据块 (放在组件外部)
const MOCK_AI_STREAM_DATA = [
  { type: "ai_content", content: "### 区块链地址分析报告 (Mock)\n\n" },
  { type: "ai_content", content: "分析地址：`{address}`\n\n" }, // 使用占位符
  {
    type: "ai_content",
    content:
      "| 特征         | 观察结果                   | 推测         |\n|--------------|--------------------------|--------------|\n",
  },
  {
    type: "ai_content",
    content: "| 交易频率     | 中等                     | 普通用户     |\n",
  },
  {
    type: "ai_content",
    content: "| 交互合约类型 | Uniswap, Aave            | DeFi 参与者  |\n",
  },
  {
    type: "ai_content",
    content: "| 大额交易     | 少量 (例如: 10 ETH 转入)  | 可能的早期投资 |\n",
  },
  {
    type: "ai_content",
    content: "\n**总结:** 该地址表现为一个活跃的 DeFi 用户。\n",
  },
  { type: "ai_end" }, // 结束信号
];

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

  // --- AI 总结 SSE 请求 或 Mock (由环境变量控制) ---
  useEffect(() => {
    // 读取环境变量
    const isMockEnabled = import.meta.env.VITE_USE_MOCK_AI === "true";
    console.log(
      `AI Mock Mode ${
        isMockEnabled ? "Enabled" : "Disabled"
      } by environment variable.`
    );

    setAiSummary(""); // 重置总结
    setIsAiLoading(true);
    setAiError(null);

    let intervalId: NodeJS.Timeout | null = null;
    let eventSource: EventSource | null = null;

    if (isMockEnabled) {
      // --- Mock 模式 ---
      console.log("Using Mock AI Summary for:", hash);
      let chunkIndex = 0;
      intervalId = setInterval(() => {
        if (chunkIndex >= MOCK_AI_STREAM_DATA.length) {
          clearInterval(intervalId!);
          setIsAiLoading(false);
          return;
        }

        const chunk = MOCK_AI_STREAM_DATA[chunkIndex];
        if (chunk.type === "ai_content" && typeof chunk.content === "string") {
          // 替换地址占位符
          const content = chunk.content.replace(
            "{address}",
            toChecksumAddress(hash)
          );
          setAiSummary((prev) => prev + content);
        } else if (chunk.type === "ai_end") {
          clearInterval(intervalId!);
          setIsAiLoading(false);
        }

        chunkIndex++;
      }, 150); // 每 150ms 发送一个数据块
    } else {
      // --- 真实 API 请求模式 ---
      console.log("Requesting Real AI Summary for:", hash);
      eventSource = new EventSource(`/api/ai/analyze/${hash.toLowerCase()}`);

      eventSource.onmessage = (event) => {
        console.log("SSE message received:", event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ai_end") {
            console.log("SSE analysis 'ai_end' message received.");
            setIsAiLoading(false);
            eventSource?.close(); // 收到结束信号，主动关闭
            return;
          }
          if (data.type === "ai_content") {
            setAiSummary((prev) => prev + data.content);
          }
        } catch (error) {
          console.error("Error parsing SSE message:", error);
          // setAiError("无法解析分析结果"); // 解析错误通常不直接暴露给用户
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE Error:", error);
        // 只有在从未收到内容时才认为是真错误 (如果 eventSource 存在)
        if (eventSource && aiSummary.trim() === "") {
          setAiError("加载 AI 分析时出错，请稍后重试。");
        }
        setIsAiLoading(false);
        eventSource?.close();
      };
    }

    // 清理函数
    return () => {
      if (intervalId) {
        console.log("Clearing Mock AI interval for:", hash);
        clearInterval(intervalId);
      }
      if (eventSource) {
        console.log("Closing SSE connection for:", hash);
        eventSource.close();
      }
      // 离开页面或切换模式时，确保加载状态关闭
      setIsAiLoading(false);
    };
  }, [hash]); // 只依赖 hash

  // --- 定义 Markdown 组件映射来处理表格和链接样式 ---
  const markdownComponents = useMemo<Partial<Components>>(
    () => ({
      table: ({ ...props }) => (
        <table
          className="w-full my-4 border-collapse border border-slate-400 dark:border-slate-500"
          {...props}
        />
      ),
      thead: ({ ...props }) => (
        <thead className="bg-slate-100 dark:bg-slate-800" {...props} />
      ),
      tbody: ({ ...props }) => <tbody {...props} />,
      tr: ({ ...props }) => (
        <tr
          className="border-b border-slate-200 dark:border-slate-700"
          {...props}
        />
      ),
      th: ({ ...props }) => (
        <th
          className="border border-slate-300 dark:border-slate-600 p-2 text-left font-semibold"
          {...props}
        />
      ),
      td: ({ ...props }) => (
        <td
          className="border border-slate-300 dark:border-slate-600 p-2 align-top"
          {...props}
        />
      ),
      a: ({ href, ...props }) => {
        // 如果是外部链接，使用普通 a 标签
        if (href && (href.startsWith("http") || href.startsWith("//"))) {
          return (
            <a
              href={href}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          );
        }
        // 如果看起来像一个地址（内部链接），尝试使用 Link 组件
        // 注意：这里假设所有非外部链接都是地址链接，可能需要根据实际情况调整
        const potentialHash = props.children;
        if (
          typeof potentialHash === "string" &&
          potentialHash.startsWith("0x")
        ) {
          try {
            // 尝试 checksum 转换，虽然 Link 的 to 不需要，但可以验证格式
            const checksumAddr = toChecksumAddress(potentialHash);
            return (
              <Link
                to="/address/$hash"
                params={{ hash: checksumAddr }}
                className="text-primary hover:underline"
                {...props}
              />
            );
          } catch {
            // 转换失败，当作普通文本或外部链接处理
            console.warn(
              "Markdown link looks like address but failed checksum:",
              potentialHash
            );
            return (
              <a
                href={href}
                className="text-primary hover:underline"
                {...props}
              />
            );
          }
        }
        // 其他内部链接（例如页内跳转 #）或无法识别的，使用普通 a
        return (
          <a href={href} className="text-primary hover:underline" {...props} />
        );
      },
    }),
    []
  );

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
      type: "target", // 设置类型
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
            type: "hop1", // 设置类型
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
            type: "hop1", // 设置类型 (如果缺失)
          });
          console.warn("Hop 1 node missing unexpectedly, adding:", hop1Address);
        }

        hop.second_hop_links.forEach((link) => {
          const hop2Address = toChecksumAddress(link.neighbor_address.address);
          if (hop2Address === hop1Address || hop2Address === targetChecksum)
            return;

          if (!nodes.has(hop2Address)) {
            nodes.set(hop2Address, {
              id: hop2Address,
              name: hop2Address,
              val: 2,
              type: "hop2", // 设置类型
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

  // --- 定义图例数据 ---
  const addressLegendItems = [
    { type: "target", label: "目标地址" }, // 使用 type
    { type: "hop1", label: "一跳邻居" }, // 使用 type
    { type: "hop2", label: "二跳邻居" }, // 使用 type
  ];

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
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents} // 使用新的映射
          >
            {aiSummary}
          </ReactMarkdown>
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
                legendItems={addressLegendItems} // 传递图例数据
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
