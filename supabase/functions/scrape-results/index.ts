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

// Mapping from vejaoresultado.com RIO headers to our draw_time enum
const RIO_HEADER_TO_ENUM: Record<string, string> = {
  'RIO-09:00': 'PPT',
  'RIO-11:00': 'PTM',
  'RIO-14:00': 'PT',
  'RIO-16:00': 'PTV',
  'RIO-18:00': 'PTN',
  'RIO-21:00': 'COR',
};

const ALL_DRAW_TIMES = ['PPT', 'PTM', 'PT', 'PTV', 'PTN', 'COR'];

const DRAW_TIME_SCHEDULE: Record<string, { hour: number; minute: number }> = {
  'PPT': { hour: 9, minute: 20 },
  'PTM': { hour: 11, minute: 20 },
  'PT': { hour: 14, minute: 20 },
  'PTV': { hour: 16, minute: 20 },
  'PTN': { hour: 18, minute: 20 },
  'COR': { hour: 21, minute: 20 },
};

interface DrawResult {
  draw_time: string;
  prizes: Array<{ milhar: string; group: number; bicho: string }>;
}

function getBichoGroup(dezena: string): number {
  const num = parseInt(dezena);
  if (num === 0) return 25;
  return Math.ceil(num / 4);
}

function toDateStringBRT(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

function getCurrentMinutesBRT(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return (hour * 60) + minute;
}

// Parse vejaoresultado.com markdown for RIO results
// Format: ## RIO-09:00 ... | 1º | 4842 | 11 - Cavalo |
function parseVejaResultadoRio(markdown: string): DrawResult[] {
  const results: DrawResult[] = [];
  const headerRegex = /^## (RIO-\d{2}:\d{2})\s*$/gm;
  const headerPositions: Array<{ name: string; enumVal: string; index: number }> = [];
  const seen = new Set<string>();
  let match;

  while ((match = headerRegex.exec(markdown)) !== null) {
    const name = match[1];
    const enumVal = RIO_HEADER_TO_ENUM[name];
    if (enumVal && !seen.has(enumVal)) {
      seen.add(enumVal);
      headerPositions.push({ name, enumVal, index: match.index });
    }
  }

  console.log(`vejaoresultado.com RIO headers found: ${headerPositions.map(h => h.name).join(', ')}`);

  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i].index;
    const end = i + 1 < headerPositions.length ? headerPositions[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);
    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];

    // Match table rows: | 1º | 4842 | 11 - Cavalo |
    const rowRegex = /\|\s*(\d)º\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*-\s*([^|]+)\|/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(section)) !== null) {
      if (parseInt(rowMatch[1]) > 5) continue;
      const milhar = rowMatch[2];
      const group = parseInt(rowMatch[3]);
      prizes.push({ milhar, group, bicho: BICHOS[group] || rowMatch[4].trim() });
    }

    if (prizes.length >= 5) {
      console.log(`✅ RIO ${headerPositions[i].name} → ${headerPositions[i].enumVal}: ${prizes[0].milhar} (${prizes[0].bicho})`);
      results.push({ draw_time: headerPositions[i].enumVal, prizes: prizes.slice(0, 5) });
    }
  }

  return results;
}

