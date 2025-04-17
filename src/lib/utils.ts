import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { keccak256 } from "ethers"; // 确保导入

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 将地址转换为符合 EIP-55 校验和的大小写格式 (使用 ethers)
export const toChecksumAddress = (address: string): string => {
  if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
    // 无效地址格式，返回原始值或抛出错误
    console.warn(
      "Invalid address format passed to toChecksumAddress:",
      address
    );
    return address;
  }

  const addr = address.toLowerCase().replace("0x", "");
  // ethers的keccak256需要作用于地址的UTF-8字节
  const addressBytes = new TextEncoder().encode(addr); // 使用 TextEncoder 兼容浏览器
  const hash = keccak256(addressBytes).replace("0x", ""); // 计算哈希并移除 '0x' 前缀

  let checksumAddress = "0x";
  for (let i = 0; i < addr.length; i++) {
    // 如果哈希值对应位的数字 >= 8，则将地址对应位的字母大写
    if (parseInt(hash[i], 16) >= 8) {
      checksumAddress += addr[i].toUpperCase();
    } else {
      // 否则保持小写（已经是小写了）
      checksumAddress += addr[i];
    }
  }
  return checksumAddress;
};
