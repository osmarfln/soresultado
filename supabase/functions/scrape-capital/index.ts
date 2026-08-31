import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SOURCE_URL = 'https://www.vejaoresultado.com/';

const BICHOS: Record<number, string> = {
  1: 'Avestruz', 2: 'Águia', 3: 'Burro', 4: 'Borboleta', 5: 'Cachorro',
  6: 'Cabra', 7: 'Carneiro', 8: 'Camelo', 9: 'Cobra', 10: 'Coelho',
  11: 'Cavalo', 12: 'Elefante', 13: 'Galo', 14: 'Gato', 15: 'Jacaré',
  16: 'Leão', 17: 'Macaco', 18: 'Porco', 19: 'Pavão', 20: 'Peru',
  21: 'Touro', 22: 'Tigre', 23: 'Urso', 24: 'Veado', 25: 'Vaca',
};

const HEADER_TO_ENUM: Record<string, string> = {
  'LCAP-09:00': 'LCAP_09', 'LCAP-10:00': 'LCAP_10', 'LCAP-11:00': 'LCAP_11',
  'LCAP-13:00': 'LCAP_13', 'LCAP-14:00': 'LCAP_14',
  'CAP-14:00': 'CAP_14',
  'LCAP-15:00': 'LCAP_15', 'LCAP-16:00': 'LCAP_16',
  'CAP-18:00': 'CAP_18', 'LCAP-18:00': 'LCAP_18',
  'CAP-19:00': 'LCAP_19', 'LCAP-19:00': 'LCAP_19',
  'LCAP-20:30': 'LCAP_20', 'LCAP-22:30': 'LCAP_2230',
};

interface Prize { milhar: string; group: number; bicho: string }
interface CapitalResult { draw_time: string; prizes: Prize[] }

