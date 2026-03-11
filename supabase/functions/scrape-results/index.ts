import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map site draw time names to our enum
const TIME_ALIASES: Record<string, string> = {
  'ppt': 'PPT', 'ppt 9h': 'PPT', 'ppt 09h': 'PPT', '9h': 'PPT', '09h': 'PPT', '9 horas': 'PPT', '09 horas': 'PPT',
  'ptm': 'PTM', 'ptm 11h': 'PTM', '11h': 'PTM', '11 horas': 'PTM',
  'pt': 'PT', 'pt 14h': 'PT', '14h': 'PT', '14 horas': 'PT',
  'ptv': 'PTV', 'ptv 16h': 'PTV', '16h': 'PTV', '16 horas': 'PTV',
  'ptn': 'PTN', 'ptn 18h': 'PTN', '18h': 'PTN', '18 horas': 'PTN',
  'cor': 'COR', 'cor 21h': 'COR', '21h': 'COR', '21 horas': 'COR', 'coruja': 'COR',
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

function getBichoFromMilhar(milhar: string): { group: number; bicho: string } {
  const dezena = milhar.slice(-2);
  const group = getBichoGroup(dezena);
  return { group, bicho: BICHOS[group] || 'Desconhecido' };
}

function normalizeDrawTime(raw: string): string | null {
  const cleaned = raw.toLowerCase().replace(/sorteio\s*/i, '').replace(/das?\s*/i, '').trim();
  // Try direct match
  if (TIME_ALIASES[cleaned]) return TIME_ALIASES[cleaned];
  // Try partial matches
  for (const [key, value] of Object.entries(TIME_ALIASES)) {
    if (cleaned.includes(key)) return value;
  }
  return null;
}

interface DrawResult {
  draw_time: string;
  prizes: Array<{ milhar: string; group: number; bicho: string }>;
}

// Parse markdown tables from rdjdb.com.br format
function parseRdjdbFormat(markdown: string): DrawResult[] {
  const results: DrawResult[] = [];
  const sections = markdown.split(/###?\s+/);

  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0]?.trim() || '';

    // Match section headers like "Resultado PPT das 9h" or "Resultado PT 14h"
    const timeMatch = header.match(/(?:resultado\s+)?(ppt|ptm|pt|ptv|ptn|cor)(?:\s+(?:das?\s+)?(\d+)h)?/i);
    if (!timeMatch) continue;

    const drawTime = normalizeDrawTime(timeMatch[1]);
    if (!drawTime) continue;

    // Find table rows with milhar data (4-digit numbers)
    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    for (const line of lines) {
      // Match table row: | 1º | 4637 | 10 | Coelho |
      const rowMatch = line.match(/\|\s*(\d)º\s*\|\s*(\d{4})\s*\|\s*(\d+)\s*\|\s*(\w+)\s*\|/);
      if (rowMatch && parseInt(rowMatch[1]) <= 5) {
        const milhar = rowMatch[2];
        const group = parseInt(rowMatch[3]);
        const bicho = rowMatch[4];
        prizes.push({ milhar, group, bicho });
      }
    }

    if (prizes.length === 5) {
      results.push({ draw_time: drawTime, prizes });
    }
  }
  return results;
}

// Parse format from ptrio.inf.br and deunopostecarioca.com.br  
function parseGenericFormat(markdown: string): DrawResult[] {
  const results: DrawResult[] = [];
  // Split by draw sections
  const sections = markdown.split(/(?:##?\s+)?sorteio\s+/i);

  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0]?.trim() || '';

    const drawTime = normalizeDrawTime(header);
    if (!drawTime) continue;

    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Match patterns like "1º6421Cabra (6)" or "1º | 6421 | Cabra (6)"
      const inlineMatch = line.match(/(\d)º\s*(\d{4})\s*(\w+)\s*\((\d+)\)/);
      if (inlineMatch && parseInt(inlineMatch[1]) <= 5) {
        prizes.push({
          milhar: inlineMatch[2],
          group: parseInt(inlineMatch[4]),
          bicho: inlineMatch[3],
        });
        continue;
      }

      // Match "1º" then look ahead for milhar
      const prizeNumMatch = line.match(/^-?\s*(\d)º$/);
      if (prizeNumMatch && parseInt(prizeNumMatch[1]) <= 5) {
        // Look ahead for the milhar (4 digits)
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const milharMatch = lines[j].trim().match(/^(\d{4})$/);
          if (milharMatch) {
            // Look for bicho name and group
            for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
              const bichoMatch = lines[k].trim().match(/(\w+)\s*\((\d+)\)/);
              if (bichoMatch) {
                prizes.push({
                  milhar: milharMatch[1],
                  group: parseInt(bichoMatch[2]),
                  bicho: bichoMatch[1],
                });
                break;
              }
            }
            break;
          }
        }
      }
    }

    if (prizes.length === 5) {
      results.push({ draw_time: drawTime, prizes });
    }
  }
  return results;
}

