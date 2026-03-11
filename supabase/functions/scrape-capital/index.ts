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

const HEADER_TO_ENUM: Record<string, string> = {
  'LCAP-09:00': 'LCAP_09', 'LCAP-10:00': 'LCAP_10', 'LCAP-11:00': 'LCAP_11',
  'LCAP-13:00': 'LCAP_13', 'PTSP-13:00': 'PTSP_13', 'CAP-14:00': 'CAP_14',
  'LCAP-15:00': 'LCAP_15', 'BAND-15:00': 'BAND_15', 'LCAP-16:00': 'LCAP_16',
  'CAP-18:00': 'CAP_18', 'LCAP-20:00': 'LCAP_20', 'PTNSP-20:00': 'PTNSP_20',
  'LCAP-22:30': 'LCAP_2230',
};

const ALL_CAPITAL_TIMES = [
  'LCAP_09', 'LCAP_10', 'LCAP_11', 'LCAP_13', 'PTSP_13', 'CAP_14',
  'LCAP_15', 'BAND_15', 'LCAP_16', 'CAP_18', 'LCAP_20', 'PTNSP_20', 'LCAP_2230',
];

const CAPITAL_TIME_SCHEDULE: Record<string, { hour: number; minute: number; label: string }> = {
  'LCAP_09': { hour: 9, minute: 0, label: '09:00' },
  'LCAP_10': { hour: 10, minute: 0, label: '10:00' },
  'LCAP_11': { hour: 11, minute: 0, label: '11:00' },
  'LCAP_13': { hour: 13, minute: 0, label: '13:00' },
  'PTSP_13': { hour: 13, minute: 0, label: '13:00' },
  'CAP_14': { hour: 14, minute: 0, label: '14:00' },
  'LCAP_15': { hour: 15, minute: 0, label: '15:00' },
  'BAND_15': { hour: 15, minute: 0, label: '15:00' },
  'LCAP_16': { hour: 16, minute: 0, label: '16:00' },
  'CAP_18': { hour: 18, minute: 0, label: '18:00' },
  'LCAP_20': { hour: 20, minute: 0, label: '20:00' },
  'PTNSP_20': { hour: 20, minute: 0, label: '20:00' },
  'LCAP_2230': { hour: 22, minute: 30, label: '22:30' },
};

interface CapitalResult {
  draw_time: string;
  prizes: Array<{ milhar: string; group: number; bicho: string }>;
}

function getBichoGroup(dezena: string): number {
  const num = parseInt(dezena);
  if (num === 0) return 25;
  return Math.ceil(num / 4);
}

function parseVejaResultado(markdown: string): CapitalResult[] {
  const results: CapitalResult[] = [];
  const headerRegex = /^## ((?:LCAP|CAP|PTSP|BAND|PTNSP)-\d{2}:\d{2})\s*$/gm;
  const headerPositions: Array<{ name: string; enumVal: string; index: number }> = [];
  const seen = new Set<string>();
  let match;
  while ((match = headerRegex.exec(markdown)) !== null) {
    const name = match[1];
    const enumVal = HEADER_TO_ENUM[name];
    if (enumVal && !seen.has(enumVal)) {
      seen.add(enumVal);
      headerPositions.push({ name, enumVal, index: match.index });
    }
  }

  console.log(`Firecrawl found ${headerPositions.length} capital headers: ${headerPositions.map(h => h.name).join(', ')}`);

  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i].index;
    const end = i + 1 < headerPositions.length ? headerPositions[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);
    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    const rowRegex = /\|\s*(\d)º\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*-\s*([^|]+)\|/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(section)) !== null) {
      if (parseInt(rowMatch[1]) > 5) continue;
      const milhar = rowMatch[2];
      const group = parseInt(rowMatch[3]);
      prizes.push({ milhar, group, bicho: BICHOS[group] || rowMatch[4].trim() });
    }
    if (prizes.length >= 5) {
      results.push({ draw_time: headerPositions[i].enumVal, prizes: prizes.slice(0, 5) });
    }
  }
  return results;
}

