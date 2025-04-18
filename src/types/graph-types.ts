// Node structure from /graph/block/{block_number}/content API
export interface BlockGraphApiNode {
  id: string;
  label: string;
  properties: {
    blockNumber?: number; // Make optional as not all nodes might have it
    // Add other potential properties if needed
  };
}

// Response structure for /graph/block/{block_number}/content API
export interface BlockGraphContentResponse {
  nodes: BlockGraphApiNode[];
}
