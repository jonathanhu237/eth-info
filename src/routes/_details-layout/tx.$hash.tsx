import {
  transactionQueryOptions,
  txInternalTxQueryOptions,
  txNeighborsQueryOptions,
} from "@/lib/query-options";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toChecksumAddress } from "@/lib/utils";
import { ethers } from "ethers";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo, useCallback, useEffect } from "react";
import { TxInternalTxTable } from "@/feat/tx/tx-internal-tx-table";
import {
  NeighborGraph,
  GraphNode,
  GraphLink,
} from "@/feat/graph/neighbor-graph";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Components } from "react-markdown";

// Define colors and MOCK data (copied, consider extracting later)
// const TX_NODE_COLOR = ... // (These are not needed for AI summary)

const MOCK_AI_STREAM_DATA = [
  { type: "ai_content", content: "### 区块链交易分析报告 (Mock)\n\n" },
  { type: "ai_content", content: "分析交易：`{txHash}`\n\n" }, // Placeholder for tx hash
  {
    type: "ai_content",
    content:
      "| 特征         | 观察结果                   | 推测         |\n|--------------|--------------------------|--------------|\n",
  },
  {
    type: "ai_content",
    content: "| 交易金额     | 较大 (100+ ETH)           | 大户操作     |\n",
  },
  {
    type: "ai_content",
    content: "| 交互合约     | 未知代理合约             | 需进一步分析 |\n",
  },
  {
    type: "ai_content",
    content: "| Gas 消耗     | 显著高于普通转账         | 复杂调用     |\n",
  },
  {
    type: "ai_content",
    content: "\n**总结:** 该交易为一笔大额、复杂的合约交互。\n",
  },
  { type: "ai_end" },
];

export const Route = createFileRoute("/_details-layout/tx/$hash")({
  component: TransactionDetailsComponent,
  loader: async ({ context: { queryClient }, params: { hash } }) => {
    await queryClient.ensureQueryData(transactionQueryOptions(hash));
    return {};
  },
});

