import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Sponsor = Tables<'sponsors'>;

export function useSponsors(position?: string) {
  return useQuery({
    queryKey: ['sponsors', position],
    queryFn: async () => {
      let query = supabase
        .from('sponsors')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (position) {
        query = query.eq('position', position);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Sponsor[];
    },
  });
}
