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
  'LCAP-13:00': 'LCAP_13', 'PTSP-13:00': 'PTSP_13',
  'CAP-14:00': 'CAP_14', 'LCAP-14:00': 'CAP_14',
  'LCAP-15:00': 'LCAP_15', 'BAND-15:00': 'BAND_15', 'LCAP-16:00': 'LCAP_16',
  'CAP-18:00': 'CAP_18', 'LCAP-18:00': 'LCAP_18',
  'LCAP-19:00': 'LCAP_19', 'CAP-19:00': 'LCAP_19', 'LCAP-20:00': 'LCAP_20', 'LCAP-20:30': 'LCAP_20', 'PTNSP-20:00': 'PTNSP_20',
  'LCAP-22:30': 'LCAP_2230',
};

interface CapitalResult {
  draw_time: string;
  prizes: Array<{ milhar: string; group: number; bicho: string }>;
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

function parseVejaResultadoCapital(markdown: string, todayISO: string): CapitalResult[] {
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

  console.log(`Capital headers found: ${headerPositions.map(h => h.name).join(', ')}`);

  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i].index;
    const end = i + 1 < headerPositions.length ? headerPositions[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);

    // Validate date in section — must match today
    const dateMatch = section.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) {
      const sectionDate = parseBrazilianDate(dateMatch[1]);
      if (sectionDate && sectionDate !== todayISO) {
        console.log(`⏭️ Capital ${headerPositions[i].name}: date ${dateMatch[1]} != today ${todayISO}, skipping`);
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
      console.log(`✅ Capital ${headerPositions[i].name} → ${headerPositions[i].enumVal}: ${prizes[0].milhar} (${prizes[0].bicho})`);
      results.push({ draw_time: headerPositions[i].enumVal, prizes: prizes.slice(0, 5) });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!firecrawlKey || !lovableApiKey) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY or LOVABLE_API_KEY not configured' }), {
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
      .from('capital_results').select('draw_time').eq('draw_date', today);
    const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

    // Scrape vejaoresultado.com with JS rendering via actions
    console.log('Scraping vejaoresultado.com for Capital results...');
    let allResults: CapitalResult[] = [];
    try {
      const response = await fetch('https://connector-gateway.lovable.dev/firecrawl/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'X-Connection-Api-Key': `${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://www.vejaoresultado.com/',
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: 10000,
          actions: [
            { type: 'wait', milliseconds: 3000 },
            { type: 'scroll', direction: 'down', amount: 300 },
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
          allResults = parseVejaResultadoCapital(markdown, today);
          console.log(`Parsed ${allResults.length} valid Capital results for today`);
        }
      } else {
        console.error(`Firecrawl error: ${response.status}`);
        await response.text();
      }
    } catch (e) {
      console.error('Firecrawl scrape failed:', e);
    }

    // Upsert only results with validated today's date
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
        source: 'vejaoresultado.com', scraped_at: new Date().toISOString(),
      };

      const isExisting = existingTimes.has(result.draw_time);
      const { error } = await supabase.from('capital_results').upsert(row, { onConflict: 'draw_date,draw_time' });

      if (error) {
        console.error(`Error upserting ${result.draw_time}:`, error);
      } else {
        if (isExisting) { updated++; } else { inserted++; }
        console.log(`${isExisting ? '🔄' : '✅'} Capital ${result.draw_time}: ${p[0].milhar} (${p[0].bicho})`);
      }
    }

    return new Response(JSON.stringify({
      success: true, date: today,
      source: 'vejaoresultado.com',
      results_found: allResults.length,
      inserted, updated, existing: existingTimes.size,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