// Use Perplexity AI to find missing capital results
async function fetchMissingFromPerplexity(
  perplexityKey: string,
  missingTimes: string[],
  todayFormatted: string
): Promise<CapitalResult[]> {
  const missingLabels = missingTimes.map((t) => {
    const schedule = CAPITAL_TIME_SCHEDULE[t];
    return `${t} (${schedule?.label ?? 'horário desconhecido'})`;
  }).join(', ');

  const query = `Resultado do jogo do bicho Capital de hoje ${todayFormatted}. Preciso dos resultados dos seguintes horários que estão faltando: ${missingLabels}. Para cada sorteio, me dê os 5 primeiros prêmios com milhar de 4 dígitos, grupo e bicho. Retorne APENAS em formato JSON: [{"draw_time":"LCAP_16","prizes":[{"milhar":"1234","group":1,"bicho":"Avestruz"},...]},...]`;

  console.log(`Querying Perplexity for missing capital times: ${missingTimes.join(', ')}`);

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${perplexityKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'Você é um assistente que busca resultados do jogo do bicho Capital (Look Goiás). Retorne APENAS JSON, sem explicações.' },
        { role: 'user', content: query },
      ],
      search_domain_filter: ['vejaoresultado.com', 'lofrj.com.br', 'resultadodobicho.com'],
      search_recency_filter: 'day',
    }),
  });

  if (!response.ok) {
    console.error(`Perplexity error: ${response.status}`);
    await response.text();
    return [];
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  console.log(`Perplexity capital response: ${content.substring(0, 300)}`);

  const results: CapitalResult[] = [];
  const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const item of parsed) {
        if (item.draw_time && missingTimes.includes(item.draw_time) && item.prizes?.length >= 5) {
          const prizes = item.prizes.slice(0, 5).map((p: any) => ({
            milhar: String(p.milhar).padStart(4, '0'),
            group: parseInt(p.group) || getBichoGroup(String(p.milhar).padStart(4, '0').slice(-2)),
            bicho: p.bicho || BICHOS[parseInt(p.group)] || 'Desconhecido',
          }));
          results.push({ draw_time: item.draw_time, prizes });
        }
      }
    } catch (e) { console.error('Failed to parse Perplexity JSON:', e); }
  }

  console.log(`Perplexity found ${results.length} missing capital results`);
  return results;
}

function toDateStringInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

function getCurrentMinutesBRT(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return (hour * 60) + minute;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = toDateStringInTimeZone(new Date(), 'America/Sao_Paulo');
    const todayFormatted = today.split('-').reverse().join('/');

    let targetTime: string | null = null;
    if (req.method === 'POST') {
      try { const body = await req.json(); targetTime = body.draw_time || null; } catch {}
    }

    const { data: existing } = await supabase
      .from('capital_results').select('draw_time').eq('draw_date', today);
    const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

    // Step 1: Scrape vejaoresultado.com with Firecrawl
    console.log('Scraping vejaoresultado.com...');
    let firecrawlResults: CapitalResult[] = [];
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://www.vejaoresultado.com/',
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: 10000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const markdown = data.data?.markdown || data.markdown || '';
        if (markdown) {
          console.log(`Got ${markdown.length} chars from vejaoresultado.com`);
          firecrawlResults = parseVejaResultado(markdown);
          console.log(`Firecrawl parsed ${firecrawlResults.length} capital results`);
        }
      } else {
        console.error(`Firecrawl error: ${response.status}`);
        await response.text();
      }
    } catch (e) {
      console.error('Firecrawl scrape failed:', e);
    }

    // Merge Firecrawl results
    const foundTimes = new Set(firecrawlResults.map(r => r.draw_time));
    const allResults = [...firecrawlResults];

    // Step 2: Find missing times that should have results by now
    const currentHour = getCurrentHourBRT();
    const expectedTimes = ALL_CAPITAL_TIMES.filter(t => {
      const h = CAPITAL_TIME_HOURS[t];
      return h <= currentHour - 1; // Allow 1 hour margin for results to be published
    });
    const missingTimes = expectedTimes.filter(t => !foundTimes.has(t) && !existingTimes.has(t));

    // Step 3: If there are missing times, try Perplexity
    if (missingTimes.length > 0) {
      const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
      if (perplexityKey) {
        const perplexityResults = await fetchMissingFromPerplexity(perplexityKey, missingTimes, todayFormatted);
        allResults.push(...perplexityResults);
      } else {
        console.log('PERPLEXITY_API_KEY not configured, skipping fallback');
      }
    }

    // Step 4: Upsert all results
    let inserted = 0, updated = 0;
    for (const result of allResults) {
      if (targetTime && result.draw_time !== targetTime) continue;

      const p = result.prizes;
      const row = {
        draw_date: today, draw_time: result.draw_time,
        prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
        prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
        prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
        prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
        prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
        status: 'confirmed', updated_at: new Date().toISOString(),
      };

      const isExisting = existingTimes.has(result.draw_time);
      const { error } = await supabase.from('capital_results').upsert(row, { onConflict: 'draw_date,draw_time' });

      if (error) {
        console.error(`Error upserting ${result.draw_time}:`, error);
      } else {
        if (isExisting) { updated++; } else { inserted++; }
        console.log(`${isExisting ? '🔄' : '✅'} ${result.draw_time}`);
      }
    }

    return new Response(JSON.stringify({
      success: true, date: today,
      firecrawl_results: firecrawlResults.length,
      perplexity_fallback: allResults.length - firecrawlResults.length,
      total_results: allResults.length,
      inserted, updated, existing: existingTimes.size,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
