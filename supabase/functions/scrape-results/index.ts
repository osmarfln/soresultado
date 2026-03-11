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

// Parse deunopostecarioca.com.br format - PRIMARY SOURCE
// Format: "#### Sorteio 9 horas PPT" then list items with milhar/bicho/group
function parseDeuNoPosteFormat(markdown: string): DrawResult[] {
  const results: DrawResult[] = [];

  // Map header text to draw_time enum
  const TIME_MAP: Record<string, string> = {
    'ppt': 'PPT',
    'ptm': 'PTM',
    'pt': 'PT',
    'ptv': 'PTV',
    'ptn': 'PTN',
    'corujinha': 'COR',
    'cor': 'COR',
  };

  // Find all "Sorteio X horas YYY" sections
  const sectionRegex = /####\s*Sorteio\s+(\d+)\s*horas?\s+(\w+)/gi;
  const sections: Array<{ time: string; index: number }> = [];
  let match;
  while ((match = sectionRegex.exec(markdown)) !== null) {
    const timeCode = match[2].toLowerCase();
    const mapped = TIME_MAP[timeCode];
    if (mapped) {
      sections.push({ time: mapped, index: match.index });
    }
  }

  console.log(`deunopostecarioca sections found: ${sections.map(s => s.time).join(', ')}`);

  // Get today's date string (dd/mm/yyyy) for filtering only today's results
  const now = new Date();
  const todayParts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(now);
  const todayStr = `${todayParts.find(p => p.type === 'day')?.value}/${todayParts.find(p => p.type === 'month')?.value}/${todayParts.find(p => p.type === 'year')?.value}`;

  const seen = new Set<string>();
  for (let i = 0; i < sections.length; i++) {
    const { time } = sections[i];
    if (seen.has(time)) continue; // Only take first occurrence (most recent)

    const start = sections[i].index;
    const end = i + 1 < sections.length ? sections[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);

    // Check if this section is for today
    const dateMatch = section.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch && dateMatch[1] !== todayStr) {
      console.log(`Skipping ${time} - date ${dateMatch[1]} is not today (${todayStr})`);
      continue;
    }

    // Parse prizes: look for "- Nº" followed by milhar (4 digits) and bicho name with (group)
    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    const lines = section.split('\n').map(l => l.trim()).filter(l => l);

    for (let j = 0; j < lines.length; j++) {
      const prizeMatch = lines[j].match(/^-?\s*(\d)º$/);
      if (!prizeMatch || parseInt(prizeMatch[1]) > 5) continue;

      // Look ahead for milhar (4-digit number) and bicho name with group
      let milhar = '';
      let group = 0;
      let bicho = '';
      for (let k = j + 1; k < Math.min(j + 10, lines.length); k++) {
        // Match 4-digit milhar
        if (!milhar && /^\d{4}$/.test(lines[k])) {
          milhar = lines[k];
          continue;
        }
        // Match bicho name
        if (milhar && !bicho && /^[A-ZÀ-Úa-zà-ú]+$/.test(lines[k])) {
          bicho = lines[k];
          continue;
        }
        // Match group number in parentheses
        if (milhar && /^\((\d+)\)$/.test(lines[k])) {
          const gMatch = lines[k].match(/^\((\d+)\)$/);
          if (gMatch) group = parseInt(gMatch[1]);
          break;
        }
      }

      if (milhar && group > 0) {
        bicho = bicho || BICHOS[group] || 'Desconhecido';
        prizes.push({ milhar, group, bicho });
      }
    }

    if (prizes.length >= 5) {
      seen.add(time);
      console.log(`✅ deunopostecarioca parsed ${time}: ${prizes[0].milhar} (${prizes[0].bicho})`);
      results.push({ draw_time: time, prizes: prizes.slice(0, 5) });
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
  { url: 'https://deunopostecarioca.com.br/', parser: 'deunoposte' as const, waitFor: 5000 },
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
      case 'deunoposte': return parseDeuNoPosteFormat(markdown);
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