function toDateStringBRT(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

function parseBrazilianDate(value: string): string | null {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&ordm;|&#186;/gi, 'º')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHtml(html: string, today: string): CapitalResult[] {
  const results: CapitalResult[] = [];
  const headers = [...html.matchAll(/<h[1-6][^>]*>\s*((?:LCAP|CAP)-\d{2}:\d{2})\s*<\/h[1-6]>/gi)];
  console.log(`Direct HTML: ${html.length} chars, ${headers.length} Capital headers`);

  for (let index = 0; index < headers.length; index++) {
    const sourceLabel = headers[index][1].toUpperCase();
    const drawTime = HEADER_TO_ENUM[sourceLabel];
    if (!drawTime) continue;

    const start = headers[index].index ?? 0;
    const end = headers[index + 1]?.index ?? html.length;
    const section = html.slice(start, end);
    const dateMatch = stripHtml(section).match(/\d{2}\/\d{2}\/\d{4}/);
    if (!dateMatch || parseBrazilianDate(dateMatch[0]) !== today) continue;

    const prizes: Prize[] = [];
    const sectionText = stripHtml(section);
    for (const row of sectionText.matchAll(/([1-5])º\s+(\d{4})\s+(\d{1,2})\s*-\s*([A-Za-zÀ-ÿ]+)/g)) {
      const group = Number(row[3]);
      prizes.push({ milhar: row[2], group, bicho: BICHOS[group] || row[4].trim() });
    }

    if (prizes.length === 5) results.push({ draw_time: drawTime, prizes });
  }

  return results;
}

function parseMarkdown(markdown: string, today: string): CapitalResult[] {
  const results: CapitalResult[] = [];
  const headers = [...markdown.matchAll(/^## ((?:LCAP|CAP)-\d{2}:\d{2})\s*$/gm)];
  for (let index = 0; index < headers.length; index++) {
    const drawTime = HEADER_TO_ENUM[headers[index][1]];
    if (!drawTime) continue;
    const start = headers[index].index ?? 0;
    const end = headers[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    const dateMatch = section.match(/\d{2}\/\d{2}\/\d{4}/);
    if (!dateMatch || parseBrazilianDate(dateMatch[0]) !== today) continue;
    const prizes: Prize[] = [];
    for (const row of section.matchAll(/\|\s*([1-5])º\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*-\s*([^|]+)\|/g)) {
      const group = Number(row[3]);
      prizes.push({ milhar: row[2], group, bicho: BICHOS[group] || row[4].trim() });
    }
    if (prizes.length === 5) results.push({ draw_time: drawTime, prizes });
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Backend configuration unavailable' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const today = toDateStringBRT(new Date());
  let httpStatus: number | null = null;
  let sourceMethod = 'direct-html';

  const recordRun = async (values: Record<string, unknown>) => {
    const { error } = await supabase.from('scrape_robot_logs').insert({
      lottery: 'capital', source_url: SOURCE_URL,
      duration_ms: Date.now() - startedAt, http_status: httpStatus, ...values,
    });
    if (error) console.error('Could not save robot log:', error.message);
  };

  try {
    let targetTime: string | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (typeof body?.draw_time === 'string' && Object.values(HEADER_TO_ENUM).includes(body.draw_time)) targetTime = body.draw_time;
      } catch { /* empty body is valid */ }
    }

    console.log(`Fetching Capital directly from ${SOURCE_URL}`);
    let results: CapitalResult[] = [];
    let directError = '';
    try {
      const response = await fetch(SOURCE_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SoResultadosBot/1.0)', 'Accept': 'text/html' },
      });
      httpStatus = response.status;
      if (!response.ok) throw new Error(`Fonte principal respondeu HTTP ${response.status}`);
      const html = await response.text();
      results = parseHtml(html, today);
      if (results.length === 0) throw new Error('Fonte principal respondeu, mas não publicou resultados válidos para hoje');
    } catch (error) {
      directError = error instanceof Error ? error.message : String(error);
      console.error('Direct Capital scrape failed:', directError);
    }

    if (results.length === 0) {
      const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
      const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
      if (firecrawlKey && lovableApiKey) {
        sourceMethod = 'firecrawl-fallback';
        const response = await fetch('https://connector-gateway.lovable.dev/firecrawl/v2/scrape', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            'X-Connection-Api-Key': firecrawlKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: SOURCE_URL, formats: ['markdown'], onlyMainContent: true, waitFor: 5000 }),
        });
        httpStatus = response.status;
        if (!response.ok) {
          const details = await response.text();
          throw new Error(`Fonte direta: ${directError}. Leitor alternativo HTTP ${response.status}: ${details.slice(0, 300)}`);
        }
        const payload = await response.json();
        const markdown = payload.markdown || payload.data?.markdown || '';
        results = parseMarkdown(markdown, today);
      }
    }

    if (results.length === 0) {
      await recordRun({ status: 'no_results', error_message: directError || 'Nenhum resultado válido publicado para hoje', details: { method: sourceMethod } });
      return new Response(JSON.stringify({ success: false, date: today, source: SOURCE_URL, status: 'no_results', error: directError || 'Nenhum resultado válido publicado para hoje' }), {
        status: 424, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filteredResults = targetTime ? results.filter(result => result.draw_time === targetTime) : results;
    const { data: existing } = await supabase.from('capital_results').select('draw_time').eq('draw_date', today);
    const existingTimes = new Set(existing?.map(row => row.draw_time) || []);
    let inserted = 0;
    let updated = 0;

    for (const result of filteredResults) {
      const p = result.prizes;
      const row = {
        draw_date: today, draw_time: result.draw_time,
        prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
        prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
        prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
        prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
        prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
        status: 'confirmed', source: `vejaoresultado.com (${sourceMethod})`,
        scraped_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('capital_results').upsert(row, { onConflict: 'draw_date,draw_time' });
      if (error) throw new Error(`Falha ao salvar ${result.draw_time}: ${error.message}`);
      existingTimes.has(result.draw_time) ? updated++ : inserted++;
    }

    await recordRun({ status: 'success', results_found: filteredResults.length, inserted_count: inserted, updated_count: updated, details: { method: sourceMethod, draw_times: filteredResults.map(item => item.draw_time) } });
    return new Response(JSON.stringify({ success: true, date: today, source: SOURCE_URL, method: sourceMethod, results_found: filteredResults.length, inserted, updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Capital robot failed:', message);
    await recordRun({ status: httpStatus === 402 ? 'blocked' : 'error', error_message: message, details: { method: sourceMethod } });
    return new Response(JSON.stringify({ success: false, source: SOURCE_URL, error: message }), {
      status: httpStatus === 402 ? 402 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});