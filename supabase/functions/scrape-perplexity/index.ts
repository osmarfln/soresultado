import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BICHOS: Record<number, string> = {
  1: 'Avestruz', 2: 'Águia', 3: 'Burro', 4: 'Borboleta', 5: 'Cachorro',
  6: 'Cabra', 7: 'Carneiro', 8: 'Camelo', 9: 'Cobra', 10: 'Coelho',
  11: 'Cavalo', 12: 'Elefante', 13: 'Galo', 14: 'Gato', 15: 'Jacaré',
  16: 'Leão', 17: 'Macaco', 18: 'Porco', 19: 'Pavão', 20: 'Peru',
  21: 'Touro', 22: 'Tigre', 23: 'Urso', 24: 'Veado', 25: 'Vaca',
};

function getBichoGroup(dezena: string): number {
  const num = parseInt(dezena);
  if (num === 0) return 25;
  return Math.ceil(num / 4);
}

function toDateStringInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

interface ParsedResult {
  draw_time: string;
  prizes: Array<{ milhar: string; group: number; bicho: string }>;
}

function parsePerplexityResponse(content: string, type: 'rio' | 'capital'): ParsedResult[] {
  const results: ParsedResult[] = [];

  // Strip markdown code blocks
  const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Try to extract JSON array
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const item of parsed) {
        if (item.draw_time && item.prizes && item.prizes.length >= 5) {
          const prizes = item.prizes.slice(0, 5).map((p: any) => ({
            milhar: String(p.milhar).padStart(4, '0'),
            group: parseInt(p.group) || getBichoGroup(String(p.milhar).padStart(4, '0').slice(-2)),
            bicho: p.bicho || BICHOS[parseInt(p.group)] || 'Desconhecido',
          }));
          results.push({ draw_time: item.draw_time, prizes });
        }
      }
      return results;
    } catch { /* not valid JSON, try text parsing */ }
  }

  // Fallback: parse text format
  // Look for patterns like "PPT: 8504, 1147, 2839, 1332, 6306"
  const drawTimePatterns = type === 'rio'
    ? { 'PPT': /PPT[:\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})/gi,
        'PTM': /PTM[:\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})/gi,
        'PT': /\bPT[:\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})/gi,
        'PTV': /PTV[:\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})/gi,
        'PTN': /PTN[:\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})/gi,
        'COR': /COR(?:UJA)?[:\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})[,\s]+(\d{4})/gi }
    : {}; // Capital has too many draw times, skip text parsing

  for (const [dt, regex] of Object.entries(drawTimePatterns)) {
    const m = regex.exec(content);
    if (m) {
      const milhares = [m[1], m[2], m[3], m[4], m[5]];
      const prizes = milhares.map(milhar => {
        const group = getBichoGroup(milhar.slice(-2));
        return { milhar, group, bicho: BICHOS[group] || 'Desconhecido' };
      });
      results.push({ draw_time: dt, prizes });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityKey) {
      return new Response(JSON.stringify({ error: 'PERPLEXITY_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = toDateStringInTimeZone(new Date(), 'America/Sao_Paulo');
    const todayFormatted = today.split('-').reverse().join('/');

    let type: 'rio' | 'capital' = 'rio';
    try {
      const body = await req.json();
      type = body.type || 'rio';
    } catch { /* default to rio */ }

    const tableName = type === 'rio' ? 'draw_results' : 'capital_results';

    // Check existing
    const { data: existing } = await supabase
      .from(tableName)
      .select('draw_time')
      .eq('draw_date', today);
    const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

    // Query Perplexity for results
    const query = type === 'rio'
      ? `Resultado do jogo do bicho PT-Rio de hoje ${todayFormatted}. Para cada sorteio (PPT 09h, PTM 11h, PT 14h, PTV 16h, PTN 18h, COR 21h), me dê os 5 primeiros prêmios com as milhares de 4 dígitos. Retorne em formato JSON: [{"draw_time":"PPT","prizes":[{"milhar":"1234","group":1,"bicho":"Avestruz"},...]}]. Site de referência: vejaoresultado.com e loteriasbr.com`
      : `Resultado do jogo do bicho Capital (Look Goiás/Brasília) de hoje ${todayFormatted}. Para cada sorteio, me dê os 5 primeiros prêmios com as milhares. Retorne em formato JSON: [{"draw_time":"LCAP_09","prizes":[{"milhar":"1234","group":1,"bicho":"Avestruz"},...]}]. Site de referência: vejaoresultado.com`;

    console.log(`Querying Perplexity for ${type} results...`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Você é um assistente que busca resultados do jogo do bicho. Retorne APENAS os dados em formato JSON, sem explicações extras.' },
          { role: 'user', content: query },
        ],
        search_domain_filter: ['vejaoresultado.com', 'loteriasbr.com', 'rdjdb.com.br'],
        search_recency_filter: 'day',
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`Perplexity error: ${response.status} ${errBody}`);
      return new Response(JSON.stringify({ error: 'Perplexity query failed', status: response.status }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    console.log(`Perplexity response content: ${content.substring(0, 500)}`);
    console.log(`Perplexity response: ${content.length} chars, ${citations.length} citations`);

    const results = parsePerplexityResponse(content, type);
    console.log(`Parsed ${results.length} results from Perplexity`);

    let inserted = 0;
    let updated = 0;
    for (const result of results) {
      const p = result.prizes;
      const row = {
        draw_date: today,
        draw_time: result.draw_time,
        prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
        prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
        prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
        prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
        prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      };

      const isExisting = existingTimes.has(result.draw_time);

      const { error } = await supabase.from(tableName).upsert(row, {
        onConflict: 'draw_date,draw_time',
      });

      if (error) {
        console.error(`Error upserting ${result.draw_time}:`, error);
      } else {
        if (isExisting) { updated++; } else { inserted++; }
        console.log(`${isExisting ? '🔄' : '✅'} ${result.draw_time}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date: today,
      type,
      parsed_results: results.length,
      inserted,
      updated,
      citations,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Perplexity scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
