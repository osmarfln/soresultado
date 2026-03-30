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

// Map site headers to enum values
const HEADER_TO_ENUM: Record<string, string> = {
  'PT-SP - 08h20': 'PTSP_0820',
  'PT-SP - 10h00': 'PTSP_1000',
  'PT-SP - 13h00': 'PTSP_1300',
  'BANDEIRANTES - 15h30': 'BAND_1530',
  'PT-SP - 19h00': 'PTSP_1900',
  'PTN-SP - 20h00': 'PTNSP_2000',
};

interface DrawResult {
  draw_date: string;
  draw_time: string;
  prizes: Array<{ milhar: string; group: number; bicho: string }>;
}

function toDateStringBRT(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

function parseBrazilianDateDot(dateStr: string): string | null {
  // "30.03.2026" → "2026-03-30"
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseMegabichoMarkdown(markdown: string, filterDate?: string): DrawResult[] {
  const results: DrawResult[] = [];

  // Match sections like: 30.03.2026 \| PT-SP - 08h20
  const sectionRegex = /(\d{2}\.\d{2}\.\d{4})\s*\\?\|\s*([^\n]+)/g;
  const sectionPositions: Array<{ date: string; header: string; index: number }> = [];
  let match;

  while ((match = sectionRegex.exec(markdown)) !== null) {
    const dateStr = parseBrazilianDateDot(match[1]);
    const header = match[2].trim();
    if (dateStr) {
      sectionPositions.push({ date: dateStr, header, index: match.index });
    }
  }

  for (let i = 0; i < sectionPositions.length; i++) {
    const { date, header, index: start } = sectionPositions[i];
    const end = i + 1 < sectionPositions.length ? sectionPositions[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);

    if (filterDate && date !== filterDate) continue;

    const enumVal = HEADER_TO_ENUM[header];
    if (!enumVal) {
      console.log(`Unknown SP header: "${header}", skipping`);
      continue;
    }

    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    const rowRegex = /\|\s*(\d)º\s*Prêmio\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*([^|]+)\|/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(section)) !== null) {
      if (parseInt(rowMatch[1]) > 5) continue;
      const group = parseInt(rowMatch[3]);
      prizes.push({ milhar: rowMatch[2], group, bicho: BICHOS[group] || rowMatch[4].trim() });
    }

    if (prizes.length >= 5) {
      results.push({ draw_date: date, draw_time: enumVal, prizes: prizes.slice(0, 5) });
      console.log(`✅ SP ${enumVal} (${date}): ${prizes[0].milhar} (${prizes[0].bicho})`);
    }
  }

  return results;
}

async function scrapeDate(firecrawlKey: string, dateSlug: string): Promise<string> {
  const url = dateSlug === 'today'
    ? 'https://megabicho.com/jogo-do-bicho/resultados/sp'
    : `https://megabicho.com/jogo-do-bicho/resultados/sp/dia/${dateSlug}`;

  console.log(`Fetching ${url}...`);
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 5000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Firecrawl error ${response.status}: ${text}`);
    return '';
  }

  const data = await response.json();
  return data.data?.markdown || data.markdown || '';
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

    let mode = 'today';
    let importFrom: string | null = null;
    let importTo: string | null = null;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        mode = body.mode || 'today';
        importFrom = body.from || null;
        importTo = body.to || null;
      } catch {}
    }

    const today = toDateStringBRT(new Date());
    let totalInserted = 0;
    let totalUpdated = 0;

    if (mode === 'import' && importFrom && importTo) {
      // Import historical data date by date
      const startDate = new Date(importFrom + 'T12:00:00Z');
      const endDate = new Date(importTo + 'T12:00:00Z');
      const current = new Date(startDate);

      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        const dateSlug = dateStr; // megabicho uses YYYY-MM-DD format

        try {
          const markdown = await scrapeDate(firecrawlKey, dateSlug);
          if (markdown) {
            const results = parseMegabichoMarkdown(markdown);
            for (const result of results) {
              const p = result.prizes;
              const row = {
                draw_date: result.draw_date, draw_time: result.draw_time,
                prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
                prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
                prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
                prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
                prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
                status: 'confirmed', updated_at: new Date().toISOString(),
              };
              const { error } = await supabase.from('sp_results').upsert(row, { onConflict: 'draw_date,draw_time' });
              if (error) {
                console.error(`Error upserting SP ${result.draw_time} ${result.draw_date}:`, error);
              } else {
                totalInserted++;
              }
            }
          }
        } catch (e) {
          console.error(`Error scraping ${dateStr}:`, e);
        }

        current.setDate(current.getDate() + 1);
      }
    } else {
      // Today mode - scrape today's results
      const markdown = await scrapeDate(firecrawlKey, 'today');
      if (markdown) {
        const results = parseMegabichoMarkdown(markdown, today);

        const { data: existing } = await supabase
          .from('sp_results').select('draw_time').eq('draw_date', today);
        const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

        for (const result of results) {
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
          const { error } = await supabase.from('sp_results').upsert(row, { onConflict: 'draw_date,draw_time' });
          if (error) {
            console.error(`Error upserting SP ${result.draw_time}:`, error);
          } else {
            if (isExisting) totalUpdated++; else totalInserted++;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true, mode, date: today,
      inserted: totalInserted, updated: totalUpdated,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('SP scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
