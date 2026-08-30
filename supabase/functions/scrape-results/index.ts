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
  'RIO-16:00': 'PTV', 'RIO-18:00': 'PTN', 'RIO-19:00': 'PTN',
  'RIO-21:00': 'COR', 'RIO-21:30': 'COR', 'CORUJA': 'COR',
};

interface DrawResult {
  draw_time: string;
  prizes: Array<{ milhar: string; group: number; bicho: string }>;
  _source?: string;
}

interface FederalSourceResult {
  draw_date: string;
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

function getDayOfWeekBRT(): number {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short',
  }).format(now);
  const map: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return map[dateStr] ?? new Date().getDay();
}

function getBRTHourMinute(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour, minute };
}

// Defaults quando a tabela federal_schedule está indisponível
const DEFAULT_FEDERAL_RULES = [
  { weekday: 3, draw_hour: 20, draw_minute: 30 },
  { weekday: 0, draw_hour: 11, draw_minute: 34 },
];

/**
 * Confirma se está dentro da janela permitida para persistir Federal.
 * Janela: do horário oficial até 3h depois, no dia da semana correto.
 */
async function isFederalPersistenceAllowed(supabase: any): Promise<{ allowed: boolean; reason: string }> {
  const weekday = getDayOfWeekBRT();
  const { hour, minute } = getBRTHourMinute();
  const nowMinutes = hour * 60 + minute;

  let rules: Array<{ weekday: number; draw_hour: number; draw_minute: number }> = DEFAULT_FEDERAL_RULES;
  try {
    const { data, error } = await supabase
      .from('federal_schedule')
      .select('weekday, draw_hour, draw_minute')
      .eq('enabled', true);
    if (!error && Array.isArray(data) && data.length > 0) rules = data as any;
  } catch (_e) {
    // usa defaults
  }

  const todayRule = rules.find((r) => r.weekday === weekday);
  if (!todayRule) {
    return { allowed: false, reason: `Federal não configurada para o dia da semana ${weekday}` };
  }
  const drawMinutes = todayRule.draw_hour * 60 + todayRule.draw_minute;
  const windowStart = drawMinutes - 5;   // 5 min de tolerância antes
  const windowEnd = drawMinutes + 180;   // até 3h depois
  if (nowMinutes < windowStart || nowMinutes > windowEnd) {
    return {
      allowed: false,
      reason: `Fora da janela (${String(todayRule.draw_hour).padStart(2, '0')}:${String(todayRule.draw_minute).padStart(2, '0')} ±) — agora ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,
    };
  }
  return { allowed: true, reason: 'ok' };
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

function parseVejaResultadoRioHtml(html: string, todayISO: string): DrawResult[] {
  const results: DrawResult[] = [];
  const seen = new Set<string>();
  const tableRegex = /<table\b[^>]*>[\s\S]*?<h3>\s*(RIO-\d{2}:\d{2}|CORUJA)\s*<\/h3>\s*<h5>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/h5>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const header = tableMatch[1].trim();
    const enumVal = header === 'CORUJA' ? 'COR' : RIO_HEADER_TO_ENUM[header];
    const sectionDate = parseBrazilianDate(tableMatch[2]);
    if (!enumVal || seen.has(enumVal) || sectionDate !== todayISO) continue;

    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    const rowRegex = /<tr[^>]*>\s*<td[^>]*>\s*(\d)º\s*<\/td>\s*<td[^>]*>\s*(\d{4})\s*<\/td>\s*<td[^>]*>\s*(\d{1,2})\s*-\s*([^<]+?)\s*<\/td>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableMatch[3])) !== null) {
      if (parseInt(rowMatch[1], 10) > 5) continue;
      const group = parseInt(rowMatch[3], 10);
      prizes.push({ milhar: rowMatch[2], group, bicho: BICHOS[group] || rowMatch[4].trim() });
    }

    if (prizes.length >= 5) {
      seen.add(enumVal);
      console.log(`✅ RIO HTML ${enumVal}: ${prizes[0].milhar} (${prizes[0].bicho})`);
      results.push({ draw_time: enumVal, prizes: prizes.slice(0, 5) });
    }
  }

  return results;
}

// Fallback: bichoquente.com.br/paginas3/
// Structure: <h3>DD/MM/YYYY ...</h3> followed by tables with <th>Data DD/MM/YYYY <b>LABEL</b>...</th>
// Labels: "PPT 9h", "PTM 11h", "PT 14h", "PTV 16h", "PTN 18h", "COR 21h" (or similar)
const BICHOQUENTE_LABEL_TO_ENUM: Record<string, string> = {
  'PPT': 'PPT', 'PTM': 'PTM', 'PT': 'PT', 'PTV': 'PTV', 'PTN': 'PTN',
  'COR': 'COR', 'CORUJA': 'COR', 'COR/RJ': 'COR',
};

function parseBichoQuenteRio(html: string, todayISO: string): DrawResult[] {
  const results: DrawResult[] = [];
  const seen = new Set<string>();
  // Match: <th colspan="2">Data DD/MM/YYYY <b>LABEL Xh</b>...</th> ... <tbody>...</tbody>
  const tableRegex = /<th[^>]*>\s*Data\s+(\d{2}\/\d{2}\/\d{4})\s*<b>\s*([A-ZÇÃÕa-zçãõ]+)\s*\d{1,2}h[^<]*<\/b>[\s\S]*?<\/th>\s*<\/tr>([\s\S]*?)<\/table>/gi;
  let m;
  while ((m = tableRegex.exec(html)) !== null) {
    const date = parseBrazilianDate(m[1]);
    if (date !== todayISO) continue;
    const label = m[2].toUpperCase().trim();
    const enumVal = BICHOQUENTE_LABEL_TO_ENUM[label];
    if (!enumVal || seen.has(enumVal)) continue;

    const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
    const rowRegex = /<tr>\s*<td[^>]*>\s*(\d)º\s*<\/td>\s*<td[^>]*>\s*<span[^>]*>\s*(\d{3,4})\s*-\s*([^<]+?)\s*<\/span>\s*<\/td>\s*<\/tr>/gi;
    let r;
    while ((r = rowRegex.exec(m[3])) !== null) {
      const pos = parseInt(r[1], 10);
      if (pos < 1 || pos > 5) continue;
      const milhar = r[2].padStart(4, '0');
      const bichoName = r[3].trim();
      // Find group from BICHOS reverse lookup
      let group = 0;
      for (const [g, name] of Object.entries(BICHOS)) {
        if (name.toLowerCase() === bichoName.toLowerCase()) { group = parseInt(g); break; }
      }
      if (!group) {
        // Fallback: derive from last 2 digits (dezena → grupo)
        const dezena = parseInt(milhar.slice(-2), 10);
        group = dezena === 0 ? 25 : Math.ceil(dezena / 4);
      }
      prizes.push({ milhar, group, bicho: BICHOS[group] || bichoName });
    }

    if (prizes.length >= 5) {
      seen.add(enumVal);
      console.log(`✅ RIO BichoQuente ${enumVal}: ${prizes[0].milhar} (${prizes[0].bicho})`);
      results.push({ draw_time: enumVal, prizes: prizes.slice(0, 5) });
    }
  }
  return results;
}

function parseFederalFromVejaResultado(markdown: string, todayISO: string): FederalSourceResult | null {
  const federalSectionMatch = markdown.match(/## FEDERAL\s*[\s\S]*?(?=\n##\s|$)/);
  if (!federalSectionMatch) {
    console.log('Federal section not found in vejaoresultado.com markdown');
    return null;
  }

  const section = federalSectionMatch[0];
  const dateMatch = section.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (!dateMatch) {
    console.log('Federal section found but date is missing');
    return null;
  }

  const sectionDate = parseBrazilianDate(dateMatch[1]);
  if (!sectionDate || sectionDate !== todayISO) {
    console.log(`⏭️ Federal site date ${dateMatch[1]} != today ${todayISO}, skipping`);
    return null;
  }

  const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
  const rowRegex = /\|\s*(\d)º\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*-\s*([^|]+)\|/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(section)) !== null) {
    if (parseInt(rowMatch[1], 10) > 5) continue;
    const group = parseInt(rowMatch[3], 10);
    prizes.push({
      milhar: rowMatch[2],
      group,
      bicho: BICHOS[group] || rowMatch[4].trim(),
    });
  }

  if (prizes.length < 5) {
    console.log(`Federal section found but only ${prizes.length} prizes were parsed`);
    return null;
  }

  console.log(`✅ FEDERAL site: ${prizes[0].milhar} (${prizes[0].bicho})`);
  return { draw_date: sectionDate, prizes: prizes.slice(0, 5) };
}

function parseFederalFromVejaResultadoHtml(html: string, todayISO: string): FederalSourceResult | null {
  const federalSectionMatch = html.match(/<h3>\s*FEDERAL\s*<\/h3>\s*<h5>(\d{2}\/\d{2}\/\d{4})<\/h5>\s*<table[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!federalSectionMatch) {
    console.log('Federal section not found in vejaoresultado.com HTML fallback');
    return null;
  }

  const sectionDate = parseBrazilianDate(federalSectionMatch[1]);
  if (!sectionDate || sectionDate !== todayISO) {
    console.log(`⏭️ Federal HTML date ${federalSectionMatch[1]} != today ${todayISO}, skipping`);
    return null;
  }

  const prizes: Array<{ milhar: string; group: number; bicho: string }> = [];
  const rowRegex = /<tr>\s*<td>(\d)º<\/td>\s*<td>(\d{4})<\/td>\s*<td>(\d{1,2})\s*-\s*([^<]+)<\/td>\s*<\/tr>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(federalSectionMatch[2])) !== null) {
    const group = parseInt(rowMatch[3], 10);
    prizes.push({
      milhar: rowMatch[2],
      group,
      bicho: BICHOS[group] || rowMatch[4].trim(),
    });
  }

  if (prizes.length < 5) {
    console.log(`Federal HTML fallback found only ${prizes.length} prizes`);
    return null;
  }

  console.log(`✅ FEDERAL HTML fallback: ${prizes[0].milhar} (${prizes[0].bicho})`);
  return { draw_date: sectionDate, prizes: prizes.slice(0, 5) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const logClient = createClient(supabaseUrl, supabaseKey);
  const recordRun = async (values: Record<string, unknown>) => {
    const { error } = await logClient.from('scrape_robot_logs').insert({
      lottery: 'rio', source_url: 'https://www.vejaoresultado.com/',
      duration_ms: Date.now() - startedAt, ...values,
    });
    if (error) console.error('Could not save robot log:', error.message);
  };

  try {
    // Firecrawl é apenas fallback opcional — a coleta direta funciona sem chave.
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = logClient;
    const today = toDateStringBRT(new Date());


    let targetTime: string | null = null;
    if (req.method === 'POST') {
      try { const body = await req.json(); targetTime = body.draw_time || null; } catch {}
    }

    const { data: existing } = await supabase
      .from('draw_results').select('draw_time').eq('draw_date', today);
    const existingTimes = new Set(existing?.map(e => e.draw_time) || []);

    // Scrape vejaoresultado.com directly first; Firecrawl remains as fallback.
    console.log('Scraping vejaoresultado.com for Rio results...');
    let allResults: DrawResult[] = [];
    let federalFromSite: FederalSourceResult | null = null;

    try {
      const response = await fetch('https://www.vejaoresultado.com/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      });

      if (response.ok) {
        const html = await response.text();
        allResults = parseVejaResultadoRioHtml(html, today).map(r => ({ ...r, _source: 'vejaoresultado.com' }));
        federalFromSite = parseFederalFromVejaResultadoHtml(html, today);
        console.log(`Parsed ${allResults.length} Rio results from direct HTML`);
      } else {
        console.error(`Direct vejaoresultado.com error: ${response.status}`);
      }
    } catch (e) {
      console.error('Direct vejaoresultado.com scrape failed:', e);
    }

    if (allResults.length === 0 || !federalFromSite) {
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
          if (allResults.length === 0) allResults = parseVejaResultadoRio(markdown, today).map(r => ({ ...r, _source: 'vejaoresultado.com (firecrawl)' }));
          if (!federalFromSite) federalFromSite = parseFederalFromVejaResultado(markdown, today);
          console.log(`Parsed ${allResults.length} valid Rio results for today`);
        }
      } else {
        console.error(`Firecrawl error: ${response.status}`);
        await response.text();
      }
    } catch (e) {
      console.error('Firecrawl scrape failed:', e);
    }
    }

    // Fallback: bichoquente.com.br if primary missing any Rio draws (especially PTN/COR)
    const RIO_ENUMS = ['PPT','PTM','PT','PTV','PTN','COR'];
    const gotEnums = new Set(allResults.map(r => r.draw_time));
    const missing = RIO_ENUMS.filter(e => !gotEnums.has(e) && !existingTimes.has(e));
    if (missing.length > 0) {
      console.log(`🔁 Fallback bichoquente.com.br para: ${missing.join(', ')}`);
      try {
        const resp = await fetch('https://www.bichoquente.com.br/paginas3/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
        });
        if (resp.ok) {
          const html = await resp.text();
          const bqResults = parseBichoQuenteRio(html, today);
          console.log(`BichoQuente parsed ${bqResults.length} results`);
          for (const r of bqResults) {
            if (!gotEnums.has(r.draw_time)) {
              allResults.push({ ...r, _source: 'bichoquente.com.br' });
              gotEnums.add(r.draw_time);
            }
          }
        } else {
          console.error(`BichoQuente HTTP ${resp.status}`);
        }
      } catch (e) {
        console.error('BichoQuente fetch failed:', e);
      }
    }

    if (!federalFromSite) {
      console.log('Fetching vejaoresultado.com HTML fallback for Federal...');
      try {
        const response = await fetch('https://www.vejaoresultado.com/', {
          headers: { 'Accept': 'text/html,application/xhtml+xml' },
        });

        if (response.ok) {
          const html = await response.text();
          federalFromSite = parseFederalFromVejaResultadoHtml(html, today);
        } else {
          console.error(`Federal HTML fallback error: ${response.status}`);
        }
      } catch (error) {
        console.error('Federal HTML fallback failed:', error);
      }
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
        source: result._source || 'unknown', scraped_at: new Date().toISOString(),
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

    // Federal — validado dinamicamente contra a tabela federal_schedule
    let federalInserted = false;
    let federalUpdated = false;
    const federalGate = await isFederalPersistenceAllowed(supabase);
    if (!federalGate.allowed) {
      console.log(`⏭️ Federal fora da janela — persistência ignorada (${federalGate.reason})`);
    }

    if (federalGate.allowed) {

      const { data: existingFederal } = await supabase
        .from('federal_results')
        .select('id, draw_number, prize_1_milhar, prize_2_milhar, prize_3_milhar, prize_4_milhar, prize_5_milhar')
        .eq('draw_date', today)
        .maybeSingle();

      if (federalFromSite && federalFromSite.prizes.length === 5) {
        const p = federalFromSite.prizes;
        const federalRow = {
          draw_date: federalFromSite.draw_date,
          draw_number: existingFederal?.draw_number ?? null,
          prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
          prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
          prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
          prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
          prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
          status: 'confirmed', updated_at: new Date().toISOString(),
          source: 'vejaoresultado.com', scraped_at: new Date().toISOString(),
        };

        const hasFederalChanged = !existingFederal || [
          existingFederal.prize_1_milhar,
          existingFederal.prize_2_milhar,
          existingFederal.prize_3_milhar,
          existingFederal.prize_4_milhar,
          existingFederal.prize_5_milhar,
        ].join('|') !== [
          p[0].milhar,
          p[1].milhar,
          p[2].milhar,
          p[3].milhar,
          p[4].milhar,
        ].join('|');

        if (hasFederalChanged) {
          const { error: fedError } = await supabase
            .from('federal_results')
            .upsert(federalRow, { onConflict: 'draw_date' });

          if (!fedError) {
            if (existingFederal) {
              federalUpdated = true;
              console.log('🔄 Federal updated from vejaoresultado.com');
            } else {
              federalInserted = true;
              console.log('✅ Federal inserted from vejaoresultado.com');
            }
          } else {
            console.error('Federal upsert error:', fedError);
          }
        } else {
          console.log('Federal already up to date from vejaoresultado.com');
        }
      } else {
        console.log('Federal result for today is not available on vejaoresultado.com yet');
      }
    }

    return new Response(JSON.stringify({
      success: true, date: today,
      source: 'vejaoresultado.com',
      rio_results: allResults.length,
      inserted, updated, existing: existingTimes.size,
      federal_inserted: federalInserted,
      federal_updated: federalUpdated,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
