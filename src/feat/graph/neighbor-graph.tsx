import React, { useRef, useCallback, useEffect, useState } from "react";
// import dynamic from 'next/dynamic'; // REMOVED
// import { useTheme } from "next-themes"; // REMOVED
import ForceGraph2D, {
  ForceGraphMethods,
  NodeObject,
  LinkObject,
} from "react-force-graph-2d";

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

  // @ts-expect-error 貌似与全局类型冲突
  const fgRef = useRef<ForceGraphMethods>();
  // const { resolvedTheme } = useTheme(); // REMOVED theme logic for now

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
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

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
      if (graphNode.id === targetNodeId) return "hsl(var(--primary))";
      // Simplified color logic without theme
      return "rgba(0, 0, 0, 0.6)";
    },
    [targetNodeId]
  );

  const getLinkColor = useCallback((link: LinkObject) => {
    const graphLink = link as GraphLink;
    // Simplified color logic without theme
    return graphLink.color || "rgba(0, 0, 0, 0.2)";
  }, []);

  // Define getNodeLabel again for simple labels
  const getNodeLabel = useCallback((node: NodeObject) => {
    return truncateAddress((node as GraphNode).id);
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
          nodeLabel={getNodeLabel} // Use simple nodeLabel instead of nodeCanvasObject
          // nodeCanvasObjectMode={() => "after"} // REMOVED
          // nodeCanvasObject={/* ... */} // REMOVED
          nodeColor={getNodeColor}
          linkColor={getLinkColor}
          linkWidth={(link: LinkObject) => (link as GraphLink).width || 1}
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
