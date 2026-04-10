import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

export interface RecurringPattern {
  description: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  type: 'INCOME' | 'EXPENSE';
  averageAmount: string;
  currency: string;
  occurrences: number;
  frequency: 'monthly' | 'weekly';
  lastDate: string;
  nextExpectedDate: string;
  transactions: {
    id: string;
    amount: string;
    date: string;
    paymentMethod: string;
  }[];
}

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      const { data } = await apiClient.get('/recurring');
      return data.data as RecurringPattern[];
    },
  });
}
