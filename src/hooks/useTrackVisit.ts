import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useTrackVisit(page = '/') {
  useEffect(() => {
    const now = new Date();
    const brDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const brHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(now),
      10
    );

    supabase
      .from('page_visits')
      .insert({ page, visit_date: brDate, visit_hour: brHour })
      .then(({ error }) => {
        if (error) console.error('Visit tracking error:', error.message);
      });
  }, [page]);
}
