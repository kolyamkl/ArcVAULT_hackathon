import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/types/api';

// Re-export the API type for consumers
export type { DashboardStats } from '@/types/api';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches aggregated dashboard statistics from the API.
 * Uses the default staleTime (10 s) and refetchInterval (10 s).
 */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.dashboard.getStats(),
  });
}
