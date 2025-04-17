import { useState, useRef, useEffect, Fragment } from "react";
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
  MatchInfo,
} from "@/types/query-result";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// --- Ethers.js 相关导入 ---
// 如果使用 ethers v6:
import { keccak256 } from "ethers";
// 如果使用 ethers v5:
// import { keccak256 } from 'ethers/lib/utils';
// --------------------------

// 将地址转换为符合 EIP-55 校验和的大小写格式 (使用 ethers)
const toChecksumAddress = (address: string): string => {
  if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
    // 无效地址格式，返回原始值或抛出错误
    console.warn(
      "Invalid address format passed to toChecksumAddress:",
      address
    );
    return address;
  }

  const addr = address.toLowerCase().replace("0x", "");
  // ethers的keccak256需要作用于地址的UTF-8字节
  // 使用 TextEncoder 将字符串转为 utf8 Uint8Array (浏览器兼容)
  const addressBytes = new TextEncoder().encode(addr);
  const hash = keccak256(addressBytes).replace("0x", ""); // 计算哈希并移除 '0x' 前缀

  let checksumAddress = "0x";
  for (let i = 0; i < addr.length; i++) {
    // 如果哈希值对应位的数字 >= 8，则将地址对应位的字母大写
    if (parseInt(hash[i], 16) >= 8) {
      checksumAddress += addr[i].toUpperCase();
    } else {
      // 否则保持小写（已经是小写了）
      checksumAddress += addr[i];
    }
  }
  return checksumAddress;
};

// 定义文本片段的类型
type TextSegment = {
  text: string;
  highlighted: boolean; // 是否背景高亮（来自<mark>）
  bold: boolean; // 是否加粗（来自match_positions）
  key: string; // React key
};

