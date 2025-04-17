import {
  addressInfoQueryOptions,
  externalTxQueryOptions,
} from "@/lib/query-options";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AddressHeader } from "@/feat/address/address-header";
import { AddressOverview } from "@/feat/address/address-overview";
import { AddressMoreInfo } from "@/feat/address/address-more-info";
import { ExternalTransactionsTable } from "@/feat/address/external-transactions-table";
import { z } from "zod";

const addressSearchSchema = z.object({
  page: z.number().int().min(1).catch(1),
  pageSize: z.number().int().min(5).max(100).catch(10),
});

type AddressSearchParams = z.infer<typeof addressSearchSchema>;

export const Route = createFileRoute("/_details-layout/address/$hash")({
  validateSearch: addressSearchSchema,
  component: AddressDetailsComponent,
  loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
  loader: async ({
    context: { queryClient },
    params: { hash },
    deps: { page, pageSize },
  }) => {
    const addressInfoPromise = queryClient.ensureQueryData(
      addressInfoQueryOptions(hash)
    );
    const transactionsPromise = queryClient.ensureQueryData(
      externalTxQueryOptions({ address: hash, page: page, page_size: pageSize })
    );

    await Promise.all([addressInfoPromise, transactionsPromise]);
    return {};
  },
});

function AddressDetailsComponent() {
  const { hash } = Route.useParams();
  const { page, pageSize } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: addressInfo } = useSuspenseQuery(addressInfoQueryOptions(hash));

  const { data: transactionsData } = useSuspenseQuery(
    externalTxQueryOptions({ address: hash, page: page, page_size: pageSize })
  );

  const totalTransactions = transactionsData?.data?.total ?? 0;
  const pageCount = Math.ceil(totalTransactions / pageSize);

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev: AddressSearchParams): AddressSearchParams => ({
        ...prev,
        page: newPage,
      }),
      replace: true,
      params: { hash },
    });
  };

  return (
    <div className="space-y-4">
      <AddressHeader addressInfo={addressInfo} />
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AddressOverview addressInfo={addressInfo} />
        </div>
        <div className="lg:col-span-1">
          <AddressMoreInfo addressInfo={addressInfo} />
        </div>
      </div>
      <ExternalTransactionsTable
        data={transactionsData?.data?.transactions}
        pageCount={pageCount}
        currentPage={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        totalTransactions={totalTransactions}
      />
    </div>
  );
}