function extractFirstJsonPayload(text: string): string | null {
  const candidates = [
    { idx: text.indexOf('['), open: '[', close: ']' },
    { idx: text.indexOf('{'), open: '{', close: '}' },
  ].filter(c => c.idx !== -1).sort((a, b) => a.idx - b.idx);

  if (candidates.length === 0) return null;
  const { idx: start, open, close } = candidates[0];
  let depth = 0, inString = false, escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; }
      else if (ch === '\\') { escaped = true; }
      else if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth++;
    if (ch === close) { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

// Perplexity fallback for missing Rio times
async function fetchMissingFromPerplexity(
  perplexityKey: string, missingTimes: string[], todayFormatted: string
): Promise<DrawResult[]> {
  const labels = missingTimes.join(', ');
  const query = `Resultado do jogo do bicho Deu no Poste Rio de Janeiro de hoje ${todayFormatted}. Preciso dos resultados dos seguintes horários: ${labels}. Para cada sorteio, me dê os 5 primeiros prêmios com milhar de 4 dígitos, grupo e bicho. Retorne APENAS em formato JSON: [{"draw_time":"PTN","prizes":[{"milhar":"1234","group":1,"bicho":"Avestruz"},...]},...]`;

  console.log(`Querying Perplexity for missing Rio times: ${labels}`);

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'Você é um assistente que busca resultados do jogo do bicho Deu no Poste (Rio de Janeiro). Retorne APENAS JSON, sem explicações.' },
        { role: 'user', content: query },
      ],
      search_domain_filter: ['vejaoresultado.com', 'ojogodobicho.com', 'resultadodobicho.com'],
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
  console.log(`Perplexity Rio response: ${content.substring(0, 300)}`);

  const results: DrawResult[] = [];
  const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonPayload = extractFirstJsonPayload(cleaned);

  if (jsonPayload) {
    try {
      const parsed = JSON.parse(jsonPayload);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        const drawTime = String(item?.draw_time || '').toUpperCase();
        if (!drawTime || !missingTimes.includes(drawTime) || !Array.isArray(item?.prizes) || item.prizes.length < 5) continue;

        const prizes = item.prizes.slice(0, 5).map((p: any) => {
          const milhar = String(p?.milhar ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0');
          const parsedGroup = parseInt(String(p?.group ?? ''), 10);
          const group = parsedGroup >= 1 && parsedGroup <= 25 ? parsedGroup : getBichoGroup(milhar.slice(-2));
          return { milhar, group, bicho: BICHOS[group] || 'Desconhecido' };
        });

        if (prizes.length === 5) results.push({ draw_time: drawTime, prizes });
      }
    } catch (e) {
      console.error('Failed to parse Perplexity JSON:', e);
    }
  }

  console.log(`Perplexity found ${results.length} missing Rio results`);
  return results;
}

