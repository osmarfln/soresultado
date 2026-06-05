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

const ALL_SP_TIMES = ['PTSP_0820', 'PTSP_1000', 'PTSP_1300', 'BAND_1530', 'PTSP_1900', 'PTNSP_2000'];

// Megabicho header mapping
const HEADER_TO_ENUM: Record<string, string> = {
  'PT-SP - 08h20': 'PTSP_0820',
  'PT-SP - 10h00': 'PTSP_1000',
  'PT-SP - 13h00': 'PTSP_1300',
  'BANDEIRANTES - 15h30': 'BAND_1530',
  'PT-SP - 19h00': 'PTSP_1900',
  'PTN-SP - 20h00': 'PTNSP_2000',
};

// Bichocerto header mapping (uses different time labels)
const BICHOCERTO_HEADER_TO_ENUM: Record<string, string> = {
  'PT-SP 08:40': 'PTSP_0820',
  'PT-SP 08:20': 'PTSP_0820',
  'PT-SP 10:40': 'PTSP_1000',
  'PT-SP 10:00': 'PTSP_1000',
  'PT-SP 13:40': 'PTSP_1300',
  'PT-SP 13:00': 'PTSP_1300',
  'BAND 15:30': 'BAND_1530',
  'BAND 15:00': 'BAND_1530',
  'PT-SP 17:40': 'PTSP_1900',  // bichocerto uses 17:40 for the 19h draw sometimes
  'PT-SP 19:20': 'PTSP_1900',
  'PT-SP 19:00': 'PTSP_1900',
  'PT-SP 20:40': 'PTNSP_2000',
  'PT-SP 20:00': 'PTNSP_2000',
  'PTN-SP 20:40': 'PTNSP_2000',
  'PTN-SP 20:00': 'PTNSP_2000',
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
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseBrazilianDateSlash(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

// ── Megabicho parser ──
function parseMegabichoMarkdown(markdown: string, filterDate?: string): DrawResult[] {
  const results: DrawResult[] = [];
  const sectionRegex = /(\d{2})[\.\/](\d{2})[\.\/](\d{4})\s*\\?\|\s*([^\n]+)/g;
  const sectionPositions: Array<{ date: string; header: string; index: number }> = [];
  let match;

  while ((match = sectionRegex.exec(markdown)) !== null) {
    const dateStr = `${match[3]}-${match[2]}-${match[1]}`;
    const header = match[4].trim();
    sectionPositions.push({ date: dateStr, header, index: match.index });
  }

  for (let i = 0; i < sectionPositions.length; i++) {
    const { date, header, index: start } = sectionPositions[i];
    const end = i + 1 < sectionPositions.length ? sectionPositions[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);

    if (filterDate && date !== filterDate) continue;

    const enumVal = HEADER_TO_ENUM[header];
    if (!enumVal) { console.log(`Unknown SP header: "${header}", skipping`); continue; }

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
      console.log(`✅ SP-mega ${enumVal} (${date}): ${prizes[0].milhar} (${prizes[0].bicho})`);
    }
  }
  return results;
}

// ── Bichocerto parser ──
function parseBichocertoMarkdown(markdown: string, filterDate?: string): DrawResult[] {
  const results: DrawResult[] = [];
  const seen = new Set<string>();

  // Match headers like "##### Resultado PT-SP 20:40" or "##### Resultado BAND 15:30"
  const headerRegex = /#{1,5}\s*Resultado\s+([^\n]+)/g;
  const headers: Array<{ label: string; index: number }> = [];
  let match;

  while ((match = headerRegex.exec(markdown)) !== null) {
    headers.push({ label: match[1].trim(), index: match.index });
  }

  for (let i = 0; i < headers.length; i++) {
    const { label } = headers[i];
    const enumVal = BICHOCERTO_HEADER_TO_ENUM[label];
    if (!enumVal || seen.has(enumVal)) continue;

    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);

    // Check date in section: "30/03/2026 - bichocerto.com"
    const dateMatch = section.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*bichocerto/);
    if (dateMatch) {
      const sectionDate = parseBrazilianDateSlash(dateMatch[1]);
      if (filterDate && sectionDate !== filterDate) continue;
    }

    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    // Parse: | 1º | ##### 🦩 | ##### [6902](url) | ##### 01 | ##### Avestruz |
    const rowRegex = /\|\s*(\d{1,2})º\s*\|[^|]*\|\s*#{0,5}\s*\[?(\d{3,4})\]?[^|]*\|\s*#{0,5}\s*(\d{1,2})\s*\|\s*#{0,5}\s*([^|]+)\|/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(section)) !== null) {
      const pos = parseInt(rowMatch[1]);
      if (pos > 5) continue;
      const milhar = rowMatch[2].padStart(4, '0');
      const group = parseInt(rowMatch[3]);
      const bicho = BICHOS[group] || rowMatch[4].trim();
      prizes.push({ milhar, group, bicho });
    }

    if (prizes.length >= 5) {
      seen.add(enumVal);
      const dateFromSection = section.match(/(\d{2}\/\d{2}\/\d{4})/);
      const drawDate = dateFromSection ? parseBrazilianDateSlash(dateFromSection[1]) || filterDate || '' : filterDate || '';
      results.push({ draw_date: drawDate, draw_time: enumVal, prizes: prizes.slice(0, 5) });
      console.log(`✅ SP-bicho ${enumVal} (${drawDate}): ${prizes[0].milhar} (${prizes[0].bicho})`);
    }
  }
  return results;
}

