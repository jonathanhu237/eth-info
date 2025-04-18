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
  GetTxInternalTxParams,
  getTxInternalTx,
  getBlockInfo,
  GetBlockTxParams,
  getBlockTx,
  getExternalNeighbors,
  GetExternalNeighborsParams,
  getInternalNeighbors,
  GetInternalNeighborsParams,
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

export const txInternalTxQueryOptions = ({
  hash,
  offset,
  limit,
}: GetTxInternalTxParams) => {
  return queryOptions({
    queryKey: ["tx-internal-tx", hash, offset, limit],
    queryFn: () => getTxInternalTx({ hash, offset, limit }),
  });
};

export const getBlockInfoQueryOptions = (block_number: number) => {
  return queryOptions({
    queryKey: ["block-info", block_number],
    queryFn: () => getBlockInfo(block_number),
  });
};

export const getBlockTxQueryOptions = ({
  block_number,
  offset,
  limit,
}: GetBlockTxParams) => {
  return queryOptions({
    queryKey: ["block-tx", block_number, offset, limit],
    queryFn: () => getBlockTx({ block_number, offset, limit }),
  });
};

// --- Query Options for External Neighbors ---
export const externalNeighborsQueryOptions = ({
  target_address,
  interactions_context,
  busy_threshold,
  block_window,
  base_hop2_limit,
  max_hop2_limit,
}: GetExternalNeighborsParams) => {
  const contextKey = JSON.stringify(
    interactions_context
      .map((c) => `${c.b_address}-${c.t1_block_number}`)
      .sort()
  );

  return queryOptions({
    queryKey: [
      "external-neighbors",
      target_address,
      contextKey,
      busy_threshold,
      block_window,
      base_hop2_limit,
      max_hop2_limit,
    ],
    queryFn: () =>
      getExternalNeighbors({
        target_address,
        interactions_context,
        busy_threshold,
        block_window,
        base_hop2_limit,
        max_hop2_limit,
      }),
  });
};

// --- Query Options for Internal Neighbors ---
export const internalNeighborsQueryOptions = ({
  target_address,
  interactions_context,
  busy_threshold,
  block_window,
  base_hop2_limit,
  max_hop2_limit,
}: GetInternalNeighborsParams) => {
  const contextKey = JSON.stringify(
    interactions_context
      .map((c) => `${c.b_address}-${c.t1_block_number}`)
      .sort()
  );

  return queryOptions({
    queryKey: [
      "internal-neighbors",
      target_address,
      contextKey,
      busy_threshold,
      block_window,
      base_hop2_limit,
      max_hop2_limit,
    ],
    queryFn: () =>
      getInternalNeighbors({
        target_address,
        interactions_context,
        busy_threshold,
        block_window,
        base_hop2_limit,
        max_hop2_limit,
      }),
  });
};
