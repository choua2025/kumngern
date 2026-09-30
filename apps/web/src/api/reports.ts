import type {
  ByCategoryReportDto,
  DailyReportDto,
  SummaryReportDto,
  TrendReportDto,
} from '@income-expenses/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './query-keys';

async function getData<T>(url: string, params: object): Promise<T> {
  return (await api.get<{ data: T }>(url, { params })).data.data;
}

export function useSummaryReport(month: string) {
  return useQuery({
    queryKey: queryKeys.reports.summary(month),
    queryFn: () => getData<SummaryReportDto>('/reports/summary', { month }),
  });
}

export function useByCategoryReport(
  from: string,
  to: string,
  type: 'income' | 'expense' = 'expense',
) {
  return useQuery({
    queryKey: queryKeys.reports.byCategory(from, to, type),
    queryFn: () => getData<ByCategoryReportDto>('/reports/by-category', { from, to, type }),
  });
}

export function useTrendReport(months = 6) {
  return useQuery({
    queryKey: queryKeys.reports.trend(months),
    queryFn: () => getData<TrendReportDto>('/reports/trend', { months }),
  });
}

export function useDailyReport(month: string) {
  return useQuery({
    queryKey: queryKeys.reports.daily(month),
    queryFn: () => getData<DailyReportDto>('/reports/daily', { month }),
  });
}
