import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { IconSearch } from "@tabler/icons-react";
import { searchQueryOptions } from "@/lib/query-options";
import { AddressResultItem } from "@/types/query-result";
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
    staleTime: 0,
  });

  const recommendations = queryResult?.data?.results.recommendations;

  const handleFocus = () => setIsFocused(true);

  // 当点击搜索框外部时，关闭搜索框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
        // 移除推荐数据的缓存
        queryClient.removeQueries({
          queryKey: ["search", "", limit],
        });
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [queryClient]);

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
              加载推荐失败。
            </p>
          ) : !recommendations || recommendations.length === 0 ? (
            <p className="p-4 text-sm text-center text-muted-foreground">
              暂无推荐。
            </p>
          ) : (
            <div>
              <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                推荐地址
              </p>
              <ul>
                {recommendations.map((item: AddressResultItem) => (
                  <li
                    key={item.id}
                    className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
                  >
                    <span className="truncate font-mono text-sm">
                      {item.address}
                    </span>
                    {item.name && (
                      <span className="ml-2 text-muted-foreground text-xs truncate">
                        ({item.name})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
