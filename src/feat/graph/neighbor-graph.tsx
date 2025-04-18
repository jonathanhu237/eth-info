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
  color?: string;
  val?: number; // Example: for node size
}

export interface GraphLink extends LinkObject {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  color?: string;
  width?: number;
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
      primary: getRgbaColor(primaryColorStr, colors.primary), // Keep primary separate for potential future use
      chart1: getRgbaColor(chart1ColorStr, colors.chart1), // Store chart-1
      chart2: getRgbaColor(chart2ColorStr, colors.chart2), // Store chart-2
      chart3: getRgbaColor(chart3ColorStr, colors.chart3), // Store chart-3
      mutedFg: getRgbaColorWithAlpha(mutedFgColorStr, 0.5, colors.mutedFg), // Set 0.5 alpha for mutedFg
    });

    console.log("[NeighborGraph] Resolved Colors (RGBA):", {
      primary: getRgbaColor(primaryColorStr, colors.primary),
      chart1: getRgbaColor(chart1ColorStr, colors.chart1),
      chart2: getRgbaColor(chart2ColorStr, colors.chart2),
      chart3: getRgbaColor(chart3ColorStr, colors.chart3),
      mutedFg: getRgbaColorWithAlpha(mutedFgColorStr, 0.5, colors.mutedFg),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // CORRECT: Run once on mount

  useEffect(() => {
    // setIsMounted(true); // REMOVE setting isMounted

    const handleResize = (entries: ResizeObserverEntry[]) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        // Only update if dimensions actually change and are positive
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
      // Initial measurement
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
  }, []); // CORRECT: Run once on mount

  const handleNodeClick = useCallback(
    (node: NodeObject /* event: MouseEvent */) => {
      const graphNode = node as GraphNode;
      onNodeClick(graphNode);
      // Keep node interaction simple for now
      // fgRef.current?.centerAt(node.x, node.y, 1000);
      // fgRef.current?.zoom(4, 1000);
    },
    [onNodeClick]
  );

  // Callback when the force simulation engine stops
  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(400, 10); // Zoom to fit all nodes with padding
  }, []);

  const getNodeColor = useCallback(
    (node: NodeObject) => {
      const graphNode = node as GraphNode;
      // Determine node type based on `val` (a bit fragile, but works for now)
      const nodeValue = graphNode.val || 0;
      if (graphNode.id === targetNodeId || nodeValue === 8) {
        return colors.chart1; // Target node: Use resolved chart-1 color
      } else if (nodeValue === 4) {
        return colors.chart2; // 1st hop: Use resolved chart-2 color
      } else if (nodeValue === 2) {
        return colors.chart3; // 2nd hop: Use resolved chart-3 color
      }
      return "#6b7280"; // Fallback gray
    },
    [targetNodeId, colors] // Depend on resolved colors
  );

  const getLinkColor = useCallback(
    () => {
      // Or remove link param if truly unused
      return colors.mutedFg; // Use pre-calculated rgba string with alpha
    },
    [colors] // Depend on resolved colors
  );

  // Define getNodeLabel again for simple labels
  const getNodeLabel = useCallback((node: NodeObject) => {
    return truncateAddress((node as GraphNode).id);
  }, []);

  // Define getLinkLabel
  const getLinkLabel = useCallback((link: LinkObject) => {
    return (link as GraphLink).label || "";
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={dimensions.width} // Use dynamic width
          height={dimensions.height} // Use dynamic height
          nodeId="id"
          nodeVal={(node) => (node as GraphNode).val || 2}
          nodeRelSize={4}
          nodeLabel={getNodeLabel}
          linkLabel={getLinkLabel} // Add linkLabel prop
          // nodeCanvasObjectMode={() => "after"} // REMOVED
          // nodeCanvasObject={/* ... */} // REMOVED
          nodeColor={getNodeColor}
          linkColor={getLinkColor}
          linkWidth={(link: LinkObject) => (link as GraphLink).width || 1.5} // 稍微加粗链接
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.006}
          onNodeClick={handleNodeClick}
          cooldownTicks={100}
          onEngineStop={handleEngineStop}
        />
      ) : (
        <div className="text-center text-muted-foreground p-4 text-sm">
          Waiting for container dimensions... (Current: {dimensions.width}x
          {dimensions.height})
        </div>
      )}
    </div>
  );
}
