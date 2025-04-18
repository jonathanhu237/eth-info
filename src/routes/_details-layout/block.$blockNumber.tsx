import {
  getBlockInfoQueryOptions,
  getBlockTxQueryOptions,
  blockGraphContentQueryOptions,
} from "@/lib/query-options";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  useParams,
  useNavigate,
} from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toChecksumAddress } from "@/lib/utils";
import { ethers } from "ethers";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState, useMemo, useCallback, useEffect } from "react";
import { BlockTxTable } from "@/feat/block/block-tx-table";
import {
  NeighborGraph,
  GraphNode,
  GraphLink,
} from "@/feat/graph/neighbor-graph";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Components } from "react-markdown";

// Define colors and MOCK data (copied from address page, consider extracting later)
// const BLOCK_NODE_COLOR = "hsl(var(--chart-1))"; // 移除未使用的常量

const MOCK_AI_STREAM_DATA = [
  { type: "ai_content", content: "### 区块链区块分析报告 (Mock)\n\n" },
  { type: "ai_content", content: "分析区块：`{blockNumber}`\n\n" }, // Placeholder for block
  {
    type: "ai_content",
    content:
      "| 特征         | 观察结果                   | 推测         |\n|--------------|--------------------------|--------------|\n",
  },
  {
    type: "ai_content",
    content: "| 交易数量     | 中等                     | 正常活动     |\n",
  },
  {
    type: "ai_content",
    content: "| Gas 使用率   | 较高                     | 可能拥堵     |\n",
  },
  {
    type: "ai_content",
    content: "| 特殊交易     | 包含 MEV 相关交易         | 机器人活动   |\n",
  },
  {
    type: "ai_content",
    content: "\n**总结:** 该区块显示出正常的网络活动，包含一些 MEV 行为。\n",
  },
  { type: "ai_end" },
];

export const Route = createFileRoute("/_details-layout/block/$blockNumber")({
  component: BlockDetailsComponent,
  loader: async ({ context: { queryClient }, params: { blockNumber } }) => {
    // 从参数中获取 blockNumber (字符串类型)，转换为 number
    const blockNum = parseInt(blockNumber, 10);
    if (isNaN(blockNum)) {
      // 处理无效的区块号参数，例如抛出错误或重定向
      console.error("Invalid block number parameter:", blockNumber);
      // 可以在这里抛出 notFound() 或其他错误
      return; // 或者返回空对象，让组件处理错误状态
    }
    await queryClient.ensureQueryData(getBlockInfoQueryOptions(blockNum));
    return {};
  },
});

