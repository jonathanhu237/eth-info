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
import { AddressInternalTxQuery } from "@/types/address-tx-query"; // 使用内部交易类型
import { formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ethers } from "ethers";

// --- 类型定义 ---
type Transaction = AddressInternalTxQuery["transactions"][0];

// --- 组件 Props ---
interface InternalTransactionsTableProps {
  data?: Transaction[];
  pageCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  totalTransactions: number;
  isFetching?: boolean;
}

// --- 列定义 (根据内部交易调整) ---
const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "hash",
    header: "父交易哈希", // 内部交易关联父交易哈希
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
      const timestamp: number = row.getValue("timestamp"); // 时间戳是 number 类型
      try {
        const date = new Date(timestamp * 1000); // 将秒转换为毫秒
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
          className="text-primary hover:underline font-mono truncate block"
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
        // 内部交易通常不会是合约创建，但以防万一保留
        return <span className="text-muted-foreground">未知</span>;
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
  // 内部交易可能有关联合约地址
  {
    accessorKey: "contract_address",
    header: "合约地址",
    cell: ({ row }: CellContext<Transaction, unknown>) => {
      const contractAddress: string | null = row.getValue("contract_address");
      if (!contractAddress) {
        return <span className="text-muted-foreground">-</span>;
      }
      const checksumAddress = toChecksumAddress(contractAddress);
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
];

// --- 主组件 ---
export function InternalTransactionsTable({
  data,
  pageCount,
  currentPage,
  pageSize,
  onPageChange,
  totalTransactions,
  isFetching,
}: InternalTransactionsTableProps) {
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
                  key={row.id} // 内部交易没有唯一 id，可能需要组合 key
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
                  {"无结果。"}
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
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pageCount || isFetching}
              className="cursor-pointer w-20"
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
