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

const ALL_SP_TIMES = ['PTSP_0820', 'PTSP_1000', 'PTSP_1300', 'BAND_1530', 'PTSP_1900', 'PTNSP_2000', 'PTSP_2040'];

// Megabicho header mapping
const HEADER_TO_ENUM: Record<string, string> = {
  'PT-SP - 08h20': 'PTSP_0820',
  'PT-SP - 10h00': 'PTSP_1000',
  'PT-SP - 13h00': 'PTSP_1300',
  'BANDEIRANTES - 15h30': 'BAND_1530',
  'PT-SP - 19h00': 'PTSP_1900',
  'PTN-SP - 20h00': 'PTNSP_2000',
  'PTN-SP - 20h30': 'PTNSP_2000',
};

// Bichocerto header mapping (uses different time labels)
const BICHOCERTO_HEADER_TO_ENUM: Record<string, string> = {
  'PT-SP 08:40': 'PTSP_0820',
  'PT-SP 08:20': 'PTSP_0820',
  'PT-SP 08:30': 'PTSP_0820',
  'PT-SP 10:40': 'PTSP_1000',
  'PT-SP 10:00': 'PTSP_1000',
  'PT-SP 10:30': 'PTSP_1000',
  'PT-SP 12:20': 'PTSP_1300',
  'PT-SP 12:30': 'PTSP_1300',
  'PT-SP 13:40': 'PTSP_1300',
  'PT-SP 13:00': 'PTSP_1300',
  'BAND 15:30': 'BAND_1530',
  'BAND 15:00': 'BAND_1530',
  'PT-SP 17:40': 'PTSP_1900',  // bichocerto uses 17:40 for the 19h draw sometimes
  'PT-SP 19:20': 'PTSP_1900',
  'PT-SP 19:00': 'PTSP_1900',
  'PT-SP 20:40': 'PTSP_2040',
  'PT-SP 20:00': 'PTNSP_2000',
  'PTN-SP 20:40': 'PTSP_2040',
  'PTN-SP 20:00': 'PTNSP_2000',
  'PT-SP 20:30': 'PTNSP_2000',
  'PTN-SP 20:30': 'PTNSP_2000',
};

// Vejaoresultado header mapping (format: PTSP-13:00, BAND-15:00, PTNSP-20:00, etc.)
const VEJAO_HEADER_TO_ENUM: Record<string, string> = {
  'PTSP-08:20': 'PTSP_0820',
  'PT-SP-08:20': 'PTSP_0820',
  'PTSP-10:00': 'PTSP_1000',
  'PT-SP-10:00': 'PTSP_1000',
  'PTSP-13:00': 'PTSP_1300',
  'PT-SP-13:00': 'PTSP_1300',
  'BAND-15:00': 'BAND_1530',
  'BAND-15:30': 'BAND_1530',
  'BANDEIRANTES-15:00': 'BAND_1530',
  'BANDEIRANTES-15:30': 'BAND_1530',
  'PTSP-19:00': 'PTSP_1900',
  'PT-SP-19:00': 'PTSP_1900',
  'PTNSP-20:00': 'PTNSP_2000',
  'PTN-SP-20:00': 'PTNSP_2000',
  'PTNSP-20:30': 'PTNSP_2000',
  'PTN-SP-20:30': 'PTNSP_2000',
  'PTSP-20:30': 'PTNSP_2000',
  'PTSP-20:40': 'PTSP_2040',
  'PT-SP-20:40': 'PTSP_2040',
  'PTN-SP - 20h40': 'PTSP_2040',
  'PT-SP - 20h40': 'PTSP_2040',
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

function parseBichocertoHtml(html: string, filterDate?: string): DrawResult[] {
  const results: DrawResult[] = [];
  const seen = new Set<string>();
  const sectionRegex = /<h5[^>]*>\s*Resultado\s+([^<]+?)\s*<\/h5>\s*<p[^>]*>\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*bichocerto\.com\s*<\/p>[\s\S]*?<table\b[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/gi;
  let sectionMatch;

  while ((sectionMatch = sectionRegex.exec(html)) !== null) {
    const label = sectionMatch[1].replace(/\s+/g, ' ').trim();
    const enumVal = BICHOCERTO_HEADER_TO_ENUM[label];
    const drawDate = parseBrazilianDateSlash(sectionMatch[2]);
    const seenKey = `${drawDate}-${enumVal}`;

    if (!enumVal || !drawDate || seen.has(seenKey)) continue;
    if (filterDate && drawDate !== filterDate) continue;

    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    const rowRegex = /<tr[^>]*>[\s\S]*?(\d{1,2})º[\s\S]*?<a[^>]*>\s*(\d{3,4})[\s\S]*?<\/a>[\s\S]*?<td[^>]*>\s*<h5[^>]*>\s*(\d{1,2})\s*<\/h5>\s*<\/td>\s*<td[^>]*>\s*<h5[^>]*>\s*([^<]+?)\s*<\/h5>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(sectionMatch[3])) !== null) {
      const pos = parseInt(rowMatch[1], 10);
      if (pos > 5) continue;
      const group = parseInt(rowMatch[3], 10);
      prizes.push({
        milhar: rowMatch[2].padStart(4, '0'),
        group,
        bicho: BICHOS[group] || rowMatch[4].trim(),
      });
    }

    if (prizes.length >= 5) {
      seen.add(seenKey);
      results.push({ draw_date: drawDate, draw_time: enumVal, prizes: prizes.slice(0, 5) });
      console.log(`✅ SP-bichocerto-html ${enumVal} (${drawDate}): ${prizes[0].milhar} (${prizes[0].bicho})`);
    }
  }
  return results;
}

