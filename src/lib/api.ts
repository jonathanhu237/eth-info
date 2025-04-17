import { AddressInfo } from "@/types/address-info";
import { QueryResult } from "@/types/query-result";
import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
});

export const getRandomAddressInfo = async () => {
  return apiClient.get<AddressInfo>("/random/address").then((res) => res.data);
};

export type SearchParams = {
  query?: string;
  limit: number;
};

export const search = async ({ query, limit }: SearchParams) => {
  return apiClient.get<QueryResult>("/search", {
    params: {
      query,
      limit,
    },
  });
};
