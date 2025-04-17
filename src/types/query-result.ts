export type MatchInfo = {
  matched_field: string;
  matched_value: string;
  match_position: {
    start: number;
    end: number;
  }[];
};

export type TransactionResultItem = {
  type: string;
  id: string;
  hash: string;
  display: string;
  block_number: number;
  from: string;
  to: string;
  value: number;
  date: string;
  source_type: string;
  score: number;
  match_info: MatchInfo;
};

export type AddressResultItem = {
  type: string;
  id: string;
  address: string;
  display: string;
  name: string;
  is_contract: boolean;
  is_miner: boolean;
  labels: string[];
  source_type: string;
  score: number;
  match_info: MatchInfo;
};

export type LabelResultItem = {
  type: string;
  id: string;
  address: string;
  label: string;
  display: string;
  name: string;
  symbol: string;
  website: string;
  type_category: string;
  source_type: string;
  score: number;
  match_info: MatchInfo;
};

export type BlockResultItem = {
  type: string;
  id: string;
  number: number;
  display: string;
  timestamp: number;
  date: string;
  miner: string;
  gas_used: number;
  gas_limit: number;
  size: number;
  source_type: string;
  score: number;
  match_info: MatchInfo;
};

export type QueryResult = {
  query: string;
  status_code: number;
  total_hits: number;
  duration_ms: number;
  results: {
    recommendations?: AddressResultItem[];
    transactions: TransactionResultItem[];
    addresses: AddressResultItem[];
    labels: LabelResultItem[];
    blocks: BlockResultItem[];
    fallback: (
      | TransactionResultItem
      | AddressResultItem
      | LabelResultItem
      | BlockResultItem
    )[];
  };
};
