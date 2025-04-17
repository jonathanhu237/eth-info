export type AddressInfo = {
  address: string;
  is_miner: boolean;
  is_contract: boolean;
  contract_creator: string;
  address_normalized: string;
  external_transactions_count: number;
  internal_transactions_count: number;
  label: string;
  name: string;
  symbol: string;
  labels: {
    address: string;
    chainId: number;
    label: string;
    nameTag: string;
    tag_type: string;
  }[];
  display_name: string;
  address_with_0x: string;
};
