import { Fragment } from "react";
import { MatchInfo } from "@/types/query-result";
import { cn } from "@/lib/utils";

// 定义文本片段的类型
type TextSegment = {
  text: string;
  highlighted: boolean; // 是否背景高亮（来自<mark>）
  bold: boolean; // 是否加粗（来自match_positions）
  key: string; // React key
};

// 高亮+加粗文本组件
export const HighlightText = ({
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
  let textLengthForPositions = originalText.length;
  let segmentKeyIndex = 0;

  // 检查 matched_value 是否包含 <mark>
  if (matchInfo.matched_value && matchInfo.matched_value.includes("<mark>")) {
    const markedValue = matchInfo.matched_value;
    const parsedSegments: TextSegment[] = [];
    let remainingMarkedValue = markedValue;
    let currentParsedLength = 0;

    while (remainingMarkedValue.length > 0) {
      const markStart = remainingMarkedValue.indexOf("<mark>");
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
      remainingMarkedValue = remainingMarkedValue.substring(markEnd + 7);
    }
    baseSegments = parsedSegments;
    textLengthForPositions = currentParsedLength;
  } else {
    baseSegments = [
      { text: originalText, highlighted: false, bold: false, key: "base-0" },
    ];
    textLengthForPositions = originalText.length;
    segmentKeyIndex = 1;
  }

  // 步骤 2: 根据 match_positions 应用加粗
  if (matchInfo.match_positions && matchInfo.match_positions.length > 0) {
    const positions = [...matchInfo.match_positions].sort(
      (a, b) => a.start - b.start
    );
    let currentSegments = baseSegments;

    positions.forEach((pos) => {
      const boldStart = Math.max(0, pos.start);
      const boldEnd = Math.min(textLengthForPositions, pos.end);
      if (boldStart >= boldEnd) return;

      const nextSegments: TextSegment[] = [];
      let textCursor = 0;

      currentSegments.forEach((seg) => {
        const segStart = textCursor;
        const segEnd = textCursor + seg.text.length;
        const overlapStart = Math.max(segStart, boldStart);
        const overlapEnd = Math.min(segEnd, boldEnd);

        if (overlapStart < overlapEnd) {
          if (overlapStart > segStart) {
            nextSegments.push({
              ...seg,
              text: seg.text.substring(0, overlapStart - segStart),
              key: `split-${segmentKeyIndex++}`,
            });
          }
          nextSegments.push({
            ...seg,
            text: seg.text.substring(
              overlapStart - segStart,
              overlapEnd - segStart
            ),
            bold: true,
            key: `split-${segmentKeyIndex++}`,
          });
          if (overlapEnd < segEnd) {
            nextSegments.push({
              ...seg,
              text: seg.text.substring(overlapEnd - segStart),
              key: `split-${segmentKeyIndex++}`,
            });
          }
        } else {
          nextSegments.push(seg);
        }
        textCursor = segEnd;
      });
      currentSegments = nextSegments;
    });
    baseSegments = currentSegments;
  }

  // 渲染最终的片段
  return (
    <span>
      {baseSegments.map((segment) => (
        <Fragment key={segment.key}>
          <span
            className={cn(
              segment.highlighted && "bg-yellow-100 dark:bg-yellow-900",
              segment.bold && "font-bold"
            )}
          >
            {segment.text}
          </span>
        </Fragment>
      ))}
    </span>
  );
};
