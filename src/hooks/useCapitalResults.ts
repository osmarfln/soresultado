import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTodayDateString } from '@/lib/bichos';

export interface CapitalResult {
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

export function useTodayCapitalResults() {
  return useQuery({
    queryKey: ['capital_results', 'today'],
    queryFn: async () => {
      const today = getTodayDateString();

      const { data, error } = await supabase
        .from('capital_results')
        .select('*')
        .eq('draw_date', today)
        .order('draw_time');
      if (error) throw error;

      if (data && data.length > 0) return data as CapitalResult[];

      const { data: latest, error: latestError } = await supabase
        .from('capital_results')
        .select('*')
        .order('draw_date', { ascending: false })
        .order('draw_time')
        .limit(20);
      if (latestError) throw latestError;

      if (!latest || latest.length === 0) return [] as CapitalResult[];

      const latestDate = latest[0].draw_date;
      return latest.filter(r => r.draw_date === latestDate) as CapitalResult[];
    },
    refetchInterval: 30000,
  });
}

export function useCapitalResultsByDate(date: string) {
  return useQuery({
    queryKey: ['capital_results', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capital_results')
        .select('*')
        .eq('draw_date', date)
        .order('draw_time');
      if (error) throw error;
      return data as CapitalResult[];
    },
    enabled: !!date,
  });
}
