import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-exports from the canonical formatting module.
// Consumers that import from '@/lib/utils' continue to work.
export {
  formatCurrency,
  formatCompact,
  shortenAddress,
  truncateAddress,
  formatRelativeTime,
  formatAPY,
} from './format';
