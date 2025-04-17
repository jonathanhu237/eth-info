import {
  addressInfoQueryOptions,
  addressExternalTxQueryOptions,
  addressInternalTxQueryOptions,
} from "@/lib/query-options";
import {
  useSuspenseQuery,
  UseSuspenseQueryOptions,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AddressHeader } from "@/feat/address/address-header";
import { AddressOverview } from "@/feat/address/address-overview";
import { AddressMoreInfo } from "@/feat/address/address-more-info";
import { ExternalTransactionsTable } from "@/feat/address/external-transactions-table";
import { InternalTransactionsTable } from "@/feat/address/internal-transactions-table";
import { z } from "zod";
// 导入交易查询类型
import {
  AddressExternalTxQuery,
  AddressInternalTxQuery,
} from "@/types/address-tx-query";
import { AxiosResponse } from "axios"; // Import AxiosResponse

// 定义交易类型枚举
const TxTypeEnum = z.enum(["external", "internal"]);

const addressSearchSchema = z.object({
  page: z.number().int().min(1).catch(1),
  pageSize: z.number().int().min(5).max(100).catch(10),
  txType: TxTypeEnum.catch("external"),
});

type AddressSearchParams = z.infer<typeof addressSearchSchema>;

// 定义查询函数返回的数据联合类型
type TxQueryResponse = AxiosResponse<
  AddressExternalTxQuery | AddressInternalTxQuery
>;
// 定义查询选项的联合类型，这有助于类型推断
type TxQueryOptions = ReturnType<
  typeof addressExternalTxQueryOptions | typeof addressInternalTxQueryOptions
>;

export const Route = createFileRoute("/_details-layout/address/$hash")({
  validateSearch: addressSearchSchema,
  component: AddressDetailsComponent,
  loaderDeps: ({ search: { page, pageSize, txType } }) => ({
    page,
    pageSize,
    txType,
  }),
  loader: async ({
    context: { queryClient },
    params: { hash },
    deps: { page, pageSize, txType },
  }) => {
    console.log(`Loader running for txType: ${txType}`); // 添加日志
    const addressInfoPromise = queryClient.ensureQueryData(
      addressInfoQueryOptions(hash)
    );

    // Loader 只预加载当前 URL 指定的交易类型
    const transactionsPromise =
      txType === "internal"
        ? queryClient.ensureQueryData(
            addressInternalTxQueryOptions({
              address: hash,
              page: page,
              page_size: pageSize,
            })
          )
        : queryClient.ensureQueryData(
            addressExternalTxQueryOptions({
              address: hash,
              page: page,
              page_size: pageSize,
            })
          );

    await Promise.all([addressInfoPromise, transactionsPromise]);
    console.log(`Loader finished for txType: ${txType}`); // 添加日志
    return {};
  },
});

function AddressDetailsComponent() {
  const { hash } = Route.useParams();
  const { page, pageSize, txType } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  console.log(`Component rendering for txType: ${txType}`); // 添加日志

  // 1. 加载地址信息 (总是需要)
  const { data: addressInfo } = useSuspenseQuery(addressInfoQueryOptions(hash));

  // 2. 根据当前 txType 确定活动的查询选项
  const activeTxQueryOptions: TxQueryOptions = // 使用定义的联合类型
    txType === "internal"
      ? addressInternalTxQueryOptions({
          address: hash,
          page: page,
          page_size: pageSize,
        })
      : addressExternalTxQueryOptions({
          address: hash,
          page: page,
          page_size: pageSize,
        });

  // 3. 使用 *一个* useSuspenseQuery，它会读取 loader 预加载的数据
  //    当 txType 改变 -> loader 重跑 -> 这个 hook 读取新数据
  const { data: transactionsData } = useSuspenseQuery<TxQueryResponse>(
    // 使用类型断言强制 TQueryKey 类型匹配
    activeTxQueryOptions as UseSuspenseQueryOptions<TxQueryResponse>
  );
  console.log(`Transaction data received for ${txType}`, transactionsData);

  // 4. 提取数据 - 类型系统知道 transactionsData 是联合类型
  const transactions = transactionsData?.data?.transactions;
  const totalTransactions = transactionsData?.data?.total; // 这个总数是对应 txType 的

  // 使用当前 txType 对应的 totalTransactions 计算 pageCount
  const pageCount = Math.ceil((totalTransactions ?? 0) / pageSize);

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev: AddressSearchParams): AddressSearchParams => ({
        ...prev,
        page: newPage,
        // txType 从 prev 保留
      }),
      replace: true,
      params: { hash },
    });
  };

  // 处理交易类型切换
  const handleTxTypeChange = (newTxType: z.infer<typeof TxTypeEnum>) => {
    console.log(`Switching to txType: ${newTxType}`); // 添加日志
    navigate({
      search: (prev: AddressSearchParams): AddressSearchParams => ({
        ...prev,
        txType: newTxType,
        page: 1, // 切换类型时重置页码为 1
      }),
      replace: true,
      params: { hash },
    });
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
            txType === "external"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTxTypeChange("external")}
        >
          外部交易 ({addressInfo.external_transactions_count})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium cursor-pointer ${
            txType === "internal"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTxTypeChange("internal")}
        >
          内部交易 ({addressInfo.internal_transactions_count})
        </button>
      </div>

      {/* 条件渲染交易表格 */}
      {txType === "external" && transactions && (
        <ExternalTransactionsTable
          // 类型守卫/断言确保传递正确类型
          data={transactions as AddressExternalTxQuery["transactions"]}
          pageCount={pageCount}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          totalTransactions={totalTransactions ?? 0}
        />
      )}
      {txType === "internal" && transactions && (
        <InternalTransactionsTable
          // 类型守卫/断言确保传递正确类型
          data={transactions as AddressInternalTxQuery["transactions"]}
          pageCount={pageCount}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          totalTransactions={totalTransactions ?? 0}
        />
      )}
      {/* 添加一个加载中或无数据的状态显示，以防万一 */}
      {!transactions && (
        <div className="text-center p-4 text-muted-foreground">
          正在加载交易数据...
        </div>
      )}
    </div>
  );
}