// ── Vejaoresultado.com parser (primary source for SP) ──
// Sections look like: **PTNSP-20:00**  **18/07/2026** followed by a table with |Prêmio|Resultado|Grupo|
function parseVejaoResultado(markdown: string, filterDate?: string): DrawResult[] {
  const results: DrawResult[] = [];
  const seen = new Set<string>();
  // Match header + date on the same line (bold markdown)
  const headerRegex = /\*\*([A-Z][A-Z-]+-\d{2}:\d{2})\*\*\s*\*\*(\d{2}\/\d{2}\/\d{4})\*\*/g;
  let match;
  const headers: Array<{ label: string; date: string; index: number }> = [];
  while ((match = headerRegex.exec(markdown)) !== null) {
    const date = parseBrazilianDateSlash(match[2]);
    if (!date) continue;
    headers.push({ label: match[1].toUpperCase(), date, index: match.index });
  }

  for (let i = 0; i < headers.length; i++) {
    const { label, date, index: start } = headers[i];
    const enumVal = VEJAO_HEADER_TO_ENUM[label];
    if (!enumVal) continue;
    const key = `${date}-${enumVal}`;
    if (seen.has(key)) continue;
    if (filterDate && date !== filterDate) continue;

    const end = i + 1 < headers.length ? headers[i + 1].index : Math.min(markdown.length, start + 2000);
    const section = markdown.substring(start, end);

    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    // Rows: | 1º | 0717 | 05 - Cachorro |
    const rowRegex = /\|\s*(\d)º\s*\|\s*(\d{3,4})\s*\|\s*(\d{1,2})\s*-\s*([^\|]+?)\s*\|/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(section)) !== null) {
      const pos = parseInt(rowMatch[1]);
      if (pos < 1 || pos > 5) continue;
      const group = parseInt(rowMatch[3]);
      prizes.push({
        milhar: rowMatch[2].padStart(4, '0'),
        group,
        bicho: BICHOS[group] || rowMatch[4].trim(),
      });
    }

    if (prizes.length >= 5) {
      seen.add(key);
      results.push({ draw_date: date, draw_time: enumVal, prizes: prizes.slice(0, 5) });
      console.log(`✅ SP-vejao ${enumVal} (${date}): ${prizes[0].milhar} (${prizes[0].bicho})`);
    }
  }
  return results;
}

