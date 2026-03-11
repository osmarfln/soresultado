import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTodayDateString } from '@/lib/bichos';
import type { Tables } from '@/integrations/supabase/types';

export type DrawResult = Tables<'draw_results'>;

export function useTodayResults() {
  return useQuery({
    queryKey: ['draw_results', 'today'],
    queryFn: async () => {
      const today = getTodayDateString();
      const { data, error } = await supabase
        .from('draw_results')
        .select('*')
        .eq('draw_date', today)
        .order('draw_time');
      if (error) throw error;
      return data as DrawResult[];
    },
    refetchInterval: 30000, // Poll every 30s
  });
}

export function useResultsByDate(date: string) {
  return useQuery({
    queryKey: ['draw_results', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draw_results')
        .select('*')
        .eq('draw_date', date)
        .order('draw_time');
      if (error) throw error;
      return data as DrawResult[];
    },
    enabled: !!date,
  });
}

export function useRecentResults(limit = 30) {
  return useQuery({
    queryKey: ['draw_results', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draw_results')
        .select('*')
        .order('draw_date', { ascending: false })
        .order('draw_time', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as DrawResult[];
    },
  });
}
