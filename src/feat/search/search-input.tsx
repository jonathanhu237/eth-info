import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { IconSearch } from "@tabler/icons-react";
import { searchQueryOptions } from "@/lib/query-options";
import { SearchResultsList } from "./search-results-list";

export const SearchInput = () => {
  // 用户直接输入的搜索词
  const [inputValue, setInputValue] = useState("");
  // 经过防抖处理后用于查询的搜索词
  const [debouncedValue, setDebouncedValue] = useState("");
  // 搜索框是否获得焦点
  const [isFocused, setIsFocused] = useState(false);
  // 组件根元素的引用，用于检测外部点击
  const containerRef = useRef<HTMLDivElement>(null);
  // React Query 客户端实例
  const queryClient = useQueryClient();
  // 查询结果数量限制
  const limit = 5;

  // 防抖效果
  useEffect(() => {
    if (inputValue === "") {
      setDebouncedValue("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // 使用 React Query 获取搜索结果
  const {
    data: response,
    isPending,
    isError,
  } = useQuery({
    ...searchQueryOptions({ query: debouncedValue, limit }),
    enabled: isFocused,
  });

  // 从 response 中提取 data, 传递给 SearchResultsList
  const queryResultData = response?.data;

  // 处理搜索框获得焦点
  const handleFocus = () => setIsFocused(true);

  // 处理点击搜索结果项 (传递给列表组件)
  const handleItemClick = (value: string) => {
    setInputValue(value);
    setDebouncedValue(value);
    setIsFocused(false);
  };

  // 处理点击组件外部区域
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
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

  return (
    <div ref={containerRef} className="relative">
      {/* 搜索图标 */}
      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      {/* 输入框 */}
      <Input
        type="search"
        placeholder="通过地址/交易哈希/区块号/标签进行查询"
        className="pl-10"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={handleFocus}
      />

      {/* 条件渲染搜索结果列表 */}
      {isFocused && (
        <SearchResultsList
          isLoading={isPending}
          isError={isError}
          queryResult={queryResultData} // 传递提取后的数据
          debouncedValue={debouncedValue}
          onItemClick={handleItemClick}
        />
      )}
    </div>
  );
};
