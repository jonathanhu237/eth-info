import { queryOptions } from "@tanstack/react-query";
import { search, SearchParams, getAddressInfo } from "./api";

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