// 高亮+加粗文本组件，根据新的逻辑
const HighlightText = ({
  originalText,
  matchInfo,
}: {
  originalText: string;
  matchInfo?: MatchInfo;
}) => {
  // 如果没有匹配信息，直接返回原文本
  if (!matchInfo) {
    return <span>{originalText}</span>;
  }

  // 步骤 1: 确定基础文本片段并应用 <mark> 高亮
  let baseSegments: TextSegment[] = [];
  let textLengthForPositions = originalText.length; // 用于位置检查的文本长度（默认为原始长度）
  let segmentKeyIndex = 0;

  // 检查 matched_value 是否包含 <mark>
  if (matchInfo.matched_value && matchInfo.matched_value.includes("<mark>")) {
    const markedValue = matchInfo.matched_value;
    const parsedSegments: TextSegment[] = []; // 解析后的片段
    let remainingMarkedValue = markedValue;
    let currentParsedLength = 0; // 解析后（移除标签后）的文本长度

    // 循环处理 <mark> 标签
    while (remainingMarkedValue.length > 0) {
      const markStart = remainingMarkedValue.indexOf("<mark>");
      // 没有更多 <mark> 了
      if (markStart === -1) {
        parsedSegments.push({
          text: remainingMarkedValue,
          highlighted: false,
          bold: false,
          key: `mark-${segmentKeyIndex++}`,
        });
        currentParsedLength += remainingMarkedValue.length;
        break;
      }
      const markEnd = remainingMarkedValue.indexOf("</mark>", markStart);
      // 如果 <mark> 没有对应的 </mark>，视为格式错误
      if (markEnd === -1) {
        parsedSegments.push({
          text: remainingMarkedValue,
          highlighted: false,
          bold: false,
          key: `mark-${segmentKeyIndex++}`,
        });
        currentParsedLength += remainingMarkedValue.length;
        break;
      }

      // 添加 <mark> 前的文本
      if (markStart > 0) {
        const prefixText = remainingMarkedValue.substring(0, markStart);
        parsedSegments.push({
          text: prefixText,
          highlighted: false,
          bold: false,
          key: `mark-${segmentKeyIndex++}`,
        });
        currentParsedLength += prefixText.length;
      }
      // 添加 <mark> 内的文本（高亮）
      const highlightedText = remainingMarkedValue.substring(
        markStart + 6,
        markEnd
      );
      parsedSegments.push({
        text: highlightedText,
        highlighted: true,
        bold: false,
        key: `mark-${segmentKeyIndex++}`,
      });
      currentParsedLength += highlightedText.length;
      // 更新剩余待处理文本
      remainingMarkedValue = remainingMarkedValue.substring(markEnd + 7);
    }
    baseSegments = parsedSegments;
    textLengthForPositions = currentParsedLength; // 使用移除标签后的长度进行位置检查
  } else {
    // 没有 <mark> 标签，使用原始文本作为单一的基础片段
    baseSegments = [
      { text: originalText, highlighted: false, bold: false, key: "base-0" },
    ];
    textLengthForPositions = originalText.length;
    segmentKeyIndex = 1; // 重置 key 索引
  }

  // 步骤 2: 根据 match_positions 应用加粗（作用于 baseSegments）
  if (matchInfo.match_positions && matchInfo.match_positions.length > 0) {
    // 按起始位置排序
    const positions = [...matchInfo.match_positions].sort(
      (a, b) => a.start - b.start
    );
    let currentSegments = baseSegments; // 当前处理的片段列表

    // 遍历每个加粗位置
    positions.forEach((pos) => {
      // 使用 textLengthForPositions（已考虑移除<mark>标签）
      const boldStart = Math.max(0, pos.start);
      const boldEnd = Math.min(textLengthForPositions, pos.end);
      // 跳过无效或零长度的位置
      if (boldStart >= boldEnd) return;

      // 明确 nextSegments 的类型
      const nextSegments: TextSegment[] = [];
      let textCursor = 0; // 追踪在 baseSegments 文本中的位置

      // 遍历当前片段，应用加粗
      currentSegments.forEach((seg) => {
        const segStart = textCursor; // 当前片段的起始位置
        const segEnd = textCursor + seg.text.length; // 当前片段的结束位置 (seg.text 已移除标签)

        // 计算加粗范围与当前片段的重叠部分
        const overlapStart = Math.max(segStart, boldStart);
        const overlapEnd = Math.min(segEnd, boldEnd);

        // 如果存在重叠
        if (overlapStart < overlapEnd) {
          // 重叠前的部分 (保持原样)
          if (overlapStart > segStart) {
            nextSegments.push({
              ...seg,
              text: seg.text.substring(0, overlapStart - segStart),
              key: `split-${segmentKeyIndex++}`,
            });
          }
          // 重叠部分 (应用加粗)
          nextSegments.push({
            ...seg,
            text: seg.text.substring(
              overlapStart - segStart,
              overlapEnd - segStart
            ),
            bold: true,
            key: `split-${segmentKeyIndex++}`,
          });
          // 重叠后的部分 (保持原样)
          if (overlapEnd < segEnd) {
            nextSegments.push({
              ...seg,
              text: seg.text.substring(overlapEnd - segStart),
              key: `split-${segmentKeyIndex++}`,
            });
          }
        } else {
          // 没有重叠，直接添加原片段
          nextSegments.push(seg);
        }
        textCursor = segEnd; // 更新文本光标位置
      });
      // 更新当前片段列表，为下一个加粗位置做准备
      currentSegments = nextSegments;
    });
    baseSegments = currentSegments; // 保存应用所有加粗后的最终片段
  }

  // 渲染最终的片段
  return (
    <span>
      {baseSegments.map((segment) => (
        <Fragment key={segment.key}>
          <span
            className={cn(
              segment.highlighted && "bg-yellow-100 dark:bg-yellow-900", // 背景高亮
              segment.bold && "font-bold" // 加粗
            )}
          >
            {segment.text}
          </span>
        </Fragment>
      ))}
    </span>
  );
};

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

  // 防抖效果：当 inputValue 改变后，延迟 300ms 再更新 debouncedValue
  useEffect(() => {
    // 如果输入为空，立即更新防抖值以显示推荐
    if (inputValue === "") {
      setDebouncedValue("");
      return;
    }

    // 设置定时器，延迟更新
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300); // 300 毫秒防抖延迟

    // 清理函数：如果 inputValue 在延迟期间再次改变，清除上一个定时器
    return () => clearTimeout(timer);
  }, [inputValue]); // 依赖 inputValue

  // 使用 React Query 获取搜索结果，查询基于 debouncedValue
  const {
    data: queryResult, // 完整的 axios 响应体
    isPending, // 是否正在加载
    isError, // 是否发生错误
  } = useQuery({
    ...searchQueryOptions({ query: debouncedValue, limit }),
    enabled: isFocused, // 仅在搜索框聚焦时启用查询
  });

  // 提取状态码和结果数据
  const statusCode = queryResult?.data?.status_code;
  const results = queryResult?.data?.results;

  // 提取不同类型的结果列表
  const recommendations = results?.recommendations;
  const transactions = results?.transactions;
  const addresses = results?.addresses;
  const labels = results?.labels;
  const blocks = results?.blocks;
  const fallback = results?.fallback;

  // 处理搜索框获得焦点
  const handleFocus = () => setIsFocused(true);

  // 处理点击搜索结果项
  const handleItemClick = (value: string) => {
    setInputValue(value); // 更新输入框内容
    setDebouncedValue(value); // 立刻更新防抖值，避免重新触发基于旧值的查询
    setIsFocused(false); // 关闭下拉列表
  };

  // 处理点击组件外部区域，用于关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 如果点击发生在 containerRef 元素之外
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false); // 取消焦点，关闭列表
        // 清除推荐数据的缓存（当输入为空时触发的查询）
        // 因为推荐数据通常是一次性的，不需要长时间缓存
        queryClient.removeQueries({
          queryKey: ["search", "", limit], // 推荐查询的 key
        });
      }
    };
    // 添加事件监听器
    document.addEventListener("mousedown", handleClickOutside);
    // 组件卸载时移除监听器
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [queryClient, limit]); // 依赖 queryClient 和 limit

  // --- 渲染函数 ---

  // 渲染交易列表项
  const renderTransactionItem = (item: TransactionResultItem) => {
    // 对 from 和 to 地址应用校验和
    const checksumFrom = toChecksumAddress(item.from);
    const checksumTo = toChecksumAddress(item.to);
    return (
      <li
        key={item.id}
        onClick={() => handleItemClick(item.hash)}
        className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
      >
        <div className="flex flex-col w-full overflow-hidden">
          <span className="truncate font-mono text-sm">
            {/* 高亮哈希 */}
            <HighlightText
              originalText={item.hash}
              matchInfo={
                item.match_info?.matched_field === "hash"
                  ? item.match_info
                  : undefined
              }
            />
          </span>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[45%]" title={checksumFrom}>
              {" "}
              {/* 添加 title 属性显示完整地址 */}
              从:{" "}
              <HighlightText
                originalText={checksumFrom} // 使用校验和地址
                matchInfo={
                  item.match_info?.matched_field === "from"
                    ? item.match_info
                    : undefined
                }
              />
            </span>
            <span className="truncate max-w-[45%]" title={checksumTo}>
              {" "}
              {/* 添加 title 属性显示完整地址 */}
              到:{" "}
              <HighlightText
                originalText={checksumTo} // 使用校验和地址
                matchInfo={
                  item.match_info?.matched_field === "to"
                    ? item.match_info
                    : undefined
                }
              />
            </span>
          </div>
        </div>
      </li>
    );
  };

  // 渲染地址列表项
  const renderAddressItem = (item: AddressResultItem) => {
    // 对地址应用校验和
    const checksumAddress = toChecksumAddress(item.address);
    return (
      <li
        key={item.id}
        onClick={() => handleItemClick(checksumAddress)} // 点击填充校验和地址
        className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
      >
        <span className="truncate font-mono text-sm" title={checksumAddress}>
          {" "}
          {/* 添加 title 属性 */}
          <HighlightText
            originalText={checksumAddress} // 使用校验和地址
            matchInfo={
              item.match_info?.matched_field === "address"
                ? item.match_info
                : undefined
            }
          />
        </span>
        {/* 如果有名称，显示并高亮名称 */}
        {item.name && (
          <span className="ml-2 text-muted-foreground text-xs truncate">
            (
            <HighlightText
              originalText={item.name}
              matchInfo={
                item.match_info?.matched_field === "name"
                  ? item.match_info
                  : undefined
              }
            />
            )
          </span>
        )}
      </li>
    );
  };

  // 渲染标签列表项
  const renderLabelItem = (item: LabelResultItem) => {
    // 确定要显示的文本 (优先 display, 其次 name, 最后 label)
    const textToHighlight = item.display || item.name || item.label;
    // 对地址应用校验和
    const checksumAddress = toChecksumAddress(item.address);
    return (
      <li
        key={item.id}
        onClick={() => handleItemClick(checksumAddress)} // 点击标签项填充其关联地址
        className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
      >
        <div className="flex flex-col w-full overflow-hidden">
          <span className="truncate font-medium">
            {/* 传递原始显示文本和完整的匹配信息给高亮组件 */}
            <HighlightText
              originalText={textToHighlight}
              matchInfo={item.match_info} // 让 HighlightText 根据 match_info 内容决定高亮方式
            />
          </span>
          {/* 显示校验和地址 */}{" "}
          <span
            className="truncate font-mono text-xs text-muted-foreground"
            title={checksumAddress}
          >
            {" "}
            {/* 添加 title 属性 */}
            {checksumAddress}
          </span>
        </div>
      </li>
    );
  };

  // 渲染区块列表项
  const renderBlockItem = (item: BlockResultItem) => {
    // 对矿工地址应用校验和
    const checksumMiner = toChecksumAddress(item.miner);
    return (
      <li
        key={item.id}
        onClick={() => handleItemClick(item.number.toString())}
        className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
      >
        <div className="flex flex-col w-full overflow-hidden">
          <span className="truncate">
            区块 #
            <HighlightText
              originalText={item.number.toString()}
              matchInfo={
                item.match_info?.matched_field === "number_prefix"
                  ? item.match_info
                  : undefined
              }
            />
          </span>
          {/* 显示校验和矿工地址 */}
          <span
            className="truncate font-mono text-xs text-muted-foreground"
            title={checksumMiner}
          >
            {" "}
            {/* 添加 title 属性 */}
            矿工: {checksumMiner}
          </span>
        </div>
      </li>
    );
  };

  // 根据类型渲染 fallback 列表项
  const renderFallbackItem = (item: FallbackResultItem) => {
    // Fallback 项也需要高亮
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
        return null; // 未知类型不渲染
    }
  };

  // 渲染推荐地址列表
  const renderRecommendations = (items: AddressResultItem[]) => {
    // 如果没有推荐项或列表为空，不渲染
    if (!items || items.length === 0) return null;

    return (
      <div>
        <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
          推荐地址
        </p>
        <ul>
          {/* 推荐地址通常没有 match_info，直接使用 renderAddressItem */}
          {items.map((item) => renderAddressItem(item))}
        </ul>
      </div>
    );
  };

  // --- JSX 渲染 ---
  return (
    <div ref={containerRef} className="relative">
      {/* 搜索图标 */}
      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      {/* 输入框 */}
      <Input
        type="search"
        placeholder="通过地址/交易哈希/区块号/标签进行查询"
        className="pl-10" // 左内边距给图标留空间
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)} // 更新输入状态
        onFocus={handleFocus} // 处理聚焦事件
      />

      {/* 下拉结果列表 (仅在聚焦时显示) */}
      {isFocused && (
        <div
          className={cn(
            "absolute z-20 top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg", // 样式：绝对定位、层级、边框、背景、阴影
            "max-h-[300px] overflow-y-auto" // 最大高度和垂直滚动条
          )}
        >
          {/* 加载状态 */}
          {isPending ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-[90%] bg-muted" />
              <Skeleton className="h-4 w-[70%] bg-muted" />
              <Skeleton className="h-4 w-[85%] bg-muted" />
            </div>
          ) : isError ? ( // 错误状态
            <p className="p-4 text-sm text-center text-destructive">
              加载失败。
            </p>
          ) : (
            // 加载成功后渲染结果
            <>
              {/* 情况1: 显示推荐 (空输入且状态码1000，或状态码9999) */}
              {((debouncedValue === "" && statusCode === 1000) ||
                statusCode === 9999) &&
              recommendations &&
              recommendations.length > 0 ? (
                renderRecommendations(recommendations)
              ) : ((debouncedValue === "" && statusCode === 1000) ||
                  statusCode === 9999) &&
                (!recommendations || recommendations.length === 0) ? (
                // 没有推荐数据时显示
                <p className="p-4 text-sm text-center text-muted-foreground">
                  暂无推荐。
                </p>
              ) : null}

              {/* 情况2: 直接前缀命中 (输入非空且状态码1001) */}
              {debouncedValue !== "" && statusCode === 1001 && (
                <div className="divide-y">
                  {" "}
                  {/* 使用分隔线分隔不同类别 */}
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
                  {/* 如果所有类别都没有结果 */}
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

              {/* 情况3: 前缀未命中，返回 fallback (输入非空且状态码1002) */}
              {debouncedValue !== "" && statusCode === 1002 && (
                <div>
                  {/* 如果有 fallback 结果 */}{" "}
                  {fallback && fallback.length > 0 ? (
                    <div>
                      <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                        您是否在找：
                      </p>
                      <ul>
                        {fallback.map((item) => renderFallbackItem(item))}
                      </ul>
                    </div>
                  ) : (
                    // 如果没有 fallback 结果
                    <p className="p-4 text-sm text-center text-muted-foreground">
                      无匹配结果。
                    </p>
                  )}
                </div>
              )}

              {/* 情况4: 其他状态码或无任何有效结果 */}
              {debouncedValue !== "" &&
                statusCode !== 1000 &&
                statusCode !== 1001 &&
                statusCode !== 1002 &&
                statusCode !== 9999 && (
                  // 排除已处理的状态码
                  // 状态码 1000 仅在 debouncedValue 为空时处理
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