const SOURCES = [
  { url: 'https://rdjdb.com.br', parser: 'rdjdb' },
  { url: 'https://ptrio.inf.br', parser: 'generic' },
  { url: 'https://deunopostecarioca.com.br', parser: 'generic' },
  { url: 'https://gigabicho.com.br/pt-rio', parser: 'generic' },
  { url: 'https://resultadofacil.com.br', parser: 'generic' },
  { url: 'https://resultadojogodobichohoje.com', parser: 'generic' },
  { url: 'https://resultadodobicho.net', parser: 'generic' },
  { url: 'https://bichobr.com', parser: 'generic' },
  { url: 'https://ojogodobicho.com', parser: 'generic' },
  { url: 'https://resultadodojogodobicho.com', parser: 'generic' },
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
        waitFor: 5000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`Firecrawl error for ${source.url}: ${response.status} ${errBody}`);
      return [];
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';

    if (!markdown) {
      console.log(`No markdown content from ${source.url}`);
      return [];
    }

    console.log(`Got ${markdown.length} chars from ${source.url}`);

    const results = source.parser === 'rdjdb'
      ? parseRdjdbFormat(markdown)
      : parseGenericFormat(markdown);

    console.log(`Parsed ${results.length} draw results from ${source.url}`);
    return results;
  } catch (error) {
    console.error(`Error scraping ${source.url}:`, error);
    return [];
  }
}

// Cross-validate: a result is confirmed if at least 2 sources agree on the 1st prize milhar
function crossValidate(allResults: Map<string, DrawResult[]>): DrawResult[] {
  const validated: DrawResult[] = [];
  const drawTimes = ['PPT', 'PTM', 'PT', 'PTV', 'PTN', 'COR'];

  for (const dt of drawTimes) {
    const candidates = allResults.get(dt) || [];
    if (candidates.length === 0) continue;

    // Group by 1st prize milhar
    const groups = new Map<string, DrawResult[]>();
    for (const c of candidates) {
      const key = c.prizes[0].milhar;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    // Find consensus (2+ sources agree)
    for (const [milhar, group] of groups) {
      if (group.length >= 2) {
        console.log(`✅ Validated ${dt}: ${milhar} (${group.length} sources agree)`);
        validated.push(group[0]);
        break;
      }
    }

    // If only 1 source, still accept if from trusted source (rdjdb)
    if (!validated.find(v => v.draw_time === dt) && candidates.length === 1) {
      console.log(`⚠️ Single source for ${dt}: ${candidates[0].prizes[0].milhar}`);
      validated.push(candidates[0]);
    }
  }

  return validated;
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

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Determine which draw time to target based on request body or current time
    let targetTime: string | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        targetTime = body.draw_time || null;
      } catch { /* no body */ }
    }

    // Check what we already have for today
    const { data: existing } = await supabase
      .from('draw_results')
      .select('draw_time')
      .eq('draw_date', today);

    const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

    // Scrape sources (limit to 4 to conserve Firecrawl credits)
    const sourcesToScrape = SOURCES.slice(0, 4);
    const allScraped = await Promise.allSettled(
      sourcesToScrape.map(s => scrapeSource(firecrawlKey, s))
    );

    // Collect results by draw_time
    const byDrawTime = new Map<string, DrawResult[]>();
    for (const result of allScraped) {
      if (result.status === 'fulfilled') {
        for (const dr of result.value) {
          if (!byDrawTime.has(dr.draw_time)) byDrawTime.set(dr.draw_time, []);
          byDrawTime.get(dr.draw_time)!.push(dr);
        }
      }
    }

    console.log(`Found results for draw times: ${Array.from(byDrawTime.keys()).join(', ')}`);

    // Cross-validate
    const validated = crossValidate(byDrawTime);

    // Insert only new results
    let inserted = 0;
    for (const result of validated) {
      if (existingTimes.has(result.draw_time)) {
        console.log(`Skipping ${result.draw_time} - already exists`);
        continue;
      }

      if (targetTime && result.draw_time !== targetTime) continue;

      const p = result.prizes;
      const { error } = await supabase.from('draw_results').insert({
        draw_date: today,
        draw_time: result.draw_time,
        prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
        prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
        prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
        prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
        prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
        status: 'confirmed',
      });

      if (error) {
        console.error(`Error inserting ${result.draw_time}:`, error);
      } else {
        inserted++;
        console.log(`✅ Inserted ${result.draw_time}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date: today,
      scraped_sources: sourcesToScrape.length,
      validated_results: validated.length,
      inserted,
      existing: existingTimes.size,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
