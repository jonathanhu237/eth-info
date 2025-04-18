import { AddressInfo } from "@/types/address-info";
import {
  AddressExternalTxQuery,
  AddressInternalTxQuery,
} from "@/types/address-tx-query";
import { QueryResult } from "@/types/query-result";
import { Transaction } from "@/types/transaction";
import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
});

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

export const getAddressInfo = async (address: string) => {
  return apiClient
    .get<AddressInfo>(`/address/${address}`)
    .then((res) => res.data);
};

export type GetExternalTxParams = {
  address: string;
  page: number;
  page_size: number;
};

export const getExternalTx = async ({
  address,
  page,
  page_size,
}: GetExternalTxParams) => {
  return apiClient.get<AddressExternalTxQuery>(
    `/address/${address}/transactions`,
    {
      params: {
        page,
        page_size,
      },
    }
  );
};

export type GetInternalTxParams = {
  address: string;
  page: number;
  page_size: number;
};

export const getInternalTx = async ({
  address,
  page,
  page_size,
}: GetInternalTxParams) => {
  return apiClient.get<AddressInternalTxQuery>(`/address/${address}/internal`, {
    params: {
      page,
      page_size,
    },
  });
};

export const getTransaction = async (hash: string) => {
  return apiClient.get<Transaction>(`/transaction/${hash}`);
};
