import { useRef, useCallback, useEffect, useState, useMemo } from "react";
// import dynamic from 'next/dynamic'; // REMOVED
// import { useTheme } from "next-themes"; // REMOVED
import ForceGraph2D, {
  ForceGraphMethods,
  NodeObject,
  LinkObject,
} from "react-force-graph-2d";
import { formatRgb, parse, converter } from "culori"; // Import culori functions

// Define more specific types for graph data if needed
export interface GraphNode extends NodeObject {
  id: string;
  name: string;
  // color?: string; // Remove color
  type?: string; // Add type identifier
  val?: number; // Example: for node size
}

export interface GraphLink extends LinkObject {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  color?: string;
  width?: number;
}

// Define Legend Item Type
interface LegendItem {
  // color: string; // Remove color
  type: string; // Use type identifier
  label: string;
}

interface NeighborGraphProps {
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  // width: number; // REMOVED
  // height: number; // REMOVED
  onNodeClick: (node: GraphNode) => void;
  targetNodeId: string; // ID of the central node
  legendItems?: LegendItem[]; // Update legendItems type
}

// Helper function to truncate addresses
const truncateAddress = (address: string) => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(
    address.length - 4
  )}`;
};

export function NeighborGraph({
  graphData,
  // width, // REMOVED
  // height, // REMOVED
  onNodeClick,
  targetNodeId,
  legendItems, // Destructure legendItems
}: NeighborGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [colors, setColors] = useState({
    primary: "rgba(0, 0, 0, 1)", // Default black
    chart1: "rgba(204, 204, 204, 1)", // Default light gray
    chart2: "rgba(170, 170, 170, 1)", // Default mid-gray (added chart2)
    chart3: "rgba(153, 153, 153, 1)", // Default gray
    mutedFg: "rgba(170, 170, 170, 0.5)", // Default semi-transparent gray
  });

  // @ts-expect-error 貌似与全局类型冲突
  const fgRef = useRef<ForceGraphMethods>();
  // const { resolvedTheme } = useTheme(); // REMOVED theme logic for now

  // Effect to get computed CSS variable colors on mount
  useEffect(() => {
    const computedStyle = window.getComputedStyle(document.documentElement);
    const primaryColorStr = computedStyle.getPropertyValue("--primary").trim();
    const chart1ColorStr = computedStyle.getPropertyValue("--chart-1").trim();
    const chart2ColorStr = computedStyle.getPropertyValue("--chart-2").trim(); // Get chart-2
    const chart3ColorStr = computedStyle.getPropertyValue("--chart-3").trim();
    const mutedFgColorStr = computedStyle
      .getPropertyValue("--muted-foreground")
      .trim();

    // Helper to parse and format color, with fallback
    const getRgbaColor = (colorStr: string, fallback: string): string => {
      try {
        const parsed = parse(colorStr); // culori parses oklch
        if (parsed) {
          const rgba = converter("rgb")(parsed); // Convert to rgb mode
          return formatRgb(rgba); // formatRgb handles alpha channel
        }
      } catch (e) {
        console.error(`[NeighborGraph] Failed to parse color: ${colorStr}`, e);
      }
      return fallback;
    };

    // Helper to parse and format color with specific alpha
    const getRgbaColorWithAlpha = (
      colorStr: string,
      alpha: number,
      fallback: string
    ): string => {
      try {
        const parsed = parse(colorStr);
        if (parsed) {
          const rgba = converter("rgb")(parsed); // Convert to rgb mode
          rgba.alpha = alpha; // Set alpha
          return formatRgb(rgba);
        }
      } catch (e) {
        console.error(
          `[NeighborGraph] Failed to parse color for alpha: ${colorStr}`,
          e
        );
      }
      return fallback;
    };

    setColors({
      primary: getRgbaColor(primaryColorStr, colors.primary),
      chart1: getRgbaColor(chart1ColorStr, colors.chart1),
      chart2: getRgbaColor(chart2ColorStr, colors.chart2),
      chart3: getRgbaColor(chart3ColorStr, colors.chart3),
      mutedFg: getRgbaColorWithAlpha(mutedFgColorStr, 0.5, colors.mutedFg),
    });

    console.log("[NeighborGraph] Resolved Colors (RGBA):", {
      primary: getRgbaColor(primaryColorStr, colors.primary),
      chart1: getRgbaColor(chart1ColorStr, colors.chart1),
      chart2: getRgbaColor(chart2ColorStr, colors.chart2),
      chart3: getRgbaColor(chart3ColorStr, colors.chart3),
      mutedFg: getRgbaColorWithAlpha(mutedFgColorStr, 0.5, colors.mutedFg),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // setIsMounted(true); // REMOVE setting isMounted

    const handleResize = (entries: ResizeObserverEntry[]) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        if (
          width > 0 &&
          height > 0 &&
          (width !== dimensions.width || height !== dimensions.height)
        ) {
          setDimensions({ width, height });
          console.log("[NeighborGraph] Resized graph container:", {
            width,
            height,
          });
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    let currentRef: HTMLDivElement | null = null;

    if (containerRef.current) {
      console.log("[NeighborGraph] containerRef.current is available.");
      currentRef = containerRef.current;
      resizeObserver.observe(currentRef);
      const { width, height } = currentRef.getBoundingClientRect();
      console.log("[NeighborGraph] Initial getBoundingClientRect:", {
        width,
        height,
      });
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
        console.log("[NeighborGraph] Initial dimensions set:", {
          width,
          height,
        });
      } else {
        console.warn(
          "[NeighborGraph] Initial measurement returned zero dimensions."
        );
      }
    } else {
      console.error(
        "[NeighborGraph] containerRef.current is NULL when useEffect runs!"
      );
    }

    return () => {
      if (currentRef) {
        resizeObserver.unobserve(currentRef);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNodeClick = useCallback(
    (node: NodeObject /* event: MouseEvent */) => {
      const graphNode = node as GraphNode;
      onNodeClick(graphNode);
    },
    [onNodeClick]
  );

  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(400, 10);
  }, []);

  // Create a memoized map from type to resolved color for legend
  const legendColorMap = useMemo(
    () => ({
      target: colors.chart1,
      tx: colors.chart1,
      block: colors.chart1,
      hop1: colors.chart2,
      address: colors.chart2,
      miner: colors.chart3,
      hop2: colors.chart3,
      default: "#6b7280", // Default fallback color
    }),
    [colors]
  );

  const getNodeColor = useCallback(
    (node: NodeObject) => {
      const graphNode = node as GraphNode;
      let nodeColor = "#6b7280"; // Default fallback gray, declare outside

      // Direct mapping based on type, then fallback
      switch (graphNode.type) {
        case "target":
        case "tx":
        case "block": {
          nodeColor = colors.chart1;
          break;
        }
        case "hop1":
        case "address": {
          nodeColor = colors.chart2;
          break;
        }
        case "miner": {
          nodeColor = colors.chart3; // Ensure miner gets chart3
          break;
        }
        case "hop2": {
          nodeColor = colors.chart3;
          break;
        }
        default: {
          // Fallback based on val or id if type is missing
          const nodeValue = graphNode.val || 0;
          if (graphNode.id === targetNodeId || nodeValue === 8) {
            nodeColor = colors.chart1;
          } else if (nodeValue === 4) {
            nodeColor = colors.chart2;
          } else if (nodeValue === 2) {
            nodeColor = colors.chart3;
          }
          // else nodeColor remains the default fallback gray
          break;
        }
      }
      return nodeColor;
    },
    [colors, targetNodeId] // Depend on colors and targetNodeId for fallback
  );

  const getLinkColor = useCallback(() => {
    return colors.mutedFg;
  }, [colors]);

  const getNodeLabel = useCallback((node: NodeObject) => {
    return truncateAddress((node as GraphNode).id);
  }, []);

  const getLinkLabel = useCallback((link: LinkObject) => {
    return (link as GraphLink).label || "";
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          nodeId="id"
          nodeVal="val"
          nodeLabel={getNodeLabel}
          nodeColor={getNodeColor}
          linkWidth={1}
          linkColor={getLinkColor}
          linkLabel={getLinkLabel}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.01}
          onNodeClick={handleNodeClick}
          onEngineStop={handleEngineStop}
          cooldownTicks={100}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          加载图表中...
        </div>
      )}

      {/* Add Legend Overlay */}
      {legendItems && legendItems.length > 0 && (
        <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm border border-border rounded-md p-2 text-xs text-muted-foreground shadow-md">
          <div className="font-semibold mb-1">图例</div>
          {legendItems.map((item, index) => {
            // Get color directly from the memoized map
            const legendColor =
              legendColorMap[item.type as keyof typeof legendColorMap] ||
              legendColorMap.default;
            return (
              <div key={index} className="flex items-center space-x-1.5 mb-0.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: legendColor }} // Use color from map
                ></span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
