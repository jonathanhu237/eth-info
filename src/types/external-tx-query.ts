export type ExternalTxQuery = {
  address: string;
  total: number;
  page: number;
  page_size: number;
  transactions: {
    hash: string;
    block_number: number;
    transaction_index: number;
    timestamp: string;
    from_address: string;
    to_address: string;
    value: string;
    value_raw: string;
  }[];
};
