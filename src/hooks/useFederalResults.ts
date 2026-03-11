import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FederalResult {
  id: string;
  draw_date: string;
  draw_number: string | null;
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

export function useLatestFederalResult() {
  return useQuery({
    queryKey: ['federal_results', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('federal_results' as any)
        .select('*')
        .order('draw_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as FederalResult | null;
    },
    refetchInterval: 60000,
  });
}

export function useRecentFederalResults(limit = 50) {
  return useQuery({
    queryKey: ['federal_results', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('federal_results' as any)
        .select('*')
        .order('draw_date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as FederalResult[];
    },
  });
}
