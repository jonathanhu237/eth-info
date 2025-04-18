import { queryOptions } from "@tanstack/react-query";
import {
  search,
  SearchParams,
  getAddressInfo,
  GetExternalTxParams,
  getExternalTx,
  GetInternalTxParams,
  getInternalTx,
  getTransaction,
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

export const addressExternalTxQueryOptions = ({
  address,
  page,
  page_size,
}: GetExternalTxParams) => {
  return queryOptions({
    queryKey: ["external-tx", address, page, page_size],
    queryFn: () => getExternalTx({ address, page, page_size }),
  });
};

export const addressInternalTxQueryOptions = ({
  address,
  page,
  page_size,
}: GetInternalTxParams) => {
  return queryOptions({
    queryKey: ["internal-tx", address, page, page_size],
    queryFn: () => getInternalTx({ address, page, page_size }),
  });
};

export const transactionQueryOptions = (hash: string) => {
  return queryOptions({
    queryKey: ["transaction", hash],
    queryFn: () => getTransaction(hash),
  });
};
