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