// ── Scrape megabicho via Firecrawl ──
async function scrapeMegabicho(firecrawlKey: string, dateSlug: string): Promise<string> {
  const url = dateSlug === 'today'
    ? 'https://megabicho.com/jogo-do-bicho/resultados/sp'
    : `https://megabicho.com/jogo-do-bicho/resultados/sp/dia/${dateSlug}`;

  console.log(`Fetching megabicho: ${url}...`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url, formats: ['markdown'], onlyMainContent: true, waitFor: 3000,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.data?.markdown || data.markdown || '';
      }
      const text = await response.text();
      console.error(`Firecrawl attempt ${attempt + 1} error ${response.status}: ${text}`);
    } catch (e) {
      console.error(`Firecrawl attempt ${attempt + 1} exception:`, e);
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
  }
  return '';
}

// ── Scrape bichocerto via Firecrawl (direct fetch is blocked by 503) ──
async function scrapeBichocerto(firecrawlKey: string): Promise<string> {
  const url = `https://bichocerto.com/resultados/sp/pt-band/?_=${Date.now()}`;
  console.log(`Fetching bichocerto via Firecrawl: ${url}...`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url, formats: ['markdown'], onlyMainContent: true, waitFor: 10000, timeout: 60000, maxAge: 0,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.data?.markdown || data.markdown || '';
      }
      const text = await response.text();
      console.error(`Bichocerto Firecrawl attempt ${attempt + 1} error ${response.status}: ${text}`);
    } catch (e) {
      console.error(`Bichocerto Firecrawl attempt ${attempt + 1} exception:`, e);
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
  }
  return '';
}

// ── Upsert helper ──
function buildRow(today: string, result: DrawResult) {
  const p = result.prizes;
  return {
    draw_date: result.draw_date || today,
    draw_time: result.draw_time,
    prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
    prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
    prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
    prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
    prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
    status: 'confirmed', updated_at: new Date().toISOString(),
  };
}

function isFederalDrawDay(dateStr: string): boolean {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return day === 3 || day === 6; // Wednesday or Saturday in America/Sao_Paulo calendar date
}

