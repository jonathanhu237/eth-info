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
import { useState, useMemo, useCallback } from "react";
import { TxInternalTxTable } from "@/feat/tx/tx-internal-tx-table";
import {
  NeighborGraph,
  GraphNode,
  GraphLink,
} from "@/feat/graph/neighbor-graph";

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
