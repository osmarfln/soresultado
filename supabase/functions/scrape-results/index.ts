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

const RIO_HEADER_TO_ENUM: Record<string, string> = {
  'RIO-09:00': 'PPT', 'RIO-11:00': 'PTM', 'RIO-14:00': 'PT',
  'RIO-16:00': 'PTV', 'RIO-18:00': 'PTN', 'RIO-21:00': 'COR',
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

// Convert "12/03/2026" (dd/mm/yyyy) to "2026-03-12"
function parseBrazilianDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
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

function getDayOfWeekBRT(): number {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short',
  }).format(now);
  const map: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return map[dateStr] ?? new Date().getDay();
}

function parseVejaResultadoRio(markdown: string, todayISO: string): DrawResult[] {
  const results: DrawResult[] = [];

  // Map all possible headers to draw_time enum values
  const HEADER_TO_ENUM: Record<string, string> = {
    ...RIO_HEADER_TO_ENUM,
    'CORUJA': 'COR',
  };

  // Match both RIO-XX:XX and CORUJA headers
  const headerRegex = /^## (RIO-\d{2}:\d{2}|CORUJA)\s*$/gm;
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

  console.log(`RIO headers found: ${headerPositions.map(h => h.name).join(', ')}`);

  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i].index;
    const end = i + 1 < headerPositions.length ? headerPositions[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);

    // Validate date in section — must match today
    const dateMatch = section.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) {
      const sectionDate = parseBrazilianDate(dateMatch[1]);
      if (sectionDate && sectionDate !== todayISO) {
        console.log(`⏭️ Rio ${headerPositions[i].name}: date ${dateMatch[1]} != today ${todayISO}, skipping`);
        continue;
      }
    }

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
      console.log(`✅ RIO ${headerPositions[i].enumVal}: ${prizes[0].milhar} (${prizes[0].bicho})`);
      results.push({ draw_time: headerPositions[i].enumVal, prizes: prizes.slice(0, 5) });
    }
  }

  return results;
}

async function fetchFederalFromCaixa(
  firecrawlKey: string
): Promise<{ draw_number: string | null; prizes: Array<{ milhar: string; group: number; bicho: string }> } | null> {
  console.log('Scraping loterias.caixa.gov.br for Federal result...');

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://loterias.caixa.gov.br/Paginas/Federal.aspx',
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 10000,
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl Federal error: ${response.status}`);
      await response.text();
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    if (!markdown) return null;

    const concursoMatch = markdown.match(/Concurso\s+(\d+)/i);
    const drawNumber = concursoMatch ? concursoMatch[1] : null;

    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    const rowRegex = /\|\s*(\d)º\s*\|\s*(\d{5,6})\s*\|/g;
    let rowMatch;
    const seenPrizes = new Set<number>();

    while ((rowMatch = rowRegex.exec(markdown)) !== null) {
      const prizeNum = parseInt(rowMatch[1]);
      if (prizeNum > 5 || seenPrizes.has(prizeNum)) continue;
      seenPrizes.add(prizeNum);

      const bilhete = rowMatch[2];
      const milhar = bilhete.slice(-4);
      const dezena = milhar.slice(-2);
      const group = getBichoGroup(dezena);
      prizes.push({ milhar, group, bicho: BICHOS[group] || 'Desconhecido' });
    }

    if (prizes.length >= 5) {
      console.log(`✅ Federal concurso ${drawNumber}: 1°=${prizes[0].milhar} (${prizes[0].bicho})`);
      return { draw_number: drawNumber, prizes: prizes.slice(0, 5) };
    }

    return null;
  } catch (e) {
    console.error('Firecrawl Federal scrape failed:', e);
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

    let targetTime: string | null = null;
    if (req.method === 'POST') {
      try { const body = await req.json(); targetTime = body.draw_time || null; } catch {}
    }

    const { data: existing } = await supabase
      .from('draw_results').select('draw_time').eq('draw_date', today);
    const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

    // Scrape vejaoresultado.com with JS rendering
    console.log('Scraping vejaoresultado.com for Rio results...');
    let allResults: DrawResult[] = [];
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
        url: 'https://www.vejaoresultado.com/',
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 8000,
        actions: [
          { type: 'scroll', direction: 'down', amount: 3000 },
          { type: 'wait', milliseconds: 2000 },
        ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const markdown = data.data?.markdown || data.markdown || '';
        if (markdown) {
          console.log(`Got ${markdown.length} chars from vejaoresultado.com`);
          // Check global date in markdown
          const globalDateMatch = markdown.match(/Resultados?\s+(\d{2}\/\d{2}\/\d{4})/i);
          if (globalDateMatch) {
            const pageDate = parseBrazilianDate(globalDateMatch[1]);
            console.log(`Page date: ${globalDateMatch[1]} → ${pageDate}, today: ${today}`);
            if (pageDate && pageDate !== today) {
              console.log(`⚠️ Page shows ${globalDateMatch[1]} but today is ${today} — site hasn't updated yet`);
            }
          }
          allResults = parseVejaResultadoRio(markdown, today);
          console.log(`Parsed ${allResults.length} valid Rio results for today`);
        }
      } else {
        console.error(`Firecrawl error: ${response.status}`);
        await response.text();
      }
    } catch (e) {
      console.error('Firecrawl scrape failed:', e);
    }

    // Upsert only date-validated results
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
        console.log(`${isExisting ? '🔄' : '✅'} Rio ${result.draw_time}: ${p[0].milhar} (${p[0].bicho})`);
      }
    }

    // Federal — Wednesdays & Saturdays after 19:30h BRT
    let federalInserted = false;
    const dayOfWeek = getDayOfWeekBRT();
    const isFederalDay = dayOfWeek === 3 || dayOfWeek === 6;
    const currentMinutesBRT = getCurrentMinutesBRT();

    if (isFederalDay && currentMinutesBRT >= (19 * 60 + 30)) {
      const { data: existingFederal } = await supabase
        .from('federal_results').select('id').eq('draw_date', today).maybeSingle();

      if (!existingFederal) {
        const federal = await fetchFederalFromCaixa(firecrawlKey);

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
            console.log(`✅ Federal inserted: concurso ${federal.draw_number}`);
          } else {
            console.error('Federal upsert error:', fedError);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true, date: today,
      source: 'vejaoresultado.com',
      rio_results: allResults.length,
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
