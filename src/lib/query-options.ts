import { queryOptions } from "@tanstack/react-query";
import { getRandomAddressInfo } from "./api";

export const randomAddressQueryOptions = () => {
  return queryOptions({
    queryKey: ["address-info", "random"],
    queryFn: getRandomAddressInfo,
  });
};
