import { randomAddressQueryOptions } from "@/lib/query-options";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AddressHeader } from "@/feat/address/address-header";
import { AddressOverview } from "@/feat/address/address-overview";

export const Route = createFileRoute("/random-address")({
  component: RouteComponent,
  loader: ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(randomAddressQueryOptions());
  },
});

function RouteComponent() {
  const addressInfoQuery = useSuspenseQuery(randomAddressQueryOptions());
  const addressInfo = addressInfoQuery.data;

  return (
    <div className="max-w-7xl mx-auto py-8 flex flex-col gap-6">
      {/* 头部：地址信息 */}
      <AddressHeader addressInfo={addressInfo} />

      {/* 地址概览 */}
      <div className="grid grid-cols-2 gap-6">
        <AddressOverview addressInfo={addressInfo} />
      </div>
    </div>
  );
}
