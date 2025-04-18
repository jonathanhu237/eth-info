import { useRef, useCallback, useEffect, useState } from "react";
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
  type: string;
  label: string;
  color?: string; // Add optional color string (e.g., "var(--chart-1)")
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
  legendItems?: LegendItem[]; // Legend items now include color
}

// Removed unused truncateAddress helper
// const truncateAddress = (address: string) => { ... };

export function NeighborGraph({
  graphData,
  // width, // REMOVED
  // height, // REMOVED
  onNodeClick,
  // targetNodeId, // Don't destructure if not directly used
  legendItems = [], // Provide default empty array for legendItems
}: NeighborGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // State to store *resolved* colors (RGBA strings)
  const [resolvedColors, setResolvedColors] = useState<Record<string, string>>(
    {}
  );

  // @ts-expect-error 貌似与全局类型冲突
  const fgRef = useRef<ForceGraphMethods>();
  // const { resolvedTheme } = useTheme(); // REMOVED theme logic for now

  // Effect to get computed CSS variable colors for legend items
  useEffect(() => {
    const computedStyle = window.getComputedStyle(document.documentElement);
    const newResolvedColors: Record<string, string> = {};

    const getRgbaColor = (
      colorStr: string | undefined,
      fallback: string
    ): string => {
      if (!colorStr) return fallback;
      let parsedColor;
      try {
        // Check if it's already a valid color (like #rrggbb or rgba(...))
        parsedColor = parse(colorStr); // Try parsing directly
        if (parsedColor) return formatRgb(converter("rgb")(parsedColor));
      } catch {
        // Removed unused 'e'
        /* Ignore parsing errors for non-CSS vars or invalid direct colors */
      }

      // Try resolving as CSS variable if direct parsing failed
      try {
        const cssVarValue = colorStr.startsWith("var(")
          ? computedStyle.getPropertyValue(colorStr.slice(4, -1)).trim()
          : colorStr; // If not var(), treat as potential direct color/name again

        parsedColor = parse(cssVarValue); // culori parses oklch, hex, names etc.
        if (parsedColor) {
          const rgba = converter("rgb")(parsedColor);
          return formatRgb(rgba);
        }
      } catch {
        // Removed unused 'e'
        console.error(
          `[NeighborGraph] Failed to parse/resolve CSS var or color name: ${colorStr}`
        );
      }
      return fallback;
    };

    legendItems.forEach((item) => {
      if (item.color) {
        newResolvedColors[item.type] = getRgbaColor(item.color, "#6b7280");
      }
    });

    // Also resolve the default muted foreground for links/text
    const mutedFgColorStr = computedStyle
      .getPropertyValue("--muted-foreground")
      .trim();
    newResolvedColors["mutedFg"] = getRgbaColor(
      mutedFgColorStr,
      "rgba(170, 170, 170, 0.5)"
    );
    // Resolve background for potential use
    const bgColorStr = computedStyle.getPropertyValue("--background").trim();
    newResolvedColors["background"] = getRgbaColor(bgColorStr, "#FFFFFF"); // Default white

    setResolvedColors(newResolvedColors);

    console.log(
      "[NeighborGraph] Resolved Colors Map (RGBA):",
      newResolvedColors
    );
  }, [legendItems]); // Re-run if legend items change

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

  // REMOVE the old hardcoded legendColorMap
  // const legendColorMap = useMemo(...);

  // --- Revised getNodeColor using resolvedColors map ---
  const getNodeColor = useCallback(
    (node: NodeObject) => {
      const graphNode = node as GraphNode;
      return resolvedColors[graphNode.type || ""] || "#6b7280";
    },
    [resolvedColors]
  );

  // --- nodeCanvasObject: ONLY draw the node circle ---
  const nodeCanvasObject = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      // const label = graphNode.name || ""; // Label no longer needed here
      // const fontSize = 12 / globalScale; // Font size no longer needed here
      const nodeSize = Math.max(2, (graphNode.val || 4) / globalScale);
      const nodeColor = getNodeColor(graphNode);

      // Draw ONLY the circle
      ctx.beginPath();
      ctx.arc(
        graphNode.x || 0,
        graphNode.y || 0,
        nodeSize,
        0,
        2 * Math.PI,
        false
      );
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // --- REMOVED label drawing logic ---
      // if (globalScale > 0.5) { ... ctx.fillText ... }
    },
    [getNodeColor] // Only depends on getNodeColor now
  );

  // Render the graph only when dimensions are known and non-zero
  const graphReady = dimensions.width > 0 && dimensions.height > 0;

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {/* Legend Display (Uses legendItems directly) */}
      {legendItems && legendItems.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background:
              resolvedColors["background"] || "rgba(255, 255, 255, 0.8)", // Use resolved background
            padding: "8px",
            borderRadius: "4px",
            fontSize: "12px",
            zIndex: 10,
            border: `1px solid ${resolvedColors["mutedFg"] || "#ccc"}`, // Use resolved muted for border
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>图例</div>
          {legendItems.map((item) => (
            <div
              key={item.type}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "2px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: resolvedColors[item.type] || "#6b7280", // Use resolved color for swatch
                  marginRight: "5px",
                }}
              ></span>
              {item.label}
            </div>
          ))}
        </div>
      )}

      {graphReady && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeRelSize={4}
          nodeVal="val"
          nodeColor={getNodeColor}
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => "replace"}
          linkWidth={(link) => (link as GraphLink).width || 1}
          linkColor={(link) =>
            (link as GraphLink).color ||
            resolvedColors["mutedFg"] ||
            "rgba(170, 170, 170, 0.5)"
          }
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={(link) =>
            (link as GraphLink).color ||
            resolvedColors["mutedFg"] ||
            "rgba(170, 170, 170, 0.5)"
          }
          onNodeClick={handleNodeClick}
          onEngineStop={handleEngineStop}
          cooldownTicks={100}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enableNodeDrag={true}
        />
      )}
    </div>
  );
}
