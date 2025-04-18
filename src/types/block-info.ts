export type BlockInfo = {
  hash: string;
  number: number;
  timestamp: number;
  miner: string;
  parentHash: string;
  nonce: string;
  difficulty: string;
  gasLimit: number;
  gasUsed: number;
  baseFeePerGas: string;
  size: number;
  date: string;
  datetime: string;
};

export type BlockTxQuery = {
  block_number: number;
  total_count: number;
  offset: number;
  limit: number;
  transactions: BlockTx[];
};

export type BlockTx = {
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
