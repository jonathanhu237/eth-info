import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressInfo } from "@/types/address-info";

interface Props {
  addressInfo: AddressInfo;
}

// 格式化数字，例如 1000 -> 1,000
const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num);
};

export const AddressMoreInfo = ({ addressInfo }: Props) => {
  const notableIdentifier =
    addressInfo.name || addressInfo.symbol || addressInfo.label;

  return (
    <Card>
      <CardHeader>
        <CardTitle>更多信息</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 显示名称/符号/标签（如果存在） */}
        {notableIdentifier && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">名称/标签:</span>
            <span className="font-semibold break-all">{notableIdentifier}</span>
          </div>
        )}

        {/* 交易计数 */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">外部交易数:</span>
          <span className="font-semibold">
            {formatNumber(addressInfo.external_transactions_count ?? 0)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">内部交易数:</span>
          <span className="font-semibold">
            {formatNumber(addressInfo.internal_transactions_count ?? 0)}
          </span>
        </div>

        {/* 相关标签列表 */}
        {addressInfo.labels && addressInfo.labels.length > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground block mb-2">相关标签:</span>
            <div className="flex flex-wrap gap-2">
              {addressInfo.labels.map((label, index) => (
                <Badge key={index} variant="secondary">
                  {label.nameTag || label.label}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
