import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AddressInfo } from "@/types/address-info";

interface Props {
  addressInfo: AddressInfo;
}

export const AddressOverview = ({ addressInfo }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>概览</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">地址:</span>
            <span className="font-mono text-sm break-all">
              {addressInfo.address}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">标准化地址:</span>
            <span className="font-mono text-sm break-all">
              {addressInfo.address_normalized}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">是否合约:</span>
            <span className="font-semibold">
              {addressInfo.is_contract ? "是" : "否"}
            </span>
          </div>

          {addressInfo.contract_creator && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">合约创建者:</span>
              <span className="font-mono text-sm break-all text-primary">
                {addressInfo.contract_creator}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">是否矿工:</span>
            <span className="font-semibold">
              {addressInfo.is_miner ? "是" : "否"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
