import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  FederalScheduleRule,
  getFederalScheduleRules,
  setFederalScheduleRules,
} from '@/lib/drawSchedule';

export interface FederalScheduleRow {
  id: string;
  weekday: number;
  draw_hour: number;
  draw_minute: number;
  enabled: boolean;
}

async function fetchFederalSchedule(): Promise<FederalScheduleRow[]> {
  const { data, error } = await supabase
    .from('federal_schedule')
    .select('id, weekday, draw_hour, draw_minute, enabled')
    .order('weekday', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FederalScheduleRow[];
}

function toRules(rows: FederalScheduleRow[]): FederalScheduleRule[] {
  return rows
    .filter((r) => r.enabled)
    .map((r) => ({ weekday: r.weekday, drawHour: r.draw_hour, drawMinute: r.draw_minute, enabled: r.enabled }));
}

/**
 * Sincroniza as regras da Federal (tabela `federal_schedule`) com o módulo
 * `drawSchedule`. Sem regras válidas, os defaults (Qua 20:30 / Dom 11:34) permanecem.
 */
export function useFederalSchedule() {
  const query = useQuery({
    queryKey: ['federal-schedule'],
    queryFn: fetchFederalSchedule,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      const rules = toRules(query.data);
      if (rules.length > 0) setFederalScheduleRules(rules);
    }
  }, [query.data]);

  return {
    rows: query.data ?? [],
    rules: query.data ? toRules(query.data) : getFederalScheduleRules(),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