function BlockDetailsComponent() {
  // Hooks must be called at the top level
  const params = useParams({ from: Route.id });
  const navigate = useNavigate();
  const blockNumberParam = params.blockNumber; // Get param as string first
  const [blockTxCurrentPage, setBlockTxCurrentPage] = useState(1);
  const blockTxPageSize = 10; // Page size is fixed

  // Add AI Summary States
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Perform parsing after getting the param
  const blockNumber = parseInt(blockNumberParam, 10);

  // Define graph click handler early
  const handleBlockGraphNodeClick = useCallback(
    (node: GraphNode) => {
      // Check if the clicked node is an address node (id does not contain ':')
      if (node && node.id && !node.id.includes(":")) {
        console.log("Navigating to address:", node.id);
        navigate({ to: "/address/$hash", params: { hash: node.id } });
      }
    },
    [navigate]
  );

  // Fetch block info, use a placeholder queryKey if blockNumber is NaN initially
  // This query will be disabled if blockNumber is NaN
  const { data: blockInfoData } = useSuspenseQuery({
    ...getBlockInfoQueryOptions(isNaN(blockNumber) ? -1 : blockNumber), // Use placeholder or actual number
  });

  // Fetch block transactions
  const blockTxQuery = useQuery({
    ...getBlockTxQueryOptions({
      block_number: isNaN(blockNumber) ? -1 : blockNumber,
      offset: (blockTxCurrentPage - 1) * blockTxPageSize,
      limit: blockTxPageSize,
    }),
    // Enable only if block number is valid AND block info has potentially loaded
    enabled: !isNaN(blockNumber), // Enable if block number is valid
  });

  // Fetch block graph content
  const blockGraphQuery = useQuery({
    ...blockGraphContentQueryOptions(blockNumber),
    enabled: !isNaN(blockNumber),
  });
  const blockGraphApiData = blockGraphQuery.data?.data;
  const isBlockGraphLoading = blockGraphQuery.isLoading;
  const isBlockGraphError = blockGraphQuery.isError;
  const blockGraphError = blockGraphQuery.error;

  // --- AI 总结 SSE 请求 或 Mock (由环境变量控制) ---
  useEffect(() => {
    const isMockEnabled = import.meta.env.VITE_USE_MOCK_AI === "true";
    console.log(
      `Block AI Mock Mode ${
        isMockEnabled ? "Enabled" : "Disabled"
      } by environment variable.`
    );

    setAiSummary("");
    setIsAiLoading(true);
    setAiError(null);

    let intervalId: NodeJS.Timeout | null = null;
    let eventSource: EventSource | null = null;

    if (isMockEnabled) {
      console.log("Using Mock Block AI Summary for:", blockNumber);
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
          const content = chunk.content.replace(
            "{blockNumber}",
            String(blockNumber)
          );
          setAiSummary((prev) => prev + content);
        } else if (chunk.type === "ai_end") {
          clearInterval(intervalId!);
          setIsAiLoading(false);
        }
        chunkIndex++;
      }, 150);
    } else {
      console.log("Requesting Real Block AI Summary for:", blockNumber);
      // Adjust endpoint for block analysis
      eventSource = new EventSource(`/api/ai/analyze/block/${blockNumber}`);

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
  }, [blockNumber]); // Depend on blockNumber

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

  // --- Graph Data Transformation (MUST be called before early returns) ---
  const blockInfo = blockInfoData?.data; // 获取 blockInfo
  const checksumMiner = blockInfo ? toChecksumAddress(blockInfo.miner) : ""; // 获取 checksumMiner

  const blockGraphData = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    let targetNodeId = "";

    // 确保 blockInfo 和 blockGraphApiData 都存在
    if (blockGraphApiData && blockInfo) {
      // --- 1. Process Nodes ---
      if (blockGraphApiData.nodes) {
        blockGraphApiData.nodes.forEach((apiNode) => {
          let nodeId: string;
          let nodeName: string;
          let nodeVal: number;
          let nodeType: string;

          if (apiNode.label === "Block" && apiNode.properties.blockNumber) {
            nodeId = `block:${apiNode.properties.blockNumber}`;
            nodeName = `Block #${apiNode.properties.blockNumber}`;
            nodeVal = 8;
            nodeType = "block";
            targetNodeId = nodeId;
          } else if (
            apiNode.label === "Address" &&
            apiNode.properties.address
          ) {
            const checksumAddr = toChecksumAddress(apiNode.properties.address);
            nodeId = checksumAddr;
            nodeName = checksumAddr;
            nodeVal = 4;
            nodeType = "address";
          } else if (
            apiNode.label === "Miner" &&
            apiNode.properties.minerAddress
          ) {
            const checksumAddr = toChecksumAddress(
              apiNode.properties.minerAddress
            );
            nodeId = checksumAddr;
            nodeName = checksumAddr;
            nodeVal = 4;
            nodeType = "miner";
          } else {
            console.warn("Skipping unknown or incomplete node:", apiNode);
            return;
          }

          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              name: nodeName,
              val: nodeVal,
              type: nodeType,
            });
          }
        });
      }

      // --- 2. Process Links from API ---
      if (blockGraphApiData.links) {
        blockGraphApiData.links.forEach((apiLink) => {
          if (!apiLink.source || !apiLink.target) return; // Need source and target

          const sourceAddr = toChecksumAddress(apiLink.source);
          const targetAddr = toChecksumAddress(apiLink.target);

          // Ensure source and target nodes exist from the nodes list
          if (nodes.has(sourceAddr) && nodes.has(targetAddr)) {
            links.push({
              source: sourceAddr,
              target: targetAddr,
              label: `${apiLink.type} (${
                apiLink.properties.hash
                  ? apiLink.properties.hash.substring(0, 6) + "..."
                  : "N/A"
              })`,
            });
          }
        });
      }

      // --- 3. Add Block -> Miner Link ---
      const blockNodeId = `block:${blockNumber}`; // 构造 Block 节点 ID
      const minerNodeId = checksumMiner; // Miner 节点 ID 就是 checksumMiner

      if (nodes.has(blockNodeId) && nodes.has(minerNodeId)) {
        links.push({
          source: blockNodeId,
          target: minerNodeId,
          label: "MINED_BY", // 定义连接类型标签
        });
      }
    }

    return { nodes: Array.from(nodes.values()), links, targetNodeId };
  }, [blockGraphApiData, blockInfo, blockNumber, checksumMiner]);

  // --- 定义图例数据 ---
  const blockLegendItems = [
    { type: "block", label: "区块", color: "var(--chart-1)" },
    { type: "address", label: "地址", color: "var(--chart-2)" },
    { type: "miner", label: "矿工", color: "var(--chart-3)" },
  ];

  // ---- Now perform checks and early returns ----
  if (isNaN(blockNumber)) {
    return <div>无效的区块号。</div>;
  }

  // Check if blockInfo query itself had an error (though Suspense might handle this)
  // We might rely on the loader error boundary more here
  // 将 blockInfo 的获取移到 useMemo 之前
  // if (isBlockInfoError || !blockInfoData?.data) {
  //   return <div>区块信息加载失败或不存在。</div>;
  // }

  // const blockInfo = blockInfoData.data;

  // Get derived data after confirming blockInfo exists
  // 确保 blockInfo 存在才进行后续操作
  if (!blockInfo) {
    // 理论上 Suspense 会处理，但加一层保险
    return <div>区块信息仍在加载或加载失败...</div>;
  }

  const blockTransactions = blockTxQuery.data?.data?.transactions;
  const totalBlockTransactions = blockTxQuery.data?.data?.total_count ?? 0;
  const isBlockTxLoading = blockTxQuery.isLoading;
  const isBlockTxFetching = blockTxQuery.isFetching;
  const isBlockTxError = blockTxQuery.isError;
  const blockTxPageCount = Math.ceil(totalBlockTransactions / blockTxPageSize);

  // ---- Handlers and Formatters ----
  const handleBlockTxPageChange = (newPage: number) => {
    setBlockTxCurrentPage(newPage);
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

  return (
    <div key={blockNumber} className="space-y-6">
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
          <CardTitle>区块 #{blockNumber} 详情</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailItem label="区块哈希" value={blockInfo.hash} isMono />
          <DetailItem label="父哈希" value={blockInfo.parentHash} isMono />
          <DetailItem label="时间戳" value={formatDate(blockInfo.datetime)} />
          <DetailItem label="矿工">
            <Link
              to="/address/$hash"
              params={{ hash: checksumMiner }}
              className="text-primary hover:underline font-mono"
            >
              {checksumMiner}
            </Link>
          </DetailItem>
          <DetailItem label="交易数量" value={totalBlockTransactions} />
          <DetailItem label="Gas 限制" value={blockInfo.gasLimit} />
          <DetailItem label="Gas 使用" value={blockInfo.gasUsed} />
          <DetailItem
            label="基础费率"
            value={`${ethers.formatUnits(
              blockInfo.baseFeePerGas,
              "gwei"
            )} Gwei`}
            isMono
          />
          <DetailItem label="Nonce" value={blockInfo.nonce} isMono />
          <DetailItem label="难度" value={blockInfo.difficulty} />
          <DetailItem label="大小" value={`${blockInfo.size} bytes`} />
        </CardContent>
      </Card>
      {/* Block Graph Card */}
      <Card>
        <CardHeader>
          <CardTitle>区块内容图</CardTitle>
        </CardHeader>
        <CardContent className="relative h-[400px] p-0">
          {" "}
          {/* Fixed height for graph */}
          {isBlockGraphLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
              加载区块内容图中...
            </div>
          )}
          {isBlockGraphError && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-destructive p-4">
              加载区块内容图失败: {blockGraphError?.message}
            </div>
          )}
          {!isBlockGraphLoading &&
            !isBlockGraphError &&
            blockGraphData.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4">
                未找到区块内容图数据。
              </div>
            )}
          {!isBlockGraphLoading &&
            !isBlockGraphError &&
            blockGraphData.nodes.length > 0 && (
              <NeighborGraph
                graphData={{
                  nodes: blockGraphData.nodes,
                  links: blockGraphData.links,
                }}
                targetNodeId={blockGraphData.targetNodeId}
                onNodeClick={handleBlockGraphNodeClick}
                legendItems={blockLegendItems} // 传递更新后的图例
              />
            )}
        </CardContent>
      </Card>
      {/* 渲染区块交易表格 */}
      <div className="relative min-h-[200px]">
        {isBlockTxLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            正在加载区块交易...
          </div>
        ) : isBlockTxError ? (
          <div className="text-center p-4 text-destructive">
            加载区块交易数据时出错。
          </div>
        ) : (
          <BlockTxTable
            data={blockTransactions}
            pageCount={blockTxPageCount}
            currentPage={blockTxCurrentPage}
            pageSize={blockTxPageSize}
            onPageChange={handleBlockTxPageChange}
            totalTransactions={totalBlockTransactions}
            isFetching={isBlockTxFetching}
          />
        )}
      </div>
    </div>
  );
}

// --- DetailItem 组件 (可复用或放在共享位置) ---
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
