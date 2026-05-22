import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BICHOS: Record<number, { name: string; emoji: string }> = {
  1: { name: 'Avestruz', emoji: '🦢' }, 2: { name: 'Águia', emoji: '🦅' },
  3: { name: 'Burro', emoji: '🫏' }, 4: { name: 'Borboleta', emoji: '🦋' },
  5: { name: 'Cachorro', emoji: '🐕' }, 6: { name: 'Cabra', emoji: '🐐' },
  7: { name: 'Carneiro', emoji: '🐏' }, 8: { name: 'Camelo', emoji: '🐫' },
  9: { name: 'Cobra', emoji: '🐍' }, 10: { name: 'Coelho', emoji: '🐇' },
  11: { name: 'Cavalo', emoji: '🐴' }, 12: { name: 'Elefante', emoji: '🐘' },
  13: { name: 'Galo', emoji: '🐓' }, 14: { name: 'Gato', emoji: '🐱' },
  15: { name: 'Jacaré', emoji: '🐊' }, 16: { name: 'Leão', emoji: '🦁' },
  17: { name: 'Macaco', emoji: '🐒' }, 18: { name: 'Porco', emoji: '🐷' },
  19: { name: 'Pavão', emoji: '🦚' }, 20: { name: 'Peru', emoji: '🦃' },
  21: { name: 'Touro', emoji: '🐂' }, 22: { name: 'Tigre', emoji: '🐅' },
  23: { name: 'Urso', emoji: '🐻' }, 24: { name: 'Veado', emoji: '🦌' },
  25: { name: 'Vaca', emoji: '🐄' },
};

interface HistoricalStats {
  group: number;
  name: string;
  emoji: string;
  totalAppearances: number;
  recentAppearances: number; // last 10 draws
  lastSeenDrawsAgo: number;
  weightedScore: number;
  strengthIndex: number; // Calculated field
  firstPrizeCount: number;
  trend: 'hot' | 'cold' | 'neutral';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let lottery = 'rio';
    try {
      const body = await req.json();
      lottery = body.lottery || 'rio';
    } catch {}

    const tables = ['draw_results', 'capital_results', 'sp_results', 'federal_results'];
    const selectedTable = lottery === 'capital' ? 'capital_results' : lottery === 'federal' ? 'federal_results' : lottery === 'sp' ? 'sp_results' : 'draw_results';

    // Fetch data for specific lottery
    // Increased to 1000 to cover approximately 10 days of results for Rio (multiple draws/day)
    const { data: specificResults, error: specificError } = await supabase
      .from(selectedTable)
      .select('*')
      .order('draw_date', { ascending: false })
      .order('draw_time', { ascending: false })
      .limit(1000);

    if (specificError) throw specificError;

    // Fetch data from ALL lotteries for global delay analysis
    // Each lottery has multiple draws per day, so 500 per table is safer for a 10-day global perspective
    const globalResultsPromises = tables.map(t => 
      supabase.from(t).select('*').order('draw_date', { ascending: false }).limit(500)
    );
    const globalResultsRaw = await Promise.all(globalResultsPromises);
    const allResults = globalResultsRaw.flatMap(r => r.data || []);

