import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTodayDateString } from '@/lib/bichos';

export interface SpResult {
  id: string;
  draw_date: string;
  draw_time: string;
  prize_1_milhar: string;
  prize_1_group: number;
  prize_1_bicho: string;
  prize_2_milhar: string;
  prize_2_group: number;
  prize_2_bicho: string;
  prize_3_milhar: string;
  prize_3_group: number;
  prize_3_bicho: string;
  prize_4_milhar: string;
  prize_4_group: number;
  prize_4_bicho: string;
  prize_5_milhar: string;
  prize_5_group: number;
  prize_5_bicho: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useTodaySpResults() {
  return useQuery({
    queryKey: ['sp_results', 'today'],
    queryFn: async () => {
      const today = getTodayDateString();
      const { data, error } = await supabase
        .from('sp_results')
        .select('*')
        .eq('draw_date', today)
        .order('draw_time');
      if (error) throw error;
      return (data ?? []) as SpResult[];
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useSpResultsByDate(date: string) {
  return useQuery({
    queryKey: ['sp_results', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sp_results')
        .select('*')
        .eq('draw_date', date)
        .order('draw_time');
      if (error) throw error;
      return (data ?? []) as SpResult[];
    },
    enabled: !!date,
  });
}

export function useRecentSpResults(limit = 500) {
  return useQuery({
    queryKey: ['sp_results', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sp_results')
        .select('*')
        .order('draw_date', { ascending: false })
        .order('draw_time', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as SpResult[];
    },
  });
}