async function fetchVejaoResultado(): Promise<string> {
  const url = `https://www.vejaoresultado.com/?_=${Date.now()}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });
    if (!response.ok) {
      console.error(`Vejaoresultado direct fetch error ${response.status}`);
      return '';
    }
    return await response.text();
  } catch (e) {
    console.error('Vejaoresultado fetch exception:', e);
    return '';
  }
}

// Parse SP sections directly from vejaoresultado HTML: <h3>LABEL</h3><h5>DATE</h5>...<tbody>...</tbody>
function parseVejaoResultadoHtml(html: string, filterDate?: string): DrawResult[] {
  const results: DrawResult[] = [];
  const seen = new Set<string>();
  const sectionRegex = /<h3>\s*([A-Z][A-Z-]+-\d{2}:\d{2})\s*<\/h3>\s*<h5>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/h5>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/gi;
  let m;
  while ((m = sectionRegex.exec(html)) !== null) {
    const label = m[1].toUpperCase();
    const date = parseBrazilianDateSlash(m[2]);
    if (!date) continue;
    const enumVal = VEJAO_HEADER_TO_ENUM[label];
    if (!enumVal) continue;
    const key = `${date}-${enumVal}`;
    if (seen.has(key)) continue;
    if (filterDate && date !== filterDate) continue;

    const rowRegex = /<tr[^>]*>\s*<td[^>]*>\s*(\d)º\s*<\/td>\s*<td[^>]*>\s*(\d{3,4})\s*<\/td>\s*<td[^>]*>\s*(\d{1,2})\s*-\s*([^<]+?)\s*<\/td>/gi;
    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    let r;
    while ((r = rowRegex.exec(m[3])) !== null) {
      const pos = parseInt(r[1]);
      if (pos < 1 || pos > 5) continue;
      const group = parseInt(r[3]);
      prizes.push({
        milhar: r[2].padStart(4, '0'),
        group,
        bicho: BICHOS[group] || r[4].trim(),
      });
    }
    if (prizes.length >= 5) {
      seen.add(key);
      results.push({ draw_date: date, draw_time: enumVal, prizes: prizes.slice(0, 5) });
      console.log(`✅ SP-vejao ${enumVal} (${date}): ${prizes[0].milhar} (${prizes[0].bicho})`);
    }
  }
  return results;
}


// ── Scrape megabicho via Firecrawl ──
async function scrapeMegabicho(firecrawlKey: string, lovableApiKey: string, dateSlug: string): Promise<string> {
  const url = dateSlug === 'today'
    ? 'https://megabicho.com/jogo-do-bicho/resultados/sp'
    : `https://megabicho.com/jogo-do-bicho/resultados/sp/dia/${dateSlug}`;

  console.log(`Fetching megabicho: ${url}...`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://connector-gateway.lovable.dev/firecrawl/v2/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'X-Connection-Api-Key': `${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
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

// ── Scrape bichocerto via Firecrawl fallback ──
async function scrapeBichocerto(firecrawlKey: string, lovableApiKey: string): Promise<string> {
  const url = `https://bichocerto.com/resultados/sp/pt-band/?_=${Date.now()}`;
  console.log(`Fetching bichocerto via Firecrawl: ${url}...`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://connector-gateway.lovable.dev/firecrawl/v2/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'X-Connection-Api-Key': `${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
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

async function fetchBichocertoHtml(dateStr?: string): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Referer': 'https://bichocerto.com/resultados/sp/pt-band/',
  };

  const response = dateStr
    ? await fetch('https://bichocerto.com/resultados/base/resultado/', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams({ l: 'sp', d: dateStr }).toString(),
      })
    : await fetch(`https://bichocerto.com/resultados/sp/pt-band/?_=${Date.now()}`, { headers });

  if (!response.ok) {
    console.error(`BichoCerto direct fetch error ${response.status} for ${dateStr || 'today'}`);
    return '';
  }

  return await response.text();
}

// ── Upsert helper ──
function buildRow(today: string, result: DrawResult, source: string = 'unknown') {
  const p = result.prizes;
  const now = new Date().toISOString();
  return {
    draw_date: result.draw_date || today,
    draw_time: result.draw_time,
    prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
    prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
    prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
    prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
    prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
    status: 'confirmed', updated_at: now,
    source, scraped_at: now,
  };
}

function isFederalDrawDay(dateStr: string): boolean {
  // SP deve usar a fonte própria (Bicho Certo); Federal não é mais fallback do PTN-SP.
  return false;
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

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const recordRun = async (values: Record<string, unknown>) => {
    const { error } = await supabase.from('scrape_robot_logs').insert({
      lottery: 'sp', source_url: 'https://www.vejaoresultado.com/',
      duration_ms: Date.now() - startedAt, ...values,
    });
    if (error) console.error('Could not save robot log:', error.message);
  };

  try {
    // Firecrawl é apenas fallback opcional — a coleta direta funciona sem chave.
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');


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
          const bichoHtml = await fetchBichocertoHtml(dateStr);
          let results = bichoHtml ? parseBichocertoHtml(bichoHtml, dateStr) : [];

          if (results.length === 0) {
            const markdown = await scrapeMegabicho(firecrawlKey, lovableApiKey, dateStr);
            results = markdown ? parseMegabichoMarkdown(markdown, dateStr) : [];
          }

          if (results.length > 0) {
            for (const result of results) {
              const { error } = await supabase.from('sp_results').upsert(buildRow(dateStr, result, 'bichocerto.com'), { onConflict: 'draw_date,draw_time' });
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
                const { error } = await supabase.from('sp_results').upsert(buildRow(dateStr, federalFallback, 'federal_results (fallback)'), { onConflict: 'draw_date,draw_time' });
                if (error) console.error(`Error upserting Federal fallback SP PTNSP_2000 ${dateStr}:`, error);
                else { totalInserted++; console.log(`📥 Federal fallback inserted PTNSP_2000 (${dateStr})`); }
              }
            }
          } else {
            console.log(`No SP results found for ${dateStr} on BichoCerto/fallback`);
          }
        } catch (e) {
          console.error(`Error scraping ${dateStr}:`, e);
        }
        current.setDate(current.getDate() + 1);
      }
    } else {
      // ── Today mode: Vejaoresultado é a fonte PRIMÁRIA, Bicho Certo e Megabicho são fallbacks ──
      const { data: existing } = await supabase
        .from('sp_results').select('draw_time').eq('draw_date', today);
      const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

      // Step 1: vejaoresultado.com (fonte oficial primária)
      const vejaoHtml = await fetchVejaoResultado();
      const vejaoResults = vejaoHtml ? parseVejaoResultadoHtml(vejaoHtml, today) : [];
      console.log(`Vejaoresultado retornou ${vejaoResults.length} resultados SP para ${today}`);

      for (const result of vejaoResults) {
        const isExisting = existingTimes.has(result.draw_time);
        const { error } = await supabase.from('sp_results').upsert(buildRow(today, result, 'vejaoresultado.com'), { onConflict: 'draw_date,draw_time' });
        if (error) console.error(`Error upserting SP ${result.draw_time}:`, error);
        else { if (isExisting) totalUpdated++; else totalInserted++; existingTimes.add(result.draw_time); }
      }

      const foundTimesAfterVejao = new Set(vejaoResults.map(r => r.draw_time));
      let missingTimes = ALL_SP_TIMES.filter(t => !foundTimesAfterVejao.has(t));

      // Step 2: Bicho Certo (fallback)
      if (missingTimes.length > 0) {
        console.log(`Faltando de vejaoresultado: ${missingTimes.join(', ')}. Tentando Bicho Certo...`);
        const bichoHtml = await fetchBichocertoHtml();
        let bichoResults = bichoHtml ? parseBichocertoHtml(bichoHtml, today) : [];
        if (bichoResults.length === 0) {
          const bichoMarkdown = await scrapeBichocerto(firecrawlKey, lovableApiKey);
          bichoResults = bichoMarkdown ? parseBichocertoMarkdown(bichoMarkdown, today) : [];
        }
        for (const result of bichoResults) {
          if (!missingTimes.includes(result.draw_time)) continue;
          const isExisting = existingTimes.has(result.draw_time);
          const { error } = await supabase.from('sp_results').upsert(buildRow(today, result, 'bichocerto.com'), { onConflict: 'draw_date,draw_time' });
          if (error) console.error(`Error upserting SP fallback ${result.draw_time}:`, error);
          else { if (isExisting) totalUpdated++; else totalInserted++; existingTimes.add(result.draw_time); }
        }
        missingTimes = ALL_SP_TIMES.filter(t => !existingTimes.has(t));
      }

      // Step 3: Megabicho (último fallback)
      if (missingTimes.length > 0) {
        console.log(`Ainda faltando: ${missingTimes.join(', ')}. Tentando megabicho...`);

        
        const megaMarkdown = await scrapeMegabicho(firecrawlKey, lovableApiKey, 'today');
        if (megaMarkdown) {
          const fallbackResults = parseMegabichoMarkdown(megaMarkdown, today);
          
          for (const result of fallbackResults) {
            if (!missingTimes.includes(result.draw_time)) continue;
            const isExisting = existingTimes.has(result.draw_time);
            const { error } = await supabase.from('sp_results').upsert(buildRow(today, result, 'megabicho.com'), { onConflict: 'draw_date,draw_time' });
            if (error) console.error(`Error upserting fallback SP ${result.draw_time}:`, error);
            else { if (isExisting) totalUpdated++; else totalInserted++; existingTimes.add(result.draw_time); console.log(`📥 Fallback upserted ${result.draw_time}`); }
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
            const { error } = await supabase.from('sp_results').upsert(buildRow(today, federalFallback, 'federal_results (fallback)'), { onConflict: 'draw_date,draw_time' });
            if (error) console.error('Error upserting Federal fallback SP PTNSP_2000:', error);
            else { totalInserted++; existingTimes.add('PTNSP_2000'); console.log('📥 Federal fallback inserted PTNSP_2000'); }
          } else {
            console.log('Federal fallback unavailable for PTNSP_2000. Will retry on next scheduled run.');
          }
        }
      } else {
        console.log('All SP draw times found from BichoCerto, no fallback needed.');
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
