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
import { useState, useMemo, useCallback } from "react";
import { BlockTxTable } from "@/feat/block/block-tx-table";
import {
  NeighborGraph,
  GraphNode,
  GraphLink,
} from "@/feat/graph/neighbor-graph";

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
  const blockTxPageSize = 10;

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
          } else if (apiNode.label === "Miner" && apiNode.properties.address) {
            const checksumAddr = toChecksumAddress(apiNode.properties.address);
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
    { type: "block", label: "区块" },
    { type: "address", label: "地址" },
    { type: "miner", label: "矿工" },
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
      {" "}
      {/* Add key={blockNumber} */}
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
                legendItems={blockLegendItems} // 传递图例数据
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
