import { transactionQueryOptions } from "@/lib/query-options";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toChecksumAddress } from "@/lib/utils";
import { ethers } from "ethers";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";

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
  const tx = txData?.data; // axios response data

  if (!tx) {
    return <div>交易信息加载失败或不存在。</div>;
  }

  // 格式化函数
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

  const checksumFrom = toChecksumAddress(tx.from);
  const checksumTo = toChecksumAddress(tx.to);

  return (
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
        <DetailItem label="金额" value={`${formatEth(tx.value)} ETH`} isMono />
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
  );
}

// 辅助组件用于渲染详情项
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
