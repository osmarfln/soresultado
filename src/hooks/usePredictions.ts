import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BichoPrediction {
  group: number;
  name: string;
  emoji: string;
  probability: number;
  reason: string;
}

export interface PredictionResult {
  success: boolean;
  lottery: string;
  total_draws_analyzed: number;
  date_range: { from: string; to: string };
  stats: Array<{
    group: number;
    name: string;
    emoji: string;
    totalAppearances: number;
    recentAppearances: number;
    lastSeenDrawsAgo: number;
    weightedScore: number;
    firstPrizeCount: number;
    trend: 'hot' | 'cold' | 'neutral';
  }>;
  ai_predictions: {
    predictions: BichoPrediction[];
    analysis: string;
    hot_picks: number[];
    cold_picks: number[];
    suggested_milhares: string[];
    confidence: 'low' | 'medium' | 'high';
  } | null;
  generated_at: string;
}

export function usePredictions(lottery: 'rio' | 'capital') {
  return useQuery({
    queryKey: ['predictions', lottery],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('predict-bicho', {
        body: { lottery },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as PredictionResult;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });
}
