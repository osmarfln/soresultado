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
  recentAppearances: number; // last 3 days
  lastSeenDrawsAgo: number;
  weightedScore: number; // 1st prize=5pts, 2nd=4, etc.
  firstPrizeCount: number;
  trend: 'hot' | 'cold' | 'neutral';
}

function toDateStringBRT(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
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

    const tableName = lottery === 'capital' ? 'capital_results' : lottery === 'federal' ? 'federal_results' : 'draw_results';

    // Fetch last 200 results for analysis
    const { data: results, error } = await supabase
      .from(tableName)
      .select('*')
      .order('draw_date', { ascending: false })
      .order('draw_time', { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ error: 'No historical data available' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Compute statistics
    const dates = [...new Set(results.map(r => r.draw_date))].sort().reverse();
    const recentDates = new Set(dates.slice(0, 3));

    const stats: Map<number, {
      total: number; recent: number; weighted: number;
      firstPrize: number; lastIdx: number;
    }> = new Map();

    for (let g = 1; g <= 25; g++) {
      stats.set(g, { total: 0, recent: 0, weighted: 0, firstPrize: 0, lastIdx: results.length });
    }

    results.forEach((r, idx) => {
      const isRecent = recentDates.has(r.draw_date);
      for (let p = 1; p <= 5; p++) {
        const group = r[`prize_${p}_group`] as number;
        const s = stats.get(group);
        if (!s) continue;
        s.total++;
        if (isRecent) s.recent++;
        s.weighted += (6 - p); // 5,4,3,2,1
        if (p === 1) s.firstPrize++;
        if (idx < s.lastIdx) s.lastIdx = idx;
      }
    });

    const totalDraws = results.length;
    const avgPerGroup = (totalDraws * 5) / 25;
    const recentDraws = results.filter(r => recentDates.has(r.draw_date)).length;
    const avgRecentPerGroup = recentDraws > 0 ? (recentDraws * 5) / 25 : 1;

    const historicalStats: HistoricalStats[] = [];
    for (let g = 1; g <= 25; g++) {
      const s = stats.get(g)!;
      const bicho = BICHOS[g];
      const recentRate = recentDraws > 0 ? s.recent / (recentDraws * 5) : 0;
      const avgRate = s.total / (totalDraws * 5);
      const trend: 'hot' | 'cold' | 'neutral' =
        recentRate > avgRate * 1.3 ? 'hot' :
        recentRate < avgRate * 0.7 ? 'cold' : 'neutral';

      historicalStats.push({
        group: g,
        name: bicho.name,
        emoji: bicho.emoji,
        totalAppearances: s.total,
        recentAppearances: s.recent,
        lastSeenDrawsAgo: s.lastIdx >= totalDraws ? totalDraws : s.lastIdx,
        weightedScore: s.weighted,
        firstPrizeCount: s.firstPrize,
        trend,
      });
    }

    // Compute dezena-level delay stats
    const dezenaStats: Map<string, { lastIdx: number; total: number }> = new Map();
    for (let d = 0; d <= 99; d++) {
      const dz = String(d).padStart(2, '0');
      dezenaStats.set(dz, { lastIdx: results.length, total: 0 });
    }

    results.forEach((r, idx) => {
      for (let p = 1; p <= 5; p++) {
        const milhar = r[`prize_${p}_milhar`] as string;
        if (!milhar || milhar.length < 2) continue;
        const dz = milhar.slice(-2);
        const s = dezenaStats.get(dz);
        if (!s) continue;
        s.total++;
        if (idx < s.lastIdx) s.lastIdx = idx;
      }
    });

    const dezenaDelayList = Array.from(dezenaStats.entries())
      .map(([dz, s]) => ({
        dezena: dz,
        group: Math.floor((parseInt(dz, 10) === 0 ? 100 : parseInt(dz, 10) - 1) / 4) + 1,
        lastSeenDrawsAgo: s.lastIdx >= results.length ? results.length : s.lastIdx,
        totalAppearances: s.total,
      }))
      .sort((a, b) => b.lastSeenDrawsAgo - a.lastSeenDrawsAgo);

    // Sort by weighted score descending for the summary
    const sortedByScore = [...historicalStats].sort((a, b) => b.weightedScore - a.weightedScore);
    const sortedByDelay = [...historicalStats].sort((a, b) => b.lastSeenDrawsAgo - a.lastSeenDrawsAgo);

    // Build compact summary for AI
    const summary = `Análise de ${totalDraws} sorteios recentes (${lottery === 'capital' ? 'Capital' : 'PT-Rio'}).
Datas: ${dates[dates.length - 1]} a ${dates[0]}.

TOP 10 por pontuação ponderada (1°=5pts, 2°=4, 3°=3, 4°=2, 5°=1):
${sortedByScore.slice(0, 10).map((s, i) => `${i + 1}. G${String(s.group).padStart(2, '0')} ${s.name} — ${s.weightedScore}pts, ${s.totalAppearances} aparições, ${s.firstPrizeCount} vezes no 1° prêmio, tendência: ${s.trend}`).join('\n')}

TOP 5 mais atrasados (não saem há mais sorteios):
${sortedByDelay.slice(0, 5).map((s, i) => `${i + 1}. G${String(s.group).padStart(2, '0')} ${s.name} — ${s.lastSeenDrawsAgo} sorteios sem aparecer, tendência: ${s.trend}`).join('\n')}

Bichos QUENTES (acima da média nos últimos 3 dias):
${historicalStats.filter(s => s.trend === 'hot').map(s => `G${String(s.group).padStart(2, '0')} ${s.name} (${s.recentAppearances} recentes)`).join(', ') || 'Nenhum'}

Bichos FRIOS (abaixo da média nos últimos 3 dias):
${historicalStats.filter(s => s.trend === 'cold').map(s => `G${String(s.group).padStart(2, '0')} ${s.name} (${s.recentAppearances} recentes)`).join(', ') || 'Nenhum'}`;

    // Call Lovable AI for analysis
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Você é um analista estatístico especializado em jogo do bicho. Analise os dados históricos fornecidos e gere previsões baseadas em padrões estatísticos (frequência, atrasos, tendências, ciclos). NÃO é garantia, é análise probabilística. Seja objetivo e use dados.`
          },
          {
            role: 'user',
            content: `Com base nos dados abaixo, gere uma análise completa com previsões para os próximos sorteios.

${summary}

Responda APENAS em JSON válido com esta estrutura:
{
  "predictions": [
    {"group": 1, "name": "Avestruz", "probability": 85, "reason": "motivo curto"}
  ],
  "analysis": "texto da análise geral em 2-3 parágrafos",
  "hot_picks": [1, 2, 3],
  "cold_picks": [4, 5, 6],
  "suggested_milhares": ["1234", "5678", "9012"],
  "confidence": "medium"
}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_predictions',
            description: 'Generate bicho predictions based on statistical analysis',
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
                      probability: { type: 'number', description: 'Score 0-100' },
                      reason: { type: 'string' }
                    },
                    required: ['group', 'name', 'probability', 'reason']
                  },
                  description: 'Top 10 bichos ranked by probability score'
                },
                analysis: { type: 'string', description: 'General analysis text in Portuguese' },
                hot_picks: { type: 'array', items: { type: 'number' }, description: 'Hot group numbers' },
                cold_picks: { type: 'array', items: { type: 'number' }, description: 'Cold/delayed group numbers' },
                suggested_milhares: { type: 'array', items: { type: 'string' }, description: '3-5 suggested 4-digit milhares' },
                confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              required: ['predictions', 'analysis', 'hot_picks', 'cold_picks', 'suggested_milhares', 'confidence']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_predictions' } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes para IA.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();

    // Extract tool call result
    let predictions: any = null;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        predictions = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('Failed to parse AI tool call:', e);
      }
    }

    // Fallback: try message content
    if (!predictions) {
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const cleaned = content.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        predictions = JSON.parse(cleaned);
      } catch {
        console.error('Failed to parse AI content as JSON');
      }
    }

    // Enrich predictions with emoji
    if (predictions?.predictions) {
      predictions.predictions = predictions.predictions.map((p: any) => ({
        ...p,
        emoji: BICHOS[p.group]?.emoji || '❓',
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      lottery,
      total_draws_analyzed: totalDraws,
      date_range: { from: dates[dates.length - 1], to: dates[0] },
      stats: historicalStats,
      dezena_delays: dezenaDelayList.slice(0, 20),
      ai_predictions: predictions,
      generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Prediction error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
