import { AddressInfo } from "@/types/address-info";
import {
  AddressExternalTxQuery,
  AddressInternalTxQuery,
} from "@/types/address-tx-query";
import { BlockInfo, BlockTxQuery } from "@/types/block-info";
import { QueryResult } from "@/types/query-result";
import {
  QueryTxInternalTxRes,
  Transaction,
  ExternalNeighborInteractionContext,
  ExternalNeighborQueryResult,
} from "@/types/transaction";
import axios from "axios";
import {
  BlockGraphContentResponse,
  TxNeighborResponse,
} from "@/types/graph-types";

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

export type GetTxInternalTxParams = {
  hash: string;
  offset: number;
  limit: number;
};

export const getTxInternalTx = async ({
  hash,
  offset,
  limit,
}: GetTxInternalTxParams) => {
  return apiClient.get<QueryTxInternalTxRes>(`/transaction/${hash}/internal`, {
    params: {
      offset,
      limit,
    },
  });
};

export const getBlockInfo = async (block_number: number) => {
  return apiClient.get<BlockInfo>(`/block/${block_number}`);
};

export type GetBlockTxParams = {
  block_number: number;
  offset: number;
  limit: number;
};

export const getBlockTx = async ({
  block_number,
  offset,
  limit,
}: GetBlockTxParams) => {
  return apiClient.get<BlockTxQuery>(`/block/${block_number}/transactions`, {
    params: {
      offset,
      limit,
    },
  });
};

// --- External Neighbors API ---
export type GetExternalNeighborsParams = {
  target_address: string;
  interactions_context: ExternalNeighborInteractionContext[];
  busy_threshold?: number; // 可选参数
  block_window?: number; // 可选参数
  base_hop2_limit?: number; // 可选参数
  max_hop2_limit?: number; // 可选参数
};

export const getExternalNeighbors = async ({
  target_address,
  interactions_context,
  busy_threshold = 1000, // 设置默认值
  block_window = 6,
  base_hop2_limit = 10,
  max_hop2_limit = 50,
}: GetExternalNeighborsParams) => {
  // Log the exact payload being sent
  const payload = {
    target_address,
    interactions_context,
    busy_threshold,
    block_window,
    base_hop2_limit,
    max_hop2_limit,
  };
  console.log(
    "Frontend API Call Payload (/graph/neighbors/external):",
    JSON.stringify(payload, null, 2)
  ); // Log the payload

  return apiClient.post<ExternalNeighborQueryResult>(
    `/graph/neighbors/external`,
    payload // Send the constructed payload
  );
};

// --- Internal Neighbors API (Assuming similar structure) ---
export type GetInternalNeighborsParams = GetExternalNeighborsParams; // Reuse type for now

export const getInternalNeighbors = async ({
  target_address,
  interactions_context,
  busy_threshold = 1000,
  block_window = 6,
  base_hop2_limit = 10,
  max_hop2_limit = 50,
}: GetInternalNeighborsParams) => {
  // Log the exact payload being sent
  const payload = {
    target_address,
    interactions_context,
    busy_threshold,
    block_window,
    base_hop2_limit,
    max_hop2_limit,
  };
  console.log(
    "Frontend API Call Payload (/graph/neighbors/internal):",
    JSON.stringify(payload, null, 2)
  );

  // Assuming ExternalNeighborQueryResult structure is reused, adjust if needed
  return apiClient.post<ExternalNeighborQueryResult>(
    `/graph/neighbors/internal`, // Target the internal endpoint
    payload
  );
};

// --- Block Graph Content API ---
export const getBlockGraphContent = async (block_number: number) => {
  console.log(`Fetching block graph content for block: ${block_number}`);
  return apiClient.get<BlockGraphContentResponse>(
    `/graph/block/${block_number}/content`
  );
};

// --- Transaction Neighbors API ---
export interface GetTxNeighborsParams {
  tx_hash: string;
  busy_threshold?: number;
  block_window?: number;
  base_hop2_limit?: number;
  max_hop2_limit?: number;
}

export const getTxNeighbors = async ({
  tx_hash,
  busy_threshold = 1000,
  block_window = 60,
  base_hop2_limit = 20,
  max_hop2_limit = 100,
}: GetTxNeighborsParams) => {
  console.log(`Fetching tx neighbors for hash: ${tx_hash}`);
  return apiClient.get<TxNeighborResponse>(
    `/graph/transaction/${tx_hash}/neighbors`,
    {
      params: {
        busy_threshold,
        block_window,
        base_hop2_limit,
        max_hop2_limit,
      },
    }
  );
};
