import { AddressInfo } from "@/types/address-info";
import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
});

export const getRandomAddressInfo = async () => {
  return apiClient.get<AddressInfo>("/random/address").then((res) => res.data);
};