    if (!specificResults || specificResults.length === 0) {
      return new Response(JSON.stringify({ error: 'No historical data available' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 1. Enhanced Statistical Analysis ---
    
    // Last 10 draws specifically for "current strength"
    const last10 = specificResults.slice(0, 10);
    const recentStats = new Map<number, number>();
    BICHOS_KEYS().forEach(g => recentStats.set(g, 0));
    
    last10.forEach(r => {
      for (let p = 1; p <= 5; p++) {
        const g = r[`prize_${p}_group`] as number;
        recentStats.set(g, (recentStats.get(g) || 0) + 1);
      }
    });

    // Sum of results (extração da soma)
    const sumAnalysis = specificResults.slice(0, 5).map(r => {
      let totalSum = 0;
      for (let p = 1; p <= 5; p++) {
        totalSum += parseInt(r[`prize_${p}_milhar`] || '0', 10);
      }
      return { date: r.draw_date, time: r.draw_time, sum: totalSum };
    });

    const avgSum = sumAnalysis.reduce((acc, curr) => acc + curr.sum, 0) / sumAnalysis.length;

    // Statistics loop
    const stats: HistoricalStats[] = [];
    BICHOS_KEYS().forEach(g => {
      const bicho = BICHOS[g];
      let total = 0;
      let weighted = 0;
      let firstPrize = 0;
      let lastIdx = specificResults.length;

      specificResults.forEach((r, idx) => {
        for (let p = 1; p <= 5; p++) {
          if (r[`prize_${p}_group`] === g) {
            total++;
            weighted += (6 - p);
            if (p === 1) firstPrize++;
            if (idx < lastIdx) lastIdx = idx;
          }
        }
      });

      const recentCount = recentStats.get(g) || 0;
      // Strength Index calculation: (Weighted * 0.4) + (Recent * 1.5) + (FirstPrize * 2) - (Delay * 0.1)
      const strengthIndex = (weighted * 0.4) + (recentCount * 5) + (firstPrize * 3) - (lastIdx * 0.5);

      stats.push({
        group: g,
        name: bicho.name,
        emoji: bicho.emoji,
        totalAppearances: total,
        recentAppearances: recentCount,
        lastSeenDrawsAgo: lastIdx,
        weightedScore: weighted,
        strengthIndex: parseFloat(strengthIndex.toFixed(2)),
        firstPrizeCount: firstPrize,
        trend: recentCount > 2 ? 'hot' : lastIdx > 15 ? 'cold' : 'neutral'
      });
    });

    // --- 2. Delayed Analysis (Global) ---
    const dezenaStats = new Map<string, number>();
    allResults.forEach(r => {
      for (let p = 1; p <= 5; p++) {
        const milhar = r[`prize_${p}_milhar`] as string;
        if (milhar && milhar.length >= 2) {
          const dz = milhar.slice(-2);
          if (!dezenaStats.has(dz)) dezenaStats.set(dz, 0);
          dezenaStats.set(dz, dezenaStats.get(dz)! + 1);
        }
      }
    });

    // Find delayed dezenas (simplified: not appearing in last X global results)
    const delayedDezenas = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'))
      .map(dz => {
        let delay = 0;
        const found = allResults.findIndex(r => {
          for (let p = 1; p <= 5; p++) {
            if ((r[`prize_${p}_milhar`] as string)?.endsWith(dz)) return true;
          }
          return false;
        });
        return { dezena: dz, delay: found === -1 ? allResults.length : found };
      })
      .sort((a, b) => b.delay - a.delay)
      .slice(0, 10);

    // --- 3. AI Generation with context ---
    const sortedByStrength = [...stats].sort((a, b) => b.strengthIndex - a.strengthIndex);
    
    const prompt = `Analista estatístico do Jogo do Bicho.
Loteria: ${lottery}. Analisados ${specificResults.length} sorteios (correspondendo aproximadamente aos últimos 10 dias).
Média das somas recentes: ${avgSum.toFixed(0)}.

Top Grupos Fortes (Índice de Força):
${sortedByStrength.slice(0, 5).map(s => `G${s.group} ${s.name}: Força ${s.strengthIndex}, ${s.recentAppearances}x nos últimos 10 jogos`).join('\n')}

Mais Atrasados (Global):
${delayedDezenas.slice(0, 5).map(d => `Dezena ${d.dezena}: Atraso de ${d.delay} sorteios`).join('\n')}

Sugerir centenas baseadas na soma média (${avgSum.toFixed(0)}) e dezenas atrasadas.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você é um especialista em padrões numéricos e loterias. Use análise de frequência e atrasos.' },
          { role: 'user', content: prompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_predictions',
            description: 'Gera previsões precisas',
            parameters: {
              type: 'object',
              properties: {
                predictions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      group: { type: 'number' },
                      name: { type: 'string' },
                      probability: { type: 'number' },
                      reason: { type: 'string' }
                    }
                  }
                },
                analysis: { type: 'string' },
                hot_picks: { type: 'array', items: { type: 'number' } },
                cold_picks: { type: 'array', items: { type: 'number' } },
                suggested_milhares: { type: 'array', items: { type: 'string' } },
                suggested_centenas: { type: 'array', items: { type: 'string' } },
                confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              required: ['predictions', 'analysis', 'hot_picks', 'cold_picks', 'suggested_milhares', 'suggested_centenas', 'confidence']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_predictions' } }
      })
    });

    const aiData = await aiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);

    // Add emojis
    result.predictions = result.predictions.map((p: any) => ({
      ...p,
      emoji: BICHOS[p.group]?.emoji || '❓'
    }));

    const dates = specificResults.map((r: any) => r.draw_date).filter(Boolean).sort();
    return new Response(JSON.stringify({
      success: true,
      lottery,
      total_draws_analyzed: specificResults.length,
      date_range: { from: dates[0] || '', to: dates[dates.length - 1] || '' },
      stats: stats,
      dezena_delays: delayedDezenas.map((d: any) => ({
        dezena: d.dezena,
        group: 1,
        lastSeenDrawsAgo: d.delay,
        totalAppearances: 0,
      })),
      sum_analysis: {
        recent_avg: avgSum,
        history: sumAnalysis
      },
      global_delays: {
        dezenas: delayedDezenas
      },
      ai_predictions: result,
      generated_at: new Date().toISOString()
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function BICHOS_KEYS() {
  return Array.from({ length: 25 }, (_, i) => i + 1);
}
