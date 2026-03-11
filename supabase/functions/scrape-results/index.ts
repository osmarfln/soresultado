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

interface DrawResult {
  draw_time: string;
  prizes: Array<{ milhar: string; group: number; bicho: string }>;
}

// Parse ojogodobicho.com/deu_no_poste.htm format - PRIMARY SOURCE
// Table format: | | PPT | PTM | PT | PTV | PTN | COR | with cells like "1584-21"
function parseOJogoDoBichoFormat(markdown: string): DrawResult[] {
  const results: DrawResult[] = [];
  const DRAW_TIMES = ['PPT', 'PTM', 'PT', 'PTV', 'PTN', 'COR'];

  const lines = markdown.split('\n');
  let headerIdx = -1;
  let allCols: string[] = [];

  // Find header row containing draw time columns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match any header containing at least 2 draw time codes
    const drawTimesInLine = DRAW_TIMES.filter(dt => line.includes(dt));
    if (drawTimesInLine.length >= 2) {
      allCols = line.split('|').map(c => c.trim());
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    console.log('ojogodobicho: header row not found');
    return results;
  }

  // Map column indices to draw times (keep raw indices including empty cols)
  const colIndexToDrawTime: Record<number, string> = {};
  for (let i = 0; i < allCols.length; i++) {
    if (DRAW_TIMES.includes(allCols[i])) {
      colIndexToDrawTime[i] = allCols[i];
    }
  }

  const foundTimes = Object.values(colIndexToDrawTime);
  console.log(`ojogodobicho columns found: ${foundTimes.join(', ')}`);

  // Initialize prizes per draw time
  const prizesMap: Record<string, Array<{ milhar: string; group: number; bicho: string }>> = {};
  for (const dt of foundTimes) {
    prizesMap[dt] = [];
  }

  // Parse data rows (skip header + separator line)
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;

    // Split keeping all columns (including empty from leading/trailing |)
    const rawCells = line.split('|').map(c => c.trim());

    // Find the row number from the first non-empty cell
    let rowNum = NaN;
    for (const cell of rawCells) {
      if (cell && /^\d+$/.test(cell)) {
        rowNum = parseInt(cell);
        break;
      }
    }
    if (isNaN(rowNum) || rowNum < 1 || rowNum > 5) continue;

    // Match each cell to its header column by index
    for (const [idxStr, dt] of Object.entries(colIndexToDrawTime)) {
      const idx = parseInt(idxStr);
      if (idx >= rawCells.length) continue;
      const cell = rawCells[idx];
      const cellMatch = cell.match(/(\d{4})-(\d+)/);
      if (cellMatch) {
        const milhar = cellMatch[1];
        const group = parseInt(cellMatch[2]);
        if (milhar !== '0000') {
          prizesMap[dt].push({ milhar, group, bicho: BICHOS[group] || 'Desconhecido' });
        }
      }
    }
  }

  // Build results
  for (const dt of DRAW_TIMES) {
    if (prizesMap[dt] && prizesMap[dt].length >= 5) {
      console.log(`✅ ojogodobicho parsed ${dt}: ${prizesMap[dt][0].milhar} (${prizesMap[dt][0].bicho})`);
      results.push({ draw_time: dt, prizes: prizesMap[dt].slice(0, 5) });
    }
  }

  return results;
}

// Parse loteriasbr.com format (backup source)
function parseLoteriasBrFormat(markdown: string): DrawResult[] {
  const results: DrawResult[] = [];
  const headerRegex = /(PPT|PTM|PTV|PTN|COR|PT)-RJ\s+\d{2}:\d{2}/gi;
  const TIME_ALIASES: Record<string, string> = {
    'ppt': 'PPT', 'ptm': 'PTM', 'pt': 'PT', 'ptv': 'PTV', 'ptn': 'PTN', 'cor': 'COR',
  };
  const headerPositions: Array<{ time: string; index: number }> = [];
  let hMatch;
  while ((hMatch = headerRegex.exec(markdown)) !== null) {
    const timeCode = hMatch[1].toUpperCase();
    headerPositions.push({ time: timeCode, index: hMatch.index });
  }

  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i].index;
    const end = i + 1 < headerPositions.length ? headerPositions[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);
    const drawTime = TIME_ALIASES[headerPositions[i].time.toLowerCase()] || headerPositions[i].time;

    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    const rowRegex = /\|\s*(\d)°\s*\|\s*([\d\s]*(?:<br>[\d\s]*)*)\s*\|\s*(\d+)\s*\|/g;
    let rMatch;
    while ((rMatch = rowRegex.exec(section)) !== null) {
      if (parseInt(rMatch[1]) > 5) continue;
      const digitsRaw = rMatch[2].replace(/<br>/g, '').replace(/\s/g, '');
      if (digitsRaw.length !== 4) continue;
      const group = parseInt(rMatch[3]);
      prizes.push({ milhar: digitsRaw, group, bicho: BICHOS[group] || 'Desconhecido' });
    }

    if (prizes.length >= 5) {
      results.push({ draw_time: drawTime, prizes: prizes.slice(0, 5) });
    }
  }
  return results;
}

function toDateStringInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

const SOURCES = [
  { url: 'https://www.ojogodobicho.com/deu_no_poste.htm', parser: 'ojogodobicho' as const, waitFor: 5000 },
  { url: 'https://loteriasbr.com/', parser: 'loteriasbr' as const, waitFor: 8000 },
];

async function scrapeSource(apiKey: string, source: typeof SOURCES[0]): Promise<DrawResult[]> {
  try {
    console.log(`Scraping ${source.url}...`);
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: source.url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: source.waitFor,
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl error for ${source.url}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    if (!markdown) return [];

    console.log(`Got ${markdown.length} chars from ${source.url}`);

    switch (source.parser) {
      case 'ojogodobicho': return parseOJogoDoBichoFormat(markdown);
      case 'loteriasbr': return parseLoteriasBrFormat(markdown);
      default: return [];
    }
  } catch (error) {
    console.error(`Error scraping ${source.url}:`, error);
    return [];
  }
}

// Cross-validate: prefer deunopostecarioca, fallback to others
function mergeResults(allResults: DrawResult[][]): DrawResult[] {
  const byTime = new Map<string, DrawResult>();
  // Later sources override earlier ones, so put primary source last
  for (const results of allResults.reverse()) {
    for (const r of results) {
      if (!byTime.has(r.draw_time)) {
        byTime.set(r.draw_time, r);
      }
    }
  }
  return Array.from(byTime.values());
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

    let targetTime: string | null = null;
    if (req.method === 'POST') {
      try { const body = await req.json(); targetTime = body.draw_time || null; } catch {}
    }

    const { data: existing } = await supabase
      .from('draw_results').select('draw_time').eq('draw_date', today);
    const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

    // Scrape all sources in parallel
    const allScraped = await Promise.allSettled(
      SOURCES.map(s => scrapeSource(firecrawlKey, s))
    );

    const successfulResults = allScraped
      .filter((r): r is PromiseFulfilledResult<DrawResult[]> => r.status === 'fulfilled')
      .map(r => r.value);

    const validated = mergeResults(successfulResults);
    console.log(`Merged ${validated.length} draw results: ${validated.map(r => r.draw_time).join(', ')}`);

    let inserted = 0, updated = 0;
    for (const result of validated) {
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
      }
    }

    return new Response(JSON.stringify({
      success: true, date: today, scraped_sources: SOURCES.length,
      validated_results: validated.length, inserted, updated, existing: existingTimes.size,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
