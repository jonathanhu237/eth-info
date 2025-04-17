import { addressInfoQueryOptions } from "@/lib/query-options";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AddressHeader } from "@/feat/address/address-header";
import { AddressOverview } from "@/feat/address/address-overview";
import { AddressMoreInfo } from "@/feat/address/address-more-info";

export const Route = createFileRoute("/_details-layout/address/$hash")({
  component: AddressDetailsComponent,
  loader: ({ context: { queryClient }, params: { hash } }) => {
    return queryClient.ensureQueryData(addressInfoQueryOptions(hash));
  },
});

function AddressDetailsComponent() {
  const { data: addressInfo } = useSuspenseQuery(
    addressInfoQueryOptions(Route.useParams().hash)
  );

  return (
    <div className="space-y-4">
      <AddressHeader addressInfo={addressInfo} />
      <div className="grid gap-4 grid-cols-2">
        <AddressOverview addressInfo={addressInfo} />
        <AddressMoreInfo addressInfo={addressInfo} />
      </div>
    </div>
  );
}