function TransactionDetailsComponent() {
  const { hash } = Route.useParams();
  const navigate = useNavigate();
  const { data: txData } = useSuspenseQuery(transactionQueryOptions(hash));
  const tx = txData?.data;

  const [internalTxCurrentPage, setInternalTxCurrentPage] = useState(1);
  const internalTxPageSize = 10;

  // Add AI Summary States
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Define graph click handler early
  const handleTxGraphNodeClick = useCallback(
    (node: GraphNode) => {
      // Check if the clicked node is an address (id doesn't start with 'tx:')
      if (node && node.id && !node.id.startsWith("tx:")) {
        console.log("Navigating to address:", node.id);
        navigate({ to: "/address/$hash", params: { hash: node.id } });
      } else {
        console.log("Clicked on non-address node or invalid node:", node);
      }
    },
    [navigate]
  );

  const internalTxQuery = useQuery({
    ...txInternalTxQueryOptions({
      hash: hash,
      offset: (internalTxCurrentPage - 1) * internalTxPageSize,
      limit: internalTxPageSize,
    }),
    enabled: !!tx,
  });

  const internalTransactions =
    internalTxQuery.data?.data?.internal_transactions;
  const totalInternalTransactions =
    internalTxQuery.data?.data?.total_count ?? 0;
  const isInternalTxLoading = internalTxQuery.isLoading;
  const isInternalTxFetching = internalTxQuery.isFetching;
  const isInternalTxError = internalTxQuery.isError;

  const internalTxPageCount = Math.ceil(
    totalInternalTransactions / internalTxPageSize
  );

  const handleInternalTxPageChange = (newPage: number) => {
    setInternalTxCurrentPage(newPage);
  };

  const formatEth = (value: string | number) => {
    try {
      return ethers.formatEther(String(value));
    } catch {
      return "N/A";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "yyyy-MM-dd HH:mm:ss (OOOO)", {
        locale: zhCN,
      });
    } catch {
      return "N/A";
    }
  };

  // --- AI 总结 SSE 请求 或 Mock (由环境变量控制) ---
  useEffect(() => {
    const isMockEnabled = import.meta.env.VITE_USE_MOCK_AI === "true";
    console.log(
      `Tx AI Mock Mode ${
        isMockEnabled ? "Enabled" : "Disabled"
      } by environment variable.`
    );

    setAiSummary("");
    setIsAiLoading(true);
    setAiError(null);

    let intervalId: NodeJS.Timeout | null = null;
    let eventSource: EventSource | null = null;

    if (isMockEnabled) {
      console.log("Using Mock Tx AI Summary for:", hash);
      let chunkIndex = 0;
      intervalId = setInterval(() => {
        if (chunkIndex >= MOCK_AI_STREAM_DATA.length) {
          clearInterval(intervalId!);
          setIsAiLoading(false);
          return;
        }
        const chunk = MOCK_AI_STREAM_DATA[chunkIndex];
        if (chunk.type === "ai_content" && typeof chunk.content === "string") {
          // Replace placeholder
          const content = chunk.content.replace("{txHash}", hash);
          setAiSummary((prev) => prev + content);
        } else if (chunk.type === "ai_end") {
          clearInterval(intervalId!);
          setIsAiLoading(false);
        }
        chunkIndex++;
      }, 150);
    } else {
      console.log("Requesting Real Tx AI Summary for:", hash);
      // Adjust endpoint for transaction analysis
      eventSource = new EventSource(
        `/api/ai/analyze/transaction/${hash.toLowerCase()}?int_page=${internalTxCurrentPage}&int_limit=${internalTxPageSize}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ai_end") {
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

      eventSource.onerror = (error) => {
        console.error("SSE Error:", error);
        if (eventSource && aiSummary.trim() === "") {
          setAiError("加载 AI 分析时出错，请稍后重试。");
        }
        setIsAiLoading(false);
        eventSource?.close();
      };
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (eventSource) eventSource.close();
      setIsAiLoading(false);
    };
  }, [hash]); // Depend on hash

  // --- 定义 Markdown 组件映射 (Copied, consider extracting) ---
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
                className="text-primary hover:underline"
                {...props}
              />
            );
          } catch {
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
        return (
          <a href={href} className="text-primary hover:underline" {...props} />
        );
      },
    }),
    []
  );

  // --- Fetch Transaction Neighbors ---
  const txNeighborsQuery = useQuery({
    ...txNeighborsQueryOptions({
      tx_hash: hash,
      // Use default limits/params for now
    }),
    enabled: !!tx, // Enable only if the main tx data is loaded
  });
  const txNeighborApiData = txNeighborsQuery.data?.data;
  const isTxNeighborLoading = txNeighborsQuery.isLoading;
  const isTxNeighborError = txNeighborsQuery.isError;
  const txNeighborError = txNeighborsQuery.error;

  // --- Transform Tx Neighbor Data for Graph ---
  const txGraphData = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    const links = new Map<string, GraphLink>();
    const targetNodeId = `tx:${hash}`; // Unique ID for the tx node

    // 1. Add Target Transaction Node
    if (!nodes.has(targetNodeId)) {
      nodes.set(targetNodeId, {
        id: targetNodeId,
        name: `Tx: ${hash.substring(0, 8)}...`,
        val: 8, // Central node value
        type: "tx", // 设置类型
      });
    }

    // Check if txNeighborApiData is an array and has elements
    if (Array.isArray(txNeighborApiData) && txNeighborApiData.length > 0) {
      // Iterate over each context in the response array
      txNeighborApiData.forEach((txContext) => {
        if (!txContext?.b_address_string) return;

        const hop1Address = toChecksumAddress(txContext.b_address_string);
        const hop1NodeId = hop1Address;

        // 2. Add First Hop Node (b_address_string)
        if (!nodes.has(hop1NodeId)) {
          nodes.set(hop1NodeId, {
            id: hop1NodeId,
            name: hop1Address,
            val: 4, // 1st hop value
            type: "hop1", // 设置类型
          });
        }

        // 3. Link Target Tx -> First Hop Address (avoid duplicates)
        const linkIdTxToHop1 = `${targetNodeId}->${hop1NodeId}`;
        if (!links.has(linkIdTxToHop1)) {
          links.set(linkIdTxToHop1, {
            source: targetNodeId,
            target: hop1NodeId,
            label: "interacts",
          }); // Add simple label
        }

        // 4. Add Second Hop Nodes and Links
        if (Array.isArray(txContext.second_hop_links)) {
          txContext.second_hop_links.forEach((link) => {
            if (!link?.neighbor_address?.address) return;

            const hop2Address = toChecksumAddress(
              link.neighbor_address.address
            );
            const hop2NodeId = hop2Address;

            // Avoid linking node to itself or back to the target Tx
            if (hop2Address === hop1Address) return;

            // Add Second Hop Node
            if (!nodes.has(hop2NodeId)) {
              nodes.set(hop2NodeId, {
                id: hop2NodeId,
                name: hop2Address,
                val: 2, // 2nd hop value
                type: "hop2", // 设置类型
              });
            }

            // Link First Hop Address -> Second Hop Address (avoid duplicates)
            const linkIdHop1ToHop2 = `${hop1NodeId}->${hop2NodeId}`;
            if (!links.has(linkIdHop1ToHop2)) {
              links.set(linkIdHop1ToHop2, {
                source: hop1NodeId,
                target: hop2NodeId,
                label: `Tx: ${
                  link.transaction.hash
                    ? link.transaction.hash.substring(0, 8) + "..."
                    : "N/A"
                }`,
              });
            }
          });
        }
      });
    }

    return {
      nodes: Array.from(nodes.values()),
      links: Array.from(links.values()),
      targetNodeId,
    };
  }, [txNeighborApiData, hash]);

  // --- 定义图例数据 ---
  const txLegendItems = [
    { type: "tx", label: "交易" },
    { type: "hop1", label: "一跳邻居" },
    { type: "hop2", label: "二跳邻居" },
  ];

  if (!tx) {
    return <div>交易信息加载失败或不存在。</div>;
  }

  const checksumFrom = toChecksumAddress(tx.from);
  const checksumTo = toChecksumAddress(tx.to);

  return (
    <div className="space-y-6">
      {/* Add AI Summary Card */}
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
            components={markdownComponents}
          >
            {aiSummary}
          </ReactMarkdown>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>交易详情</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailItem label="交易哈希" value={tx.hash} isMono />
          <DetailItem label="区块号">
            <Link
              to="/block/$blockNumber"
              params={{ blockNumber: String(tx.blockNumber) }}
              className="text-primary hover:underline"
            >
              {tx.blockNumber}
            </Link>
          </DetailItem>
          <DetailItem label="时间戳" value={formatDate(tx.datetime)} />
          <DetailItem label="发送方">
            <Link
              to="/address/$hash"
              params={{ hash: checksumFrom }}
              className="text-primary hover:underline font-mono"
            >
              {checksumFrom}
            </Link>
          </DetailItem>
          <DetailItem label="接收方">
            <Link
              to="/address/$hash"
              params={{ hash: checksumTo }}
              className="text-primary hover:underline font-mono"
            >
              {checksumTo}
            </Link>
          </DetailItem>
          <DetailItem
            label="金额"
            value={`${formatEth(tx.value)} ETH`}
            isMono
          />
          <DetailItem label="Gas 限制" value={String(tx.gas)} isMono />
          <DetailItem
            label="Gas 价格"
            value={`${ethers.formatUnits(tx.gasPrice, "gwei")} Gwei`}
            isMono
          />
          <DetailItem
            label="交易费"
            value={`${Number(tx.gasCost_eth).toFixed(12)} ETH`}
            isMono
          />
          <DetailItem label="Nonce" value={String(tx.nonce)} isMono />
          <DetailItem label="类型" value={String(tx.type)} />
          <DetailItem label="Chain ID" value={String(tx.chainId)} />
          <DetailItem label="Input 数据">
            <Textarea readOnly value={tx.input} className="resize-none" />
          </DetailItem>
        </CardContent>
      </Card>

      {/* Transaction Neighbor Graph Card */}
      <Card>
        <CardHeader>
          <CardTitle>交易相关邻居图</CardTitle>
        </CardHeader>
        <CardContent className="relative h-[400px] p-0">
          {" "}
          {/* Fixed height */}
          {isTxNeighborLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
              加载交易邻居图中...
            </div>
          )}
          {isTxNeighborError && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-destructive p-4">
              加载交易邻居图失败: {txNeighborError?.message}
            </div>
          )}
          {!isTxNeighborLoading &&
            !isTxNeighborError &&
            txGraphData.nodes.length <= 1 && ( // Check if only target node exists
              <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                未找到相关的邻居数据。
              </div>
            )}
          {!isTxNeighborLoading &&
            !isTxNeighborError &&
            txGraphData.nodes.length > 1 && (
              <NeighborGraph
                graphData={{
                  nodes: txGraphData.nodes,
                  links: txGraphData.links,
                }}
                targetNodeId={txGraphData.targetNodeId}
                onNodeClick={handleTxGraphNodeClick}
                legendItems={txLegendItems} // 传递图例数据
              />
            )}
        </CardContent>
      </Card>

      <div className="relative min-h-[200px]">
        {isInternalTxLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            正在加载内部交易...
          </div>
        ) : isInternalTxError ? (
          <div className="text-center p-4 text-destructive">
            加载内部交易数据时出错。
          </div>
        ) : (
          <TxInternalTxTable
            data={internalTransactions}
            pageCount={internalTxPageCount}
            currentPage={internalTxCurrentPage}
            pageSize={internalTxPageSize}
            onPageChange={handleInternalTxPageChange}
            totalTransactions={totalInternalTransactions}
            isFetching={isInternalTxFetching}
          />
        )}
      </div>
    </div>
  );
}

interface DetailItemProps {
  label: string;
  value?: string | number | React.ReactNode;
  isMono?: boolean;
  children?: React.ReactNode;
}

function DetailItem({ label, value, isMono, children }: DetailItemProps) {
  return (
    <div className="grid grid-cols-4 gap-2 text-sm">
      <span className="text-muted-foreground font-medium col-span-1">
        {label}:
      </span>
      <span className={`col-span-3 break-all ${isMono ? "font-mono" : ""}`}>
        {children ?? value}
      </span>
    </div>
  );
}
