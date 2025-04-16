import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddressInfo } from "@/types/address-info";
import { IconHomeLink, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { Tooltip } from "react-tooltip";

interface Props {
  addressInfo: AddressInfo;
}

export const AddressHeader = ({ addressInfo }: Props) => {
  const [copyAddressMessage, setCopyAddressMessage] = useState("复制地址");

  return (
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
  );
};
