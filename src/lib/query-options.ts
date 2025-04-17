import { queryOptions } from "@tanstack/react-query";
import {
  search,
  SearchParams,
  getAddressInfo,
  GetExternalTxParams,
  getExternalTx,
} from "./api";

export const searchQueryOptions = ({ query, limit }: SearchParams) => {
  return queryOptions({
    queryKey: ["search", query, limit],
    queryFn: () => search({ query, limit }),
  });
};

export const addressInfoQueryOptions = (address: string) => {
  return queryOptions({
    queryKey: ["address-info", address],
    queryFn: () => getAddressInfo(address),
  });
};

export const externalTxQueryOptions = ({
  address,
  page,
  page_size,
}: GetExternalTxParams) => {
  return queryOptions({
    queryKey: ["external-tx", address, page, page_size],
    queryFn: () => getExternalTx({ address, page, page_size }),
  });
};
