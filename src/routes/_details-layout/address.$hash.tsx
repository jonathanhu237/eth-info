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
  useSuspenseQuery,
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";
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
  {
    type: "ai_content",
    content: "分析地址：[`{address}`](/address/{address})\n\n",
  }, // 使用占位符
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
  // 使用独立的分页状态
  const [externalCurrentPage, setExternalCurrentPage] = useState(1);
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  // const [currentPage, setCurrentPage] = useState(1); // 移除旧状态
  const pageSize = 10; // PageSize 保持不变

  // AI 总结状态保持不变
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const { data: addressInfo } = useSuspenseQuery(addressInfoQueryOptions(hash));

  // --- AI 总结 (依赖当前选择的类型和页面) ---
  useEffect(() => {
    const isMockEnabled = import.meta.env.VITE_USE_MOCK_AI === "true";
    const currentPageForAI =
      selectedTxType === "external" ? externalCurrentPage : internalCurrentPage;

    console.log(
      `AI Mock Mode ${
        isMockEnabled ? "Enabled" : "Disabled"
      }, Type: ${selectedTxType}, Page: ${currentPageForAI}`
    );

    setAiSummary("");
    setIsAiLoading(true);
    setAiError(null);

    let intervalId: NodeJS.Timeout | null = null;
    let eventSource: EventSource | null = null;

    if (isMockEnabled) {
      // ... Mock 逻辑 (需要确保占位符和数据适合通用或按类型调整) ...
      // 简单起见，暂时保持通用 Mock 不变
      console.log(
        "Using Mock AI Summary for:",
        hash,
        selectedTxType,
        currentPageForAI
      );
      let chunkIndex = 0;
      intervalId = setInterval(() => {
        // ... (Mock stream logic as before) ...
        if (chunkIndex >= MOCK_AI_STREAM_DATA.length) {
          /* ... */ return;
        }
        const chunk = MOCK_AI_STREAM_DATA[chunkIndex];
        if (chunk.type === "ai_content" && typeof chunk.content === "string") {
          const content = chunk.content.replace(
            "{address}",
            toChecksumAddress(hash)
          );
          setAiSummary((prev) => prev + content);
        } else if (chunk.type === "ai_end") {
          /* ... */
        }
        chunkIndex++;
      }, 150);
    } else {
      const apiUrl = `/api/ai/analyze/${hash.toLowerCase()}?ext_page=${externalCurrentPage}&ext_limit=${pageSize}&int_page=${internalCurrentPage}&int_limit=${pageSize}`;
      console.log("Requesting Real AI Summary from:", apiUrl);
      eventSource = new EventSource(apiUrl);
      // 处理 SSE 消息
      eventSource.onmessage = (event) => {
        console.log("SSE message received:", event.data); // 添加日志
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ai_end") {
            console.log("SSE analysis 'ai_end' message received.");
            setIsAiLoading(false);
            eventSource?.close();
            return;
          }
          if (data.type === "ai_content") {
            setAiSummary((prev) => prev + data.content);
          }
        } catch (error) {
          console.error("Error parsing SSE message:", error);
        }
      };
      // 处理 SSE 错误
      eventSource.onerror = (error) => {
        console.error("SSE Error:", error); // 添加日志
        if (eventSource && aiSummary.trim() === "") {
          setAiError("加载 AI 分析时出错，请稍后重试。");
        }
        setIsAiLoading(false);
        eventSource?.close();
      };
    }

    return () => {
      // ... 清理函数 (保持不变) ...
      if (intervalId) clearInterval(intervalId);
      if (eventSource) eventSource.close();
      setIsAiLoading(false);
    };
    // 依赖项包含两种分页状态和选择的类型
  }, [
    hash,
    selectedTxType,
    externalCurrentPage,
    internalCurrentPage,
    pageSize,
  ]);

  // --- Markdown 组件映射 (尝试添加 underline-offset) ---
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
        // 定义基础样式，包含 hover 和 offset
        const linkClasses = "text-primary hover:underline underline-offset-4";

        // 外部链接
        if (href && (href.startsWith("http") || href.startsWith("//"))) {
          return (
            <a
              href={href}
              className={linkClasses} // 应用样式
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          );
        }
        // 内部地址链接
        const potentialHash = props.children;
        if (
          typeof potentialHash === "string" &&
          potentialHash.startsWith("0x")
        ) {
          try {
            const checksumAddr = toChecksumAddress(potentialHash);
            return (
              <Link
                to="/address/$hash"
                params={{ hash: checksumAddr }}
                className={linkClasses} // 应用样式
                {...props}
              />
            );
          } catch {
            console.warn(
              "Markdown link looks like address but failed checksum:",
              potentialHash
            );
            // 失败时也应用基础链接样式
            return (
              <a
                href={href}
                className={linkClasses} // 应用样式
                {...props}
              />
            );
          }
        }
        // 其他链接 (如 #hash)
        return (
          <a href={href} className={linkClasses} {...props} /> // 应用样式
        );
      },
    }),
    []
  );

  // --- 外部交易查询 (使用 externalCurrentPage) ---
  const externalTxQueryWithKeepData = useQuery({
    ...addressExternalTxQueryOptions({
      address: hash,
      page: externalCurrentPage,
      page_size: pageSize,
    }),
    placeholderData: keepPreviousData,
  });
  const externalTransactions =
    externalTxQueryWithKeepData.data?.data?.transactions;
  const totalExternalTransactions =
    externalTxQueryWithKeepData.data?.data?.total ?? 0;
  const externalTxPageCount = Math.ceil(totalExternalTransactions / pageSize);

  // --- 内部交易查询 (使用 internalCurrentPage) ---
  const internalTxQueryWithKeepData = useQuery({
    ...addressInternalTxQueryOptions({
      address: hash,
      page: internalCurrentPage,
      page_size: pageSize,
    }),
    placeholderData: keepPreviousData,
  });
  const internalTransactions =
    internalTxQueryWithKeepData.data?.data?.transactions;
  const totalInternalTransactions =
    internalTxQueryWithKeepData.data?.data?.total ?? 0;
  const internalTxPageCount = Math.ceil(totalInternalTransactions / pageSize);

  // --- 构建外部交易邻居查询 Context (依赖 externalTransactions) ---
  const externalInteractionsContext = useMemo<
    ExternalNeighborInteractionContext[]
  >(() => {
    if (!externalTransactions) return [];
    // --- Actual mapping logic ---
    return externalTransactions
      .map((tx) => {
        const from = toChecksumAddress(tx.from_address);
        const to = toChecksumAddress(tx.to_address);
        if (!to || from === to) return null;
        const neighbor = from === toChecksumAddress(hash) ? to : from;
        if (neighbor === toChecksumAddress(hash)) return null;
        return {
          b_address: neighbor.toLowerCase(),
          t1_block_number: tx.block_number,
        };
      })
      .filter((ctx): ctx is ExternalNeighborInteractionContext => ctx !== null);
  }, [externalTransactions, hash]);

  // --- 构建内部交易邻居查询 Context (依赖 internalTransactions) ---
  const internalInteractionsContext = useMemo<
    ExternalNeighborInteractionContext[]
  >(() => {
    if (!internalTransactions) return [];
    // --- Actual mapping logic ---
    return internalTransactions
      .map((tx) => {
        const from = toChecksumAddress(tx.from_address);
        const to = toChecksumAddress(tx.to_address);
        if (!to || from === to) return null;
        const neighbor = from === toChecksumAddress(hash) ? to : from;
        if (neighbor === toChecksumAddress(hash)) return null;
        return {
          b_address: neighbor.toLowerCase(),
          t1_block_number: tx.block_number,
        };
      })
      .filter((ctx): ctx is ExternalNeighborInteractionContext => ctx !== null);
  }, [internalTransactions, hash]);

  // --- 外部二跳邻居查询 (依赖 externalInteractionsContext) ---
  const externalNeighborsQuery = useQuery({
    ...externalNeighborsQueryOptions({
      target_address: hash.toLowerCase(),
      interactions_context: externalInteractionsContext,
      base_hop2_limit: 10, // Keep existing params
      max_hop2_limit: 50,
      busy_threshold: 1000,
      block_window: 6,
    }),
    enabled:
      externalTxQueryWithKeepData.isSuccess &&
      externalInteractionsContext.length > 0, // Use the query with keepPreviousData
  });
  const externalNeighborData = externalNeighborsQuery.data?.data;

  // --- 内部二跳邻居查询 (依赖 internalInteractionsContext) ---
  const internalNeighborsQuery = useQuery({
    ...internalNeighborsQueryOptions({
      target_address: hash.toLowerCase(),
      interactions_context: internalInteractionsContext,
      base_hop2_limit: 10, // Keep existing params
      max_hop2_limit: 50,
      busy_threshold: 1000,
      block_window: 6,
    }),
    enabled:
      internalTxQueryWithKeepData.isSuccess &&
      internalInteractionsContext.length > 0, // Use the query with keepPreviousData
  });
  const internalNeighborData = internalNeighborsQuery.data?.data;

  // --- 计算外部图数据 ---
  const externalGraphData = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const targetChecksum = toChecksumAddress(hash);
    nodes.set(targetChecksum, {
      id: targetChecksum,
      name: targetChecksum,
      val: 8,
      type: "target",
    });

    // External First Hop
    if (externalTransactions) {
      externalTransactions.forEach((tx) => {
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
            type: "hop1",
          });
        }
        links.push({
          source: targetChecksum,
          target: neighbor,
          label: `${ethers.formatEther(tx.value_raw)} ETH`,
        });
      });
    }
    // External Second Hop
    if (externalNeighborData) {
      externalNeighborData.forEach((hop) => {
        const hop1Address = toChecksumAddress(hop.b_address_string);
        // Ensure hop1 node exists (might be added above or need adding now if tx list was empty but neighbors found? unlikely but safe)
        if (!nodes.has(hop1Address) && hop1Address !== targetChecksum) {
          nodes.set(hop1Address, {
            id: hop1Address,
            name: hop1Address,
            val: 4,
            type: "hop1",
          });
          console.warn("External Hop 1 node missing, adding:", hop1Address);
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
              type: "hop2",
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
    return { nodes: Array.from(nodes.values()), links };
  }, [hash, externalTransactions, externalNeighborData]);

  // --- 计算内部图数据 ---
  const internalGraphData = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const targetChecksum = toChecksumAddress(hash);
    nodes.set(targetChecksum, {
      id: targetChecksum,
      name: targetChecksum,
      val: 8,
      type: "target",
    });

    // Internal First Hop
    if (internalTransactions) {
      internalTransactions.forEach((tx) => {
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
            type: "hop1",
          });
        }
        // --- 修复 BigInt 错误 ---
        // 使用 value_raw (原始 Wei 值字符串) 进行比较和格式化
        const label =
          tx.value_raw && BigInt(tx.value_raw) > 0 // 使用 value_raw 判断
            ? `${ethers.formatEther(tx.value_raw)} ETH` // 使用 value_raw 格式化
            : `Call`;
        links.push({ source: targetChecksum, target: neighbor, label: label });
      });
    }
    // Internal Second Hop
    if (internalNeighborData) {
      internalNeighborData.forEach((hop) => {
        const hop1Address = toChecksumAddress(hop.b_address_string);
        if (!nodes.has(hop1Address) && hop1Address !== targetChecksum) {
          nodes.set(hop1Address, {
            id: hop1Address,
            name: hop1Address,
            val: 4,
            type: "hop1",
          });
          console.warn("Internal Hop 1 node missing, adding:", hop1Address);
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
              type: "hop2",
            });
          }
          // Label might be different for internal 2nd hop? Adapt if necessary
          links.push({
            source: hop1Address,
            target: hop2Address,
            label: `Call: ${
              link.transaction.hash
                ? link.transaction.hash.substring(0, 8) + "..."
                : "N/A"
            }`,
          });
        });
      });
    }
    return { nodes: Array.from(nodes.values()), links };
  }, [hash, internalTransactions, internalNeighborData]);

  // --- 更新图例数据以包含颜色 ---
  const addressLegendItems = [
    { type: "target", label: "目标地址", color: "var(--chart-1)" },
    { type: "hop1", label: "一跳邻居", color: "var(--chart-2)" },
    { type: "hop2", label: "二跳邻居", color: "var(--chart-3)" },
  ];

  // --- 节点点击处理 (保持不变) ---
  const handleGraphNodeClick = useCallback(
    (node: GraphNode) => {
      if (node && node.id) {
        console.log("Navigating to:", node.id);
        navigate({ to: "/address/$hash", params: { hash: node.id } });
      }
    },
    [navigate]
  );

  // --- 分页处理 ---
  const handleExternalPageChange = (newPage: number) => {
    setExternalCurrentPage(newPage);
  };
  const handleInternalPageChange = (newPage: number) => {
    setInternalCurrentPage(newPage);
  };

  // --- 交易类型切换处理 (只切换类型，不重置页码) ---
  const handleTxTypeChange = (newTxType: SelectedTxType) => {
    setSelectedTxType(newTxType);
  };

  return (
    <div key={hash} className="space-y-4">
      <AddressHeader addressInfo={addressInfo} />
      {/* AI 总结卡片 (保持不变) */}
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
            components={markdownComponents} // 确保传递了修改后的 components
          >
            {aiSummary}
          </ReactMarkdown>
        </CardContent>
      </Card>

      {/* 第二行：邻居关系图卡片 (Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* External Graph Card */}
        <Card className="h-[500px] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle>邻居关系图 (外部交易)</CardTitle>
          </CardHeader>
          <CardContent className="relative flex-1 p-0">
            {/* Loading/Error/Empty States for External Graph */}
            {externalTxQueryWithKeepData.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                加载外部一跳...
              </div>
            )}
            {externalTxQueryWithKeepData.isSuccess &&
              externalInteractionsContext.length > 0 &&
              externalNeighborsQuery.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  加载外部二跳...
                </div>
              )}
            {externalNeighborsQuery.isError && (
              <div className="absolute inset-0 flex items-center justify-center text-destructive">
                加载外部二跳失败
              </div>
            )}
            {externalTxQueryWithKeepData.isSuccess &&
              !externalNeighborsQuery.isLoading &&
              !externalNeighborsQuery.isError &&
              externalGraphData.nodes.length <= 1 && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  无外部邻居数据
                </div>
              )}

            {/* Render External Graph */}
            {!externalTxQueryWithKeepData.isLoading &&
              !externalNeighborsQuery.isError &&
              externalGraphData.nodes.length > 1 && (
                <NeighborGraph
                  graphData={externalGraphData}
                  onNodeClick={handleGraphNodeClick}
                  targetNodeId={toChecksumAddress(hash)}
                  legendItems={addressLegendItems}
                />
              )}
          </CardContent>
        </Card>

        {/* Internal Graph Card */}
        <Card className="h-[500px] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle>邻居关系图 (内部交易)</CardTitle>
          </CardHeader>
          <CardContent className="relative flex-1 p-0">
            {/* Loading/Error/Empty States for Internal Graph */}
            {internalTxQueryWithKeepData.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                加载内部一跳...
              </div>
            )}
            {internalTxQueryWithKeepData.isSuccess &&
              internalInteractionsContext.length > 0 &&
              internalNeighborsQuery.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  加载内部二跳...
                </div>
              )}
            {internalNeighborsQuery.isError && (
              <div className="absolute inset-0 flex items-center justify-center text-destructive">
                加载内部二跳失败
              </div>
            )}
            {internalTxQueryWithKeepData.isSuccess &&
              !internalNeighborsQuery.isLoading &&
              !internalNeighborsQuery.isError &&
              internalGraphData.nodes.length <= 1 && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  无内部邻居数据
                </div>
              )}

            {/* Render Internal Graph */}
            {!internalTxQueryWithKeepData.isLoading &&
              !internalNeighborsQuery.isError &&
              internalGraphData.nodes.length > 1 && (
                <NeighborGraph
                  graphData={internalGraphData}
                  onNodeClick={handleGraphNodeClick}
                  targetNodeId={toChecksumAddress(hash)}
                  legendItems={addressLegendItems}
                />
              )}
          </CardContent>
        </Card>
      </div>

      {/* 第三行：概览 和 更多信息 (保持不变) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <AddressOverview addressInfo={addressInfo} />
        <AddressMoreInfo addressInfo={addressInfo} />
      </div>

      {/* 切换按钮 (保持不变) */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium cursor-pointer ${
            selectedTxType === "external"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTxTypeChange("external")}
        >
          外部交易 ({addressInfo.external_transactions_count})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium cursor-pointer ${
            selectedTxType === "internal"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTxTypeChange("internal")}
        >
          内部交易 ({addressInfo.internal_transactions_count})
        </button>
      </div>

      {/* 条件渲染交易表格 (根据 selectedTxType 和对应分页状态) */}
      <div className="relative min-h-[200px]">
        {selectedTxType === "external" &&
          // External Table Logic
          (externalTxQueryWithKeepData.isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              加载外部交易...
            </div>
          ) : externalTxQueryWithKeepData.isError ? (
            <div className="text-center p-4 text-destructive">
              加载外部交易出错
            </div>
          ) : externalTransactions && externalTransactions.length > 0 ? (
            <ExternalTransactionsTable
              data={externalTransactions}
              pageCount={externalTxPageCount}
              currentPage={externalCurrentPage} // 使用外部页码
              pageSize={pageSize}
              onPageChange={handleExternalPageChange} // 使用外部处理器
              totalTransactions={totalExternalTransactions}
              isFetching={externalTxQueryWithKeepData.isFetching}
            />
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              无外部交易记录
            </div>
          ))}
        {selectedTxType === "internal" &&
          // Internal Table Logic
          (internalTxQueryWithKeepData.isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              加载内部交易...
            </div>
          ) : internalTxQueryWithKeepData.isError ? (
            <div className="text-center p-4 text-destructive">
              加载内部交易出错
            </div>
          ) : internalTransactions && internalTransactions.length > 0 ? (
            <InternalTransactionsTable
              data={internalTransactions}
              pageCount={internalTxPageCount}
              currentPage={internalCurrentPage} // 使用内部页码
              pageSize={pageSize}
              onPageChange={handleInternalPageChange} // 使用内部处理器
              totalTransactions={totalInternalTransactions}
              isFetching={internalTxQueryWithKeepData.isFetching}
            />
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              无内部交易记录
            </div>
          ))}
      </div>
    </div>
  );
}
