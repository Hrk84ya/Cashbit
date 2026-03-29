import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: 'date_asc' | 'date_desc' | 'amount_asc' | 'amount_desc';
}

export interface CreateTransactionData {
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId: string;
  date: string;
  description?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
  currency?: string;
}

export interface UpdateTransactionData {
  amount?: string;
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  date?: string;
  description?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
  currency?: string;
}

const INVALIDATE_KEYS = ['transactions', 'analytics/summary', 'analytics/trends', 'budgets'];

function invalidateRelated(queryClient: ReturnType<typeof useQueryClient>) {
  INVALIDATE_KEYS.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
      );
      const { data } = await apiClient.get('/transactions', { params });
      return data.data as {
        transactions: any[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalCount: number;
          hasNextPage: boolean;
        };
      };
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTransactionData) => {
      const { data } = await apiClient.post('/transactions', body);
      return data.data;
    },
    onSuccess: () => invalidateRelated(queryClient),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateTransactionData & { id: string }) => {
      const { data } = await apiClient.put(`/transactions/${id}`, body);
      return data.data;
    },
    onSuccess: () => invalidateRelated(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/transactions/${id}`);
      return data.data;
    },
    onSuccess: () => invalidateRelated(queryClient),
  });
}

export function useExportTransactions() {
  return useMutation({
    mutationFn: async (params?: { type?: string; categoryId?: string; startDate?: string; endDate?: string }) => {
      const { data } = await apiClient.get('/transactions/export', {
        params,
        responseType: 'blob',
      });
      return data as Blob;
    },
  });
}