function buildPtnSpFromFederal(dateStr: string, federal: any): DrawResult | null {
  const prizes = [1, 2, 3, 4, 5].map((index) => {
    const milhar = federal?.[`prize_${index}_milhar`];
    const group = federal?.[`prize_${index}_group`];
    const bicho = federal?.[`prize_${index}_bicho`];
    if (!milhar || !group || !bicho) return null;
    return { milhar: String(milhar).padStart(4, '0'), group: Number(group), bicho: String(bicho) };
  });

  if (prizes.some((prize) => !prize)) return null;
  return { draw_date: dateStr, draw_time: 'PTNSP_2000', prizes: prizes as DrawResult['prizes'] };
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
      const startDate = new Date(importFrom + 'T12:00:00Z');
      const endDate = new Date(importTo + 'T12:00:00Z');
      const current = new Date(startDate);

      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        try {
          const markdown = await scrapeMegabicho(firecrawlKey, dateStr);
          if (markdown) {
            const results = parseMegabichoMarkdown(markdown);
            for (const result of results) {
              const { error } = await supabase.from('sp_results').upsert(buildRow(dateStr, result), { onConflict: 'draw_date,draw_time' });
              if (error) console.error(`Error upserting SP ${result.draw_time} ${dateStr}:`, error);
              else totalInserted++;
            }

            if (isFederalDrawDay(dateStr) && !results.some(result => result.draw_time === 'PTNSP_2000')) {
              const { data: federal } = await supabase
                .from('federal_results')
                .select('prize_1_milhar, prize_1_group, prize_1_bicho, prize_2_milhar, prize_2_group, prize_2_bicho, prize_3_milhar, prize_3_group, prize_3_bicho, prize_4_milhar, prize_4_group, prize_4_bicho, prize_5_milhar, prize_5_group, prize_5_bicho')
                .eq('draw_date', dateStr)
                .maybeSingle();
              const federalFallback = federal ? buildPtnSpFromFederal(dateStr, federal) : null;
              if (federalFallback) {
                const { error } = await supabase.from('sp_results').upsert(buildRow(dateStr, federalFallback), { onConflict: 'draw_date,draw_time' });
                if (error) console.error(`Error upserting Federal fallback SP PTNSP_2000 ${dateStr}:`, error);
                else { totalInserted++; console.log(`📥 Federal fallback inserted PTNSP_2000 (${dateStr})`); }
              }
            }
          }
        } catch (e) {
          console.error(`Error scraping ${dateStr}:`, e);
        }
        current.setDate(current.getDate() + 1);
      }
    } else {
      // ── Today mode: Bicho Certo is the official primary source, Megabicho is only a fallback ──
      const { data: existing } = await supabase
        .from('sp_results').select('draw_time').eq('draw_date', today);
      const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

      // Step 1: Bicho Certo (primary)
      const bichoMarkdown = await scrapeBichocerto(firecrawlKey);
      const bichoResults = bichoMarkdown ? parseBichocertoMarkdown(bichoMarkdown, today) : [];

      for (const result of bichoResults) {
        const isExisting = existingTimes.has(result.draw_time);
        const { error } = await supabase.from('sp_results').upsert(buildRow(today, result), { onConflict: 'draw_date,draw_time' });
        if (error) console.error(`Error upserting SP ${result.draw_time}:`, error);
        else { if (isExisting) totalUpdated++; else totalInserted++; existingTimes.add(result.draw_time); }
      }

      // Step 2: Check what's missing
      const foundTimes = new Set(bichoResults.map(r => r.draw_time));
      const missingTimes = ALL_SP_TIMES.filter(t => !foundTimes.has(t) && !existingTimes.has(t));

      if (missingTimes.length > 0) {
        console.log(`Missing from Bicho Certo: ${missingTimes.join(', ')}. Trying megabicho fallback...`);
        
        const megaMarkdown = await scrapeMegabicho(firecrawlKey, 'today');
        if (megaMarkdown) {
          const fallbackResults = parseMegabichoMarkdown(megaMarkdown, today);
          
          for (const result of fallbackResults) {
            if (!missingTimes.includes(result.draw_time)) continue;
            const { error } = await supabase.from('sp_results').upsert(buildRow(today, result), { onConflict: 'draw_date,draw_time' });
            if (error) console.error(`Error upserting fallback SP ${result.draw_time}:`, error);
            else { totalInserted++; existingTimes.add(result.draw_time); console.log(`📥 Fallback inserted ${result.draw_time}`); }
          }
        }

        if (missingTimes.includes('PTNSP_2000') && !existingTimes.has('PTNSP_2000') && isFederalDrawDay(today)) {
          console.log('PTNSP_2000 still missing. Trying Federal fallback...');
          const { data: federal } = await supabase
            .from('federal_results')
            .select('prize_1_milhar, prize_1_group, prize_1_bicho, prize_2_milhar, prize_2_group, prize_2_bicho, prize_3_milhar, prize_3_group, prize_3_bicho, prize_4_milhar, prize_4_group, prize_4_bicho, prize_5_milhar, prize_5_group, prize_5_bicho')
            .eq('draw_date', today)
            .maybeSingle();
          const federalFallback = federal ? buildPtnSpFromFederal(today, federal) : null;
          if (federalFallback) {
            const { error } = await supabase.from('sp_results').upsert(buildRow(today, federalFallback), { onConflict: 'draw_date,draw_time' });
            if (error) console.error('Error upserting Federal fallback SP PTNSP_2000:', error);
            else { totalInserted++; existingTimes.add('PTNSP_2000'); console.log('📥 Federal fallback inserted PTNSP_2000'); }
          } else {
            console.log('Federal fallback unavailable for PTNSP_2000. Will retry on next scheduled run.');
          }
        }
      } else {
        console.log('All SP draw times found from megabicho, no fallback needed.');
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
