import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  PaginationState,
  CellContext,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { externalTxQueryOptions } from "@/lib/query-options";
import { ExternalTxQuery } from "@/types/external-tx-query";
import { toChecksumAddress } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ethers } from "ethers";

// --- 类型定义 ---
type Transaction = ExternalTxQuery["transactions"][0];

// --- 组件 Props ---
interface ExternalTransactionsTableProps {
  address: string;
}

// --- 列定义 ---
const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "hash",
    header: "交易哈希",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const hash: string = row.getValue("hash");
      const truncatedHash = `${hash.substring(0, 6)}...${hash.substring(
        hash.length - 4
      )}`;
      return (
        <Link
          to={"/tx/$hash"}
          params={{ hash }}
          className="text-primary hover:underline font-mono truncate max-w-xs block"
        >
          {truncatedHash}
        </Link>
      );
    },
  },
  {
    accessorKey: "block_number",
    header: "区块",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const blockNumber: number = row.getValue("block_number");
      return (
        <Link
          to={"/block/$blockNumber"}
          params={{ blockNumber: String(blockNumber) }}
          className="text-primary hover:underline"
        >
          {blockNumber}
        </Link>
      );
    },
  },
  {
    accessorKey: "timestamp",
    header: "时间",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const timestamp: string = row.getValue("timestamp");
      try {
        const date = new Date(timestamp);
        return (
          <span title={date.toLocaleString()}>
            {formatDistanceToNowStrict(date, { addSuffix: true, locale: zhCN })}
          </span>
        );
      } catch {
        return <span>无效日期</span>;
      }
    },
  },
  {
    accessorKey: "from_address",
    header: "发送方",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const fromAddress: string = row.getValue("from_address");
      const checksumAddress = toChecksumAddress(fromAddress);
      const truncatedAddress = `${checksumAddress.substring(
        0,
        6
      )}...${checksumAddress.substring(checksumAddress.length - 4)}`;
      return (
        <Link
          to={"/address/$hash"}
          params={{ hash: checksumAddress }}
          className="text-primary hover:underline font-mono truncate max-w-xs block"
        >
          {truncatedAddress}
        </Link>
      );
    },
  },
  {
    accessorKey: "to_address",
    header: "接收方",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const toAddress: string | null = row.getValue("to_address");
      if (!toAddress) {
        return <span className="text-muted-foreground">合约创建</span>;
      }
      const checksumAddress = toChecksumAddress(toAddress);
      const truncatedAddress = `${checksumAddress.substring(
        0,
        6
      )}...${checksumAddress.substring(checksumAddress.length - 4)}`;
      return (
        <Link
          to={"/address/$hash"}
          params={{ hash: checksumAddress }}
          className="text-primary hover:underline font-mono truncate max-w-xs block"
        >
          {truncatedAddress}
        </Link>
      );
    },
  },
  {
    accessorKey: "value_raw",
    header: "金额 (ETH)",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const valueRaw: string = row.getValue("value_raw");
      try {
        const formattedValue = ethers.formatEther(valueRaw);
        const displayValue = parseFloat(formattedValue).toFixed(6);
        return <span className="font-mono">{displayValue}</span>;
      } catch {
        return <span className="text-muted-foreground font-mono">?</span>;
      }
    },
  },
];

// --- 主组件 ---
export function ExternalTransactionsTable({
  address,
}: ExternalTransactionsTableProps) {
  const [{ pageIndex, pageSize }, setPagination] =
    React.useState<PaginationState>({
      pageIndex: 0,
      pageSize: 10,
    });

  const queryOptions = externalTxQueryOptions({
    address,
    page: pageIndex + 1,
    page_size: pageSize,
  });

  const {
    data: queryResult,
    isLoading,
    isError,
    error,
  } = useQuery(queryOptions);

  const defaultData = React.useMemo(() => [], []);
  const transactions = queryResult?.data?.transactions ?? defaultData;
  const totalTransactions = queryResult?.data?.total ?? 0;

  const pageCount = React.useMemo(() => {
    return pageSize > 0 ? Math.ceil(totalTransactions / pageSize) : 0;
  }, [totalTransactions, pageSize]);

  const table = useReactTable({
    data: transactions,
    columns,
    pageCount: pageCount,
    state: {
      pagination: { pageIndex, pageSize },
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    debugTable: process.env.NODE_ENV === "development",
  });

  return (
    <div className="w-full space-y-4">
      {isLoading && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((_, index) => (
                  <TableHead key={`skeleton-head-${index}`}>
                    <Skeleton className="h-5 w-full" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(pageSize)].map((_, i) => (
                <TableRow key={`skeleton-row-${i}`}>
                  {columns.map((_, index) => (
                    <TableCell key={`skeleton-cell-${i}-${index}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isError && (
        <div className="text-center text-destructive py-4">
          加载交易失败: {error?.message || "未知错误"}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    无结果。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 0 && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            共 {totalTransactions} 条交易 | 第 {pageIndex + 1} 页 / 共{" "}
            {pageCount} 页
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={isLoading || !table.getCanPreviousPage()}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={isLoading || !table.getCanNextPage()}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
