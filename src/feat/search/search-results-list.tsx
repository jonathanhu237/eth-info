import { cn } from "@/lib/utils";
import { toChecksumAddress } from "@/lib/utils"; // 导入校验和工具
import {
  AddressResultItem,
  BlockResultItem,
  FallbackResultItem,
  LabelResultItem,
  QueryResult, // 导入 QueryResult
  TransactionResultItem,
} from "@/types/query-result";
import { Skeleton } from "@/components/ui/skeleton";
import { HighlightText } from "./highlight-text"; // 导入高亮组件
import { useNavigate } from "@tanstack/react-router"; // 导入 useNavigate

interface SearchResultsListProps {
  isLoading: boolean;
  isError: boolean;
  queryResult?: QueryResult; // 改为可选，因为初始可能没有
  debouncedValue: string; // 需要防抖后的值来判断显示逻辑
  onItemClick: (value: string) => void;
}

// 将渲染函数移到这里
const renderTransactionItem = (
  item: TransactionResultItem,
  onClick: (value: string, type: string) => void
) => {
  const checksumFrom = toChecksumAddress(item.from);
  const checksumTo = toChecksumAddress(item.to);
  return (
    <li
      key={item.id}
      onClick={() => onClick(item.hash, item.type)}
      className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
    >
      <div className="flex flex-col w-full overflow-hidden">
        <span className="truncate font-mono text-sm">
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
            从:{" "}
            <HighlightText
              originalText={checksumFrom}
              matchInfo={
                item.match_info?.matched_field === "from"
                  ? item.match_info
                  : undefined
              }
            />
          </span>
          <span className="truncate max-w-[45%]" title={checksumTo}>
            到:{" "}
            <HighlightText
              originalText={checksumTo}
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

const renderAddressItem = (
  item: AddressResultItem,
  onClick: (value: string, type: string) => void
) => {
  const checksumAddress = toChecksumAddress(item.address);
  return (
    <li
      key={item.id}
      onClick={() => onClick(checksumAddress, item.type)}
      className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
    >
      <span className="truncate font-mono text-sm" title={checksumAddress}>
        <HighlightText
          originalText={checksumAddress}
          matchInfo={
            item.match_info?.matched_field === "address"
              ? item.match_info
              : undefined
          }
        />
      </span>
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

const renderLabelItem = (
  item: LabelResultItem,
  onClick: (value: string, type: string) => void
) => {
  const textToHighlight = item.display || item.name || item.label;
  const checksumAddress = toChecksumAddress(item.address);
  return (
    <li
      key={item.id}
      onClick={() => onClick(checksumAddress, item.type)}
      className="flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors duration-100"
    >
      <div className="flex flex-col w-full overflow-hidden">
        <span className="truncate font-medium">
          <HighlightText
            originalText={textToHighlight}
            matchInfo={item.match_info}
          />
        </span>
        <span
          className="truncate font-mono text-xs text-muted-foreground"
          title={checksumAddress}
        >
          {checksumAddress}
        </span>
      </div>
    </li>
  );
};

const renderBlockItem = (
  item: BlockResultItem,
  onClick: (value: string, type: string) => void
) => {
  const checksumMiner = toChecksumAddress(item.miner);
  return (
    <li
      key={item.id}
      onClick={() => onClick(item.number.toString(), item.type)}
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
        <span
          className="truncate font-mono text-xs text-muted-foreground"
          title={checksumMiner}
        >
          矿工: {checksumMiner}
        </span>
      </div>
    </li>
  );
};

const renderFallbackItem = (
  item: FallbackResultItem,
  onClick: (value: string, type: string) => void
) => {
  switch (item.type) {
    case "transaction":
      return renderTransactionItem(item as TransactionResultItem, onClick);
    case "address":
      return renderAddressItem(item as AddressResultItem, onClick);
    case "label":
      return renderLabelItem(item as LabelResultItem, onClick);
    case "block":
      return renderBlockItem(item as BlockResultItem, onClick);
    default:
      return null;
  }
};

const renderRecommendations = (
  items: AddressResultItem[],
  onClick: (value: string, type: string) => void
) => {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
        推荐地址
      </p>
      <ul>{items.map((item) => renderAddressItem(item, onClick))}</ul>
    </div>
  );
};

export const SearchResultsList = ({
  isLoading,
  isError,
  queryResult,
  debouncedValue,
  onItemClick,
}: SearchResultsListProps) => {
  const navigate = useNavigate(); // 获取导航函数
  const statusCode = queryResult?.status_code;
  const results = queryResult?.results;
  const recommendations = results?.recommendations;
  const transactions = results?.transactions;
  const addresses = results?.addresses;
  const labels = results?.labels;
  const blocks = results?.blocks;
  const fallback = results?.fallback;

  // 新的点击处理函数，包含导航逻辑
  const handleNavigateAndClose = (value: string, type: string) => {
    // 先调用父组件的回调，更新输入框并关闭列表
    onItemClick(value);

    // 根据类型进行导航
    switch (type) {
      case "address":
      case "recommendation":
      case "label":
        navigate({
          to: "/address/$hash",
          params: { hash: value }, // value 已经是 checksumAddress
        });
        break;
      case "transaction":
        // TODO: 添加交易页导航
        console.log("Navigate to transaction page for:", value);
        break;
      case "block":
        // TODO: 添加区块页导航
        console.log("Navigate to block page for:", value);
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={cn(
        "absolute z-20 top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg",
        "max-h-[300px] overflow-y-auto"
      )}
    >
      {isLoading ? (
        <div className="p-4 space-y-2">
          <Skeleton className="h-4 w-[90%] bg-muted" />
          <Skeleton className="h-4 w-[70%] bg-muted" />
          <Skeleton className="h-4 w-[85%] bg-muted" />
        </div>
      ) : isError ? (
        <p className="p-4 text-sm text-center text-destructive">加载失败。</p>
      ) : (
        <>
          {/* 情况1: 显示推荐 */}
          {((debouncedValue === "" && statusCode === 1000) ||
            statusCode === 9999) &&
          recommendations &&
          recommendations.length > 0 ? (
            renderRecommendations(recommendations, handleNavigateAndClose)
          ) : ((debouncedValue === "" && statusCode === 1000) ||
              statusCode === 9999) &&
            (!recommendations || recommendations.length === 0) ? (
            <p className="p-4 text-sm text-center text-muted-foreground">
              暂无推荐。
            </p>
          ) : null}

          {/* 情况2: 直接前缀命中 */}
          {debouncedValue !== "" && statusCode === 1001 && (
            <div className="divide-y">
              {transactions && transactions.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                    交易
                  </p>
                  <ul>
                    {transactions.map((item) =>
                      renderTransactionItem(item, handleNavigateAndClose)
                    )}
                  </ul>
                </div>
              )}
              {addresses && addresses.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                    地址
                  </p>
                  <ul>
                    {addresses.map((item) =>
                      renderAddressItem(item, handleNavigateAndClose)
                    )}
                  </ul>
                </div>
              )}
              {labels && labels.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                    标签
                  </p>
                  <ul>
                    {labels.map((item) =>
                      renderLabelItem(item, handleNavigateAndClose)
                    )}
                  </ul>
                </div>
              )}
              {blocks && blocks.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                    区块
                  </p>
                  <ul>
                    {blocks.map((item) =>
                      renderBlockItem(item, handleNavigateAndClose)
                    )}
                  </ul>
                </div>
              )}
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

          {/* 情况3: 前缀未命中，返回 fallback */}
          {debouncedValue !== "" && statusCode === 1002 && (
            <div>
              {fallback && fallback.length > 0 ? (
                <div>
                  <p className="px-4 py-2 text-sm font-semibold text-muted-foreground border-b">
                    您是否在找：
                  </p>
                  <ul>
                    {fallback.map((item) =>
                      renderFallbackItem(item, handleNavigateAndClose)
                    )}
                  </ul>
                </div>
              ) : (
                <p className="p-4 text-sm text-center text-muted-foreground">
                  无匹配结果。
                </p>
              )}
            </div>
          )}

          {/* 情况4: 其他状态码或无任何有效结果 */}
          {debouncedValue !== "" &&
            ![1000, 1001, 1002, 9999].includes(statusCode ?? 0) && (
              <p className="p-4 text-sm text-center text-muted-foreground">
                无匹配结果。
              </p>
            )}
        </>
      )}
    </div>
  );
};
