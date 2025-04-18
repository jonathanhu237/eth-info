import {
  transactionQueryOptions,
  txInternalTxQueryOptions,
} from "@/lib/query-options";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toChecksumAddress } from "@/lib/utils";
import { ethers } from "ethers";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { TxInternalTxTable } from "@/feat/tx/tx-internal-tx-table";

export const Route = createFileRoute("/_details-layout/tx/$hash")({
  component: TransactionDetailsComponent,
  loader: async ({ context: { queryClient }, params: { hash } }) => {
    await queryClient.ensureQueryData(transactionQueryOptions(hash));
    return {};
  },
});

function TransactionDetailsComponent() {
  const { hash } = Route.useParams();
  const { data: txData } = useSuspenseQuery(transactionQueryOptions(hash));
  const tx = txData?.data;

  const [internalTxCurrentPage, setInternalTxCurrentPage] = useState(1);
  const internalTxPageSize = 10;

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
