import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await apiClient.get('/profile');
      return data.data as { id: string; email: string; name: string; preferredCurrency: string; timezone: string; createdAt: string };
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name?: string; timezone?: string }) => {
      const { data } = await apiClient.patch('/profile', body);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      const { data } = await apiClient.post('/profile/change-password', body);
      return data.data;
    },
  });
}

export function useChangeCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { currency: string; conversionRate: number }) => {
      const { data } = await apiClient.post('/profile/change-currency', body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['analytics/summary'] });
      qc.invalidateQueries({ queryKey: ['analytics/trends'] });
    },
  });
}

export function useUploadReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ transactionId, file }: { transactionId: string; file: File }) => {
      const formData = new FormData();
      formData.append('receipt', file);
      const { data } = await apiClient.post(`/uploads/${transactionId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); },
  });
}
