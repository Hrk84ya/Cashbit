import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

export interface TrendsParams {
  startDate: string;
  endDate: string;
  groupBy: 'week' | 'month';
  categoryId?: string;
}

export function useSummary(month: string) {
  return useQuery({
    queryKey: ['analytics/summary', month],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/summary', { params: { month } });
      return data.data as {
        totalIncome: string;
        totalExpenses: string;
        netBalance: string;
        byCategory: { categoryId: string; categoryName: string; total: string; percentage: number }[];
        previousMonth: { totalIncome: string; totalExpenses: string };
      };
    },
    enabled: !!month,
  });
}

export function useTrends(params: TrendsParams) {
  return useQuery({
    queryKey: ['analytics/trends', params],
    queryFn: async () => {
      const queryParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
      );
      const { data } = await apiClient.get('/analytics/trends', { params: queryParams });
      return data.data as {
        trends: { period: string; income: string; expenses: string }[];
      };
    },
    enabled: !!params.startDate && !!params.endDate && !!params.groupBy,
  });
}
