import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TickerSettings {
  id: string;
  message: string;
  bg_color: string;
  text_color: string;
  font_size: string;
  font_family: string;
  speed: number;
  is_active: boolean;
}

export function useTicker() {
  return useQuery({
    queryKey: ['ticker_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticker_settings' as any)
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TickerSettings;
    },
    refetchInterval: 30000,
  });
}

export function useUpdateTicker() {
  const queryClient = useQueryClient();

  return async (updates: Partial<Omit<TickerSettings, 'id'>>) => {
    const { data: existing } = await supabase
      .from('ticker_settings' as any)
      .select('id')
      .limit(1)
      .single();

    if (!existing) throw new Error('No ticker settings found');

    const { error } = await supabase
      .from('ticker_settings' as any)
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', (existing as any).id);

    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ['ticker_settings'] });
  };
}