// Perplexity for Federal
async function fetchFederalFromPerplexity(
  perplexityKey: string, todayFormatted: string
): Promise<{ draw_number: string | null; prizes: Array<{ milhar: string; group: number; bicho: string }> } | null> {
  const query = `Resultado da Loteria Federal de hoje ${todayFormatted}. Preciso do número do concurso e dos 5 prêmios com milhar de 4 dígitos, grupo e bicho. Retorne APENAS JSON: {"draw_number":"12345","prizes":[{"milhar":"1234","group":1,"bicho":"Avestruz"},{"milhar":"5678","group":2,"bicho":"Águia"},{"milhar":"9012","group":3,"bicho":"Burro"},{"milhar":"3456","group":4,"bicho":"Borboleta"},{"milhar":"7890","group":5,"bicho":"Cachorro"}]}`;

  console.log('Querying Perplexity for Federal result...');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'Você é um assistente que busca resultados da Loteria Federal do Brasil. Retorne APENAS JSON válido, sem explicações.' },
        { role: 'user', content: query },
      ],
      search_domain_filter: ['loterias.caixa.gov.br', 'ojogodobicho.com', 'resultadodobicho.com'],
      search_recency_filter: 'day',
    }),
  });

  if (!response.ok) {
    console.error(`Perplexity Federal error: ${response.status}`);
    await response.text();
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonPayload = extractFirstJsonPayload(cleaned);
  if (!jsonPayload) return null;

  try {
    const parsed = JSON.parse(jsonPayload);
    const drawNumber = parsed.draw_number ? String(parsed.draw_number) : null;
    if (!Array.isArray(parsed.prizes) || parsed.prizes.length < 5) return null;

    const prizes = parsed.prizes.slice(0, 5).map((p: any) => {
      const milhar = String(p?.milhar ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0');
      const parsedGroup = parseInt(String(p?.group ?? ''), 10);
      const group = parsedGroup >= 1 && parsedGroup <= 25 ? parsedGroup : getBichoGroup(milhar.slice(-2));
      return { milhar, group, bicho: BICHOS[group] || 'Desconhecido' };
    });

    console.log(`Perplexity Federal: concurso ${drawNumber}, 1°=${prizes[0].milhar}`);
    return { draw_number: drawNumber, prizes };
  } catch (e) {
    console.error('Failed to parse Perplexity Federal JSON:', e);
    return null;
  }
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
    const today = toDateStringBRT(new Date());
    const todayFormatted = today.split('-').reverse().join('/');

    let targetTime: string | null = null;
    if (req.method === 'POST') {
      try { const body = await req.json(); targetTime = body.draw_time || null; } catch {}
    }

    const { data: existing } = await supabase
      .from('draw_results').select('draw_time').eq('draw_date', today);
    const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

    // Step 1: Scrape vejaoresultado.com with Firecrawl — PRIMARY SOURCE for Rio
    console.log('Scraping vejaoresultado.com for Rio results...');
    let firecrawlResults: DrawResult[] = [];
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
          firecrawlResults = parseVejaResultadoRio(markdown);
          console.log(`Parsed ${firecrawlResults.length} Rio results from vejaoresultado.com`);
        }
      } else {
        console.error(`Firecrawl error: ${response.status}`);
        await response.text();
      }
    } catch (e) {
      console.error('Firecrawl scrape failed:', e);
    }

    const allResults = [...firecrawlResults];
    const foundTimes = new Set(allResults.map(r => r.draw_time));

    // Step 2: Determine which times are missing
    const currentMinutesBRT = getCurrentMinutesBRT();
    const graceMinutes = 20;
    const expectedTimes = ALL_DRAW_TIMES.filter((t) => {
      const schedule = DRAW_TIME_SCHEDULE[t];
      if (!schedule) return false;
      return (schedule.hour * 60 + schedule.minute) <= (currentMinutesBRT - graceMinutes);
    });

    const missingTimes = expectedTimes.filter(t => !foundTimes.has(t) && !existingTimes.has(t));

    // Step 3: Perplexity fallback for missing times
    if (missingTimes.length > 0) {
      console.log(`Missing expected Rio times: ${missingTimes.join(', ')}`);
      const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
      if (perplexityKey) {
        const perplexityResults = await fetchMissingFromPerplexity(perplexityKey, missingTimes, todayFormatted);
        allResults.push(...perplexityResults);
      } else {
        console.log('PERPLEXITY_API_KEY not configured, skipping fallback');
      }
    }

    // Step 4: Upsert results
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
      const { error } = await supabase.from('draw_results').upsert(row, { onConflict: 'draw_date,draw_time' });

      if (error) {
        console.error(`Error upserting ${result.draw_time}:`, error);
      } else {
        if (isExisting) { updated++; } else { inserted++; }
        console.log(`${isExisting ? '🔄' : '✅'} Rio ${result.draw_time}`);
      }
    }

    // Step 5: Federal — check on Wednesdays & Saturdays after 19h
    let federalInserted = false;
    const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const dayOfWeek = nowBRT.getDay(); // 0=Sun, 3=Wed, 6=Sat
    const isFederalDay = dayOfWeek === 3 || dayOfWeek === 6;

    if (isFederalDay && currentMinutesBRT >= (19 * 60)) {
      const { data: existingFederal } = await supabase
        .from('federal_results').select('id, draw_number').eq('draw_date', today).maybeSingle();

      if (!existingFederal) {
        const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (perplexityKey) {
          const federal = await fetchFederalFromPerplexity(perplexityKey, todayFormatted);
          if (federal && federal.prizes.length === 5) {
            const p = federal.prizes;
            const { error: fedError } = await supabase.from('federal_results').upsert({
              draw_date: today, draw_number: federal.draw_number,
              prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
              prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
              prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
              prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
              prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
              status: 'confirmed', updated_at: new Date().toISOString(),
            }, { onConflict: 'draw_date' });

            if (!fedError) {
              federalInserted = true;
              console.log(`✅ Federal result inserted: concurso ${federal.draw_number}`);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true, date: today,
      source: 'vejaoresultado.com',
      firecrawl_results: firecrawlResults.length,
      total_results: allResults.length,
      inserted, updated, existing: existingTimes.size,
      federal_inserted: federalInserted,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
