import { randomAddressQueryOptions } from "@/lib/query-options";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { IconHomeLink, IconCopy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "react-tooltip";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/random-address")({
  component: RouteComponent,
  loader: ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(randomAddressQueryOptions());
  },
});

function RouteComponent() {
  const addressInfoQuery = useSuspenseQuery(randomAddressQueryOptions());
  const addressInfo = addressInfoQuery.data;

  const [copyAddressMessage, setCopyAddressMessage] = useState("复制地址");

  return (
    <div className="max-w-7xl mx-auto py-8 flex flex-col gap-6">
      {/* 头部：地址信息 */}
      <Card>
        <CardContent className="flex items-center gap-2">
          {/* 地址图标 */}
          <IconHomeLink className="h-5 w-5 text-primary" />
          {/* 地址信息 */}
          <h1 className="text-md font-semibold">地址</h1>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm break-all">
              {addressInfo.address}
            </span>
            <Button
              variant="ghost"
              size="icon"
              data-tooltip-id="copy-address"
              className="cursor-pointer"
              onClick={() => {
                navigator.clipboard.writeText(addressInfo.address);
                setCopyAddressMessage("复制成功");
              }}
            >
              <IconCopy className="h-5 w-5" />
            </Button>
            <Tooltip
              id="copy-address"
              place="top"
              afterHide={() => {
                setCopyAddressMessage("复制地址");
              }}
              disableStyleInjection={true}
              className="bg-primary text-primary-foreground text-xs px-3 py-2 rounded-md"
            >
              {copyAddressMessage}
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* 地址概览 */}
      <div className="grid grid-cols-2 gap-6">
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

        {/* 区块信息 */}
        {addressInfo.minor_info && (
          <div className="bg-card text-card-foreground rounded-lg shadow">
            <div className="border-border border-b px-6 py-4">
              <h2 className="font-semibold">矿工信息</h2>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">已挖掘区块数:</span>
                  <span className="font-semibold">
                    {addressInfo.minor_info.blocks_mined}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">首次出现区块:</span>
                  <span className="font-semibold text-primary">
                    {addressInfo.minor_info.first_seen_block}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">最后出现区块:</span>
                  <span className="font-semibold text-primary">
                    {addressInfo.minor_info.last_seen_block}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">首次出现时间:</span>
                  <span className="font-semibold">
                    {addressInfo.minor_info.first_seen_date}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">最后出现时间:</span>
                  <span className="font-semibold">
                    {addressInfo.minor_info.last_seen_date}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 交易选项卡 */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">外部交易</TabsTrigger>
          <TabsTrigger value="internal-transactions">内部交易</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions"></TabsContent>
      </Tabs>
    </div>
  );
}
