import { AddressHeader } from "@/feat/address/address-header";
import { AddressMoreInfo } from "@/feat/address/address-more-info";
import { AddressOverview } from "@/feat/address/address-overview";
import { ExternalTransactionsTable } from "@/feat/address/external-transactions-table";
import { InternalTransactionsTable } from "@/feat/address/internal-transactions-table";
import {
  addressExternalTxQueryOptions,
  addressInfoQueryOptions,
  addressInternalTxQueryOptions,
} from "@/lib/query-options";
import {
  AddressExternalTxQuery,
  AddressInternalTxQuery,
} from "@/types/address-tx-query";
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

type SelectedTxType = "external" | "internal"; // 直接使用字符串联合类型

export const Route = createFileRoute("/_details-layout/address/$hash")({
  component: AddressDetailsComponent,
  // 移除 page, pageSize from loaderDeps
  loaderDeps: () => ({}), // No deps from search needed
  loader: async ({ context: { queryClient }, params: { hash } }) => {
    // Loader 只加载地址信息
    await queryClient.ensureQueryData(addressInfoQueryOptions(hash));
    return {};
  },
});

function AddressDetailsComponent() {
  const { hash } = Route.useParams();
  // 本地状态管理当前显示的交易类型
  const [selectedTxType, setSelectedTxType] =
    useState<SelectedTxType>("external");
  // 本地状态管理分页
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10; // Use a constant for now

  // 1. 加载地址信息 (总是需要，由 loader 预加载)
  const { data: addressInfo } = useSuspenseQuery(addressInfoQueryOptions(hash));

  // 2. 使用 useQuery 获取外部交易 (使用本地分页状态)
  const externalTxQuery = useQuery({
    ...addressExternalTxQueryOptions({
      address: hash,
      page: currentPage, // Use local state
      page_size: pageSize, // Use local state
    }),
    enabled: selectedTxType === "external",
    placeholderData: keepPreviousData,
  });

  // 3. 使用 useQuery 获取内部交易 (使用本地分页状态)
  const internalTxQuery = useQuery({
    ...addressInternalTxQueryOptions({
      address: hash,
      page: currentPage, // Use local state
      page_size: pageSize, // Use local state
    }),
    enabled: selectedTxType === "internal",
    placeholderData: keepPreviousData,
  });

  // 4. 根据 selectedTxType 确定当前要显示的数据和状态
  const currentQuery =
    selectedTxType === "external" ? externalTxQuery : internalTxQuery;
  const transactions = currentQuery.data?.data?.transactions;
  const totalTransactions = currentQuery.data?.data?.total;
  const isLoading = currentQuery.isLoading;
  const isFetching = currentQuery.isFetching; // 用于显示分页加载状态

  // 使用当前类型的 totalTransactions 计算 pageCount
  const pageCount = Math.ceil((totalTransactions ?? 0) / pageSize);

  // 更新本地分页状态
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // 处理交易类型切换 (更新本地状态)
  const handleTxTypeChange = (newTxType: SelectedTxType) => {
    setSelectedTxType(newTxType);
    setCurrentPage(1); // 切换类型时，重置分页到第一页
  };

  return (
    <div className="space-y-4">
      <AddressHeader addressInfo={addressInfo} />
      <div className="grid gap-4 grid-cols-2">
        <AddressOverview addressInfo={addressInfo} />
        <AddressMoreInfo addressInfo={addressInfo} />
      </div>

      {/* 切换按钮 */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium cursor-pointer ${
            selectedTxType === "external" // 使用本地状态
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTxTypeChange("external")}
        >
          外部交易 ({addressInfo.external_transactions_count})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium cursor-pointer ${
            selectedTxType === "internal" // 使用本地状态
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTxTypeChange("internal")}
        >
          内部交易 ({addressInfo.internal_transactions_count})
        </button>
      </div>

      {/* 条件渲染交易表格 + 处理加载状态 */}
      <div className="relative min-h-[200px]">
        {" "}
        {/* Container for positioning loading state */}
        {isLoading ? (
          // 1. Initial Loading State
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            正在加载...
          </div>
        ) : currentQuery.isError ? (
          // 2. Error State
          <div className="text-center p-4 text-destructive">
            加载交易数据时出错。
          </div>
        ) : transactions && transactions.length > 0 ? (
          // 3. Data Loaded and Available State
          <>
            {selectedTxType === "external" && (
              <ExternalTransactionsTable
                data={transactions as AddressExternalTxQuery["transactions"]}
                pageCount={pageCount}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                totalTransactions={totalTransactions ?? 0}
                isFetching={isFetching} // Pass fetching state
              />
            )}
            {selectedTxType === "internal" && (
              <InternalTransactionsTable
                data={transactions as AddressInternalTxQuery["transactions"]}
                pageCount={pageCount}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                totalTransactions={totalTransactions ?? 0}
                isFetching={isFetching} // Pass fetching state
              />
            )}
          </>
        ) : (
          // 4. No Results State (after loading, no error)
          <div className="text-center p-4 text-muted-foreground">
            无交易记录。
          </div>
        )}
      </div>
    </div>
  );
}
