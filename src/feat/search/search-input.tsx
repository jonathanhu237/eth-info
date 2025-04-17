import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { IconSearch } from "@tabler/icons-react";
import { searchQueryOptions } from "@/lib/query-options";
import {
  AddressResultItem,
  TransactionResultItem,
  LabelResultItem,
  BlockResultItem,
  FallbackResultItem,
} from "@/types/query-result";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const SearchInput = () => {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false); // 搜索框是否聚焦
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const limit = 5;

  const {
    data: queryResult,
    isPending,
    isError,
  } = useQuery({
    ...searchQueryOptions({ query: inputValue, limit }),
    enabled: isFocused,
  });

  // 获取状态码和搜索结果
  const statusCode = queryResult?.data?.status_code;
  const results = queryResult?.data?.results;

  // 获取各种类型的结果
  const recommendations = results?.recommendations;
  const transactions = results?.transactions;
  const addresses = results?.addresses;
  const labels = results?.labels;
  const blocks = results?.blocks;
  const fallback = results?.fallback;

  const handleFocus = () => setIsFocused(true);

  // 处理点击列表项
  const handleItemClick = (value: string) => {
    setInputValue(value);
    setIsFocused(false);
  };

  // 当点击搜索框外部时，关闭搜索框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
        // 移除推荐数据的缓存，推荐的数据是一次性的，所以不需要缓存。
        queryClient.removeQueries({
          queryKey: ["search", "", limit],
        });
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [queryClient, limit]);

  // 渲染交易列表项
  const renderTransactionItem = (item: TransactionResultItem) => (
    <li
      key={item.id}
      onClick={() => handleItemClick(item.hash)}
      className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
    >
      <div className="flex flex-col w-full overflow-hidden">
        <span className="truncate font-mono text-sm">{item.hash}</span>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="truncate max-w-[45%]">从: {item.from}</span>
          <span className="truncate max-w-[45%]">到: {item.to}</span>
        </div>
      </div>
    </li>
  );

  // 渲染地址列表项
  const renderAddressItem = (item: AddressResultItem) => (
    <li
      key={item.id}
      onClick={() => handleItemClick(item.address)}
      className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
    >
      <span className="truncate font-mono text-sm">{item.address}</span>
      {item.name && (
        <span className="ml-2 text-muted-foreground text-xs truncate">
          ({item.name})
        </span>
      )}
    </li>
  );

  // 渲染标签列表项
  const renderLabelItem = (item: LabelResultItem) => (
    <li
      key={item.id}
      onClick={() => handleItemClick(item.address)}
      className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
    >
      <div className="flex flex-col w-full overflow-hidden">
        <span className="truncate font-medium">{item.label}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {item.address}
        </span>
      </div>
    </li>
  );

  // 渲染区块列表项
  const renderBlockItem = (item: BlockResultItem) => (
    <li
      key={item.id}
      onClick={() => handleItemClick(item.number.toString())}
      className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
    >
      <div className="flex flex-col w-full overflow-hidden">
        <span className="truncate">区块 #{item.number}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          矿工: {item.miner}
        </span>
      </div>
    </li>
  );

  // 根据类型渲染 fallback 列表项
  const renderFallbackItem = (item: FallbackResultItem) => {
    switch (item.type) {
      case "transaction":
        return renderTransactionItem(item as TransactionResultItem);
      case "address":
        return renderAddressItem(item as AddressResultItem);
      case "label":
        return renderLabelItem(item as LabelResultItem);
      case "block":
        return renderBlockItem(item as BlockResultItem);
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      <Input
        type="search"
        placeholder="通过地址/交易哈希/区块号/标签进行查询"
        className="pl-10"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={handleFocus}
      />

      {isFocused && (
        <div
          className={cn(
            "absolute z-20 top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg",
            "max-h-[300px] overflow-y-auto"
          )}
        >
          {isPending ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-[90%] bg-muted" />
              <Skeleton className="h-4 w-[70%] bg-muted" />
              <Skeleton className="h-4 w-[85%] bg-muted" />
            </div>
          ) : isError ? (
            <p className="p-4 text-sm text-center text-destructive">
              加载失败。
            </p>
          ) : (
            <>
              {/* 空输入时显示推荐列表 (status_code: 1000 或 9999) */}
              {inputValue === "" &&
              recommendations &&
              recommendations.length > 0 ? (
                <div>
                  <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                    推荐地址
                  </p>
                  <ul>
                    {recommendations.map((item: AddressResultItem) =>
                      renderAddressItem(item)
                    )}
                  </ul>
                </div>
              ) : inputValue === "" &&
                (!recommendations || recommendations.length === 0) ? (
                <p className="p-4 text-sm text-center text-muted-foreground">
                  暂无推荐。
                </p>
              ) : null}

              {/* 直接前缀命中 (status_code: 1001) */}
              {inputValue !== "" && statusCode === 1001 && (
                <div className="divide-y">
                  {/* 交易结果 */}
                  {transactions && transactions.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                        交易
                      </p>
                      <ul>
                        {transactions.map((item) =>
                          renderTransactionItem(item)
                        )}
                      </ul>
                    </div>
                  )}

                  {/* 地址结果 */}
                  {addresses && addresses.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                        地址
                      </p>
                      <ul>
                        {addresses.map((item) => renderAddressItem(item))}
                      </ul>
                    </div>
                  )}

                  {/* 标签结果 */}
                  {labels && labels.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                        标签
                      </p>
                      <ul>{labels.map((item) => renderLabelItem(item))}</ul>
                    </div>
                  )}

                  {/* 区块结果 */}
                  {blocks && blocks.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                        区块
                      </p>
                      <ul>{blocks.map((item) => renderBlockItem(item))}</ul>
                    </div>
                  )}

                  {/* 所有类别都没有结果的情况 */}
                  {(!transactions || transactions.length === 0) &&
                    (!addresses || addresses.length === 0) &&
                    (!labels || labels.length === 0) &&
                    (!blocks || blocks.length === 0) && (
                      <p className="p-4 text-sm text-center text-muted-foreground">
                        无匹配结果。
                      </p>
                    )}
                </div>
              )}

              {/* 前缀未命中，返回fallback (status_code: 1002) */}
              {inputValue !== "" && statusCode === 1002 && (
                <div>
                  {fallback && fallback.length > 0 ? (
                    <>
                      <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                        您是否在找：
                      </p>
                      <ul>
                        {fallback.map((item) => renderFallbackItem(item))}
                      </ul>
                    </>
                  ) : (
                    <p className="p-4 text-sm text-center text-muted-foreground">
                      无匹配结果。
                    </p>
                  )}
                </div>
              )}

              {/* 其他状态码或无结果 */}
              {inputValue !== "" &&
                statusCode !== 1001 &&
                statusCode !== 1002 && (
                  <p className="p-4 text-sm text-center text-muted-foreground">
                    无匹配结果。
                  </p>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
