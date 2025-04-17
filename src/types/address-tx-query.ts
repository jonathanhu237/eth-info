export type AddressExternalTxQuery = {
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

export type AddressInternalTxQuery = {
  address: string;
  total: number;
  page: number;
  page_size: number;
  transactions: {
    hash: string;
    block_number: number;
    timestamp: number;
    from_address: string;
    to_address: string;
    value: string;
    value_raw: string;
    contract_address: string;
  }[];
};
