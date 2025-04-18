import { Link } from "@tanstack/react-router";
import {
  CellContext,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  HeaderGroup,
  Row,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toChecksumAddress } from "@/lib/utils";
import { BlockTx } from "@/types/block-info"; // 使用区块交易类型
import { formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Loader2 } from "lucide-react";

// --- 类型定义 ---
type Transaction = BlockTx;

// --- 组件 Props ---
interface BlockTxTableProps {
  data?: Transaction[];
  pageCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  totalTransactions: number;
  isFetching?: boolean;
}

// --- 列定义 (根据 BlockTx 调整) ---
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
          className="text-primary hover:underline font-mono truncate block"
        >
          {truncatedHash}
        </Link>
      );
    },
  },
  {
    accessorKey: "transactionIndex",
    header: "索引",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      return <span>{row.getValue("transactionIndex")}</span>;
    },
  },
  {
    accessorKey: "datetime",
    header: "时间",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const datetime: string = row.getValue("datetime");
      try {
        const date = new Date(datetime);
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
    accessorKey: "from",
    header: "发送方",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const fromAddress: string = row.getValue("from");
      const checksumAddress = toChecksumAddress(fromAddress);
      const truncatedAddress = `${checksumAddress.substring(
        0,
        6
      )}...${checksumAddress.substring(checksumAddress.length - 4)}`;
      return (
        <Link
          to={"/address/$hash"}
          params={{ hash: checksumAddress }}
          className="text-primary hover:underline font-mono truncate block"
        >
          {truncatedAddress}
        </Link>
      );
    },
  },
  {
    accessorKey: "to",
    header: "接收方",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const toAddress: string | null = row.getValue("to");
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
          className="text-primary hover:underline font-mono truncate block"
        >
          {truncatedAddress}
        </Link>
      );
    },
  },
  {
    accessorKey: "value_eth",
    header: "金额 (ETH)",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const valueEth: number = row.getValue("value_eth");
      try {
        const displayValue = valueEth.toFixed(8);
        return <span className="font-mono">{displayValue}</span>;
      } catch {
        return <span className="text-muted-foreground font-mono">?</span>;
      }
    },
  },
  {
    accessorKey: "gasCost_eth", // 使用 gasCost_eth
    header: "交易费 (ETH)",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const feeEth: number = row.getValue("gasCost_eth");
      try {
        const displayValue = feeEth.toFixed(8);
        return <span className="font-mono">{displayValue}</span>;
      } catch {
        return <span className="text-muted-foreground font-mono">?</span>;
      }
    },
  },
];

// --- 主组件 ---
export function BlockTxTable({
  data,
  pageCount,
  currentPage,
  pageSize,
  onPageChange,
  totalTransactions,
  isFetching,
}: BlockTxTableProps) {
  const transactions = data ?? [];
  const pageIndex = currentPage - 1;

  const table = useReactTable({
    data: transactions,
    columns,
    pageCount: pageCount,
    state: {
      pagination: { pageIndex, pageSize },
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    debugTable: process.env.NODE_ENV === "development",
  });

  return (
    <div className="w-full space-y-4">
      <h3 className="text-lg font-semibold">区块交易</h3>
      <div className="rounded-md border relative">
        <Table>
          <TableHeader>
            {table
              .getHeaderGroups()
              .map((headerGroup: HeaderGroup<Transaction>) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row: Row<Transaction>) => (
                <TableRow
                  key={row.original.hash} // 使用交易哈希作为 key
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
                  {"该区块无交易记录。"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 0 && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            共 {totalTransactions} 条交易 | 第 {currentPage} 页 / 共 {pageCount}{" "}
            页
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isFetching}
              className="cursor-pointer w-20"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "上一页"
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pageCount || isFetching}
              className="cursor-pointer w-20"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "下一页"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
