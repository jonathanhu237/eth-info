import { addressInfoQueryOptions } from "@/lib/query-options";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AddressHeader } from "@/feat/address/address-header";
import { AddressOverview } from "@/feat/address/address-overview";
import { AddressMoreInfo } from "@/feat/address/address-more-info";
import { ExternalTransactionsTable } from "@/feat/address/external-transactions-table";

export const Route = createFileRoute("/_details-layout/address/$hash")({
  component: AddressDetailsComponent,
  loader: ({ context: { queryClient }, params: { hash } }) => {
    queryClient.ensureQueryData(addressInfoQueryOptions(hash));
    return null;
  },
});

function AddressDetailsComponent() {
  const { hash } = Route.useParams();
  const { data: addressInfo } = useSuspenseQuery(addressInfoQueryOptions(hash));

  return (
    <div className="space-y-4">
      <AddressHeader addressInfo={addressInfo} />
      <div className="grid gap-4 grid-cols-2">
        <AddressOverview addressInfo={addressInfo} />
        <AddressMoreInfo addressInfo={addressInfo} />
      </div>
      <ExternalTransactionsTable address={hash} />
    </div>
  );
}
