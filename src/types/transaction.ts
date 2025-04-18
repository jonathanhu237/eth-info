export type Transaction = {
  hash: string;
  blockHash: string;
  blockNumber: number;
  transactionIndex: number;
  from: string;
  to: string;
  value: string;
  value_eth: number;
  gas: number;
  gasPrice: string;
  gasCost_eth: number;
  nonce: number;
  input: string;
  type: number;
  chainId: number;
  date: string;
  datetime: string;
  from_normalized: string;
  to_normalized: string;
  hash_normalized: string;
};

export type QueryTxInternalTxRes = {
  transaction_hash: string;
  total_count: number;
  offset: number;
  limit: number;
  internal_transactions: TransactionInternalTx[];
};

export type TransactionInternalTx = {
  hash: string;
  uniqueId: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  value: string;
  value_eth: number;
  date: string;
  datetime: string;
  contract_address: string;
  asset: string;
  category: string;
  from_normalized: string;
  to_normalized: string;
  hash_normalized: string;
};

// --- Types for External Neighbor Graph API ---

// Request Body Part
export type ExternalNeighborInteractionContext = {
  b_address: string; // Address of the 1st hop neighbor
  t1_block_number: number; // Block number of the transaction between target and b_address
};

// Response Body Structure
export type ExternalNeighborLink = {
  transaction: {
    block: number;
    hash: string;
  };
  neighbor_address: {
    address: string;
  };
};

export type ExternalNeighborHop = {
  b_address_string: string;
  initial_tx_block: number;
  second_hop_links: ExternalNeighborLink[];
};

export type ExternalNeighborQueryResult = ExternalNeighborHop[];
