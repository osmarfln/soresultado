import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to Supabase Realtime on all result tables and invalidates
 * the matching react-query caches so the UI refreshes the moment a new
 * result is inserted/updated by the scraping robots.
 */
export function useRealtimeResults() {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidate = (key: string) => {
      qc.invalidateQueries({ queryKey: [key] });
    };

    const channel = supabase
      .channel('results-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draw_results' }, () => invalidate('draw_results'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sp_results' }, () => invalidate('sp_results'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'capital_results' }, () => invalidate('capital_results'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'federal_results' }, () => invalidate('federal_results'))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
