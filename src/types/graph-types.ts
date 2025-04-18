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

// --- Transaction Neighbors Graph Types ---

// Structure of the link object within second_hop_links
export interface TxSecondHopLink {
  transaction: {
    id: string;
    block: number;
    type: string;
    hash: string | null; // Hash can be null based on error
    uniqueId: string | null;
  };
  neighbor_address: {
    id: string;
    address: string;
  };
}

// Structure of the single element in the main response array
export interface TxNeighborContext {
  b_node_id: string;
  b_address_string: string;
  initial_tx_block: number;
  second_hop_links: TxSecondHopLink[];
}

// Response structure for /graph/transaction/{tx_hash}/neighbors API
export type TxNeighborResponse = TxNeighborContext[]; // Array containing a single context element
