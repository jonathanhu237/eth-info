import { MinorInfo } from "./minor-info";

export type AddressInfo = {
  address: string;
  is_miner: boolean;
  is_contract: boolean;
  contract_creator: string;
  address_normalized: string;
  minor_info: MinorInfo;
};
