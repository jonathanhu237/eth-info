import { queryOptions } from "@tanstack/react-query";
import { getRandomAddressInfo, search, SearchParams } from "./api";

export const randomAddressQueryOptions = () => {
  return queryOptions({
    queryKey: ["address-info", "random"],
    queryFn: getRandomAddressInfo,
  });
};

export const searchQueryOptions = ({ query, limit }: SearchParams) => {
  return queryOptions({
    queryKey: ["search", query, limit],
    queryFn: () => search({ query, limit }),
  });
};
