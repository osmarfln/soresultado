import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BICHOS: Record<number, string> = {
  1: 'Avestruz', 2: 'Águia', 3: 'Burro', 4: 'Borboleta', 5: 'Cachorro',
  6: 'Cabra', 7: 'Carneiro', 8: 'Camelo', 9: 'Cobra', 10: 'Coelho',
  11: 'Cavalo', 12: 'Elefante', 13: 'Galo', 14: 'Gato', 15: 'Jacaré',
  16: 'Leão', 17: 'Macaco', 18: 'Porco', 19: 'Pavão', 20: 'Peru',
  21: 'Touro', 22: 'Tigre', 23: 'Urso', 24: 'Veado', 25: 'Vaca',
};

// Map time+label from resultadofacil headers to our enum
const RIO_TIME_MAP: Record<string, string> = {
  '09:20_PT': 'PPT', '09:00_PT': 'PPT', '09:20_PPT': 'PPT', '09:00_PPT': 'PPT',
  '11:00_PTM': 'PTM', '11:20_PTM': 'PTM',
  '14:00_PT': 'PT', '14:20_PT': 'PT',
  '16:00_PTV': 'PTV', '16:20_PTV': 'PTV',
  '18:00_PTN': 'PTN', '18:20_PTN': 'PTN',
  '21:00_COR': 'COR', '21:00_Coruja': 'COR', '21:00_CORUJA': 'COR',
  '21:20_COR': 'COR', '21:20_Coruja': 'COR', '21:20_CORUJA': 'COR',
};

// Capital: map headers from resultadofacil SP page
const CAPITAL_TIME_MAP: Record<string, string> = {
  '09:00_LCAP': 'LCAP_09', '09:20_LCAP': 'LCAP_09',
  '10:00_LCAP': 'LCAP_10', '10:00_PTSP': 'LCAP_10',
  '11:00_LCAP': 'LCAP_11', '11:00_PTSP': 'LCAP_11',
  '13:00_LCAP': 'LCAP_13',
  '14:00_CAP': 'CAP_14', '14:00_PTSP': 'CAP_14',
  '15:00_LCAP': 'LCAP_15',
  '16:00_LCAP': 'LCAP_16', '16:00_PTSP': 'LCAP_16',
  '18:00_CAP': 'CAP_18', '18:00_PTSP': 'CAP_18',
  '20:00_LCAP': 'LCAP_20', '19:00_PTSP': 'LCAP_20',
  '22:30_LCAP': 'LCAP_2230',
};

interface Prize {
  milhar: string;
  group: number;
  bicho: string;
}

interface DrawResult {
  draw_time: string;
  prizes: Prize[];
}

function parseResultsFromHTML(html: string, timeMap: Record<string, string>): DrawResult[] {
  const results: DrawResult[] = [];
  const seen = new Set<string>();

  // Match section headers like "Resultado do Jogo do Bicho RJ, 09:20, PT, 1º ao 5º"
  // or "SP, 08hs - PTSP, 1º ao 5º"
  const sectionRegex = /Resultado do Jogo do Bicho[^,]*,\s*(\d{2}:\d{2})[^,]*,\s*(\w+),\s*1º ao 5º/g;
  let match;

  while ((match = sectionRegex.exec(html)) !== null) {
    const time = match[1];
    const label = match[2];
    const key = `${time}_${label}`;
    const enumVal = timeMap[key];
    if (!enumVal || seen.has(enumVal)) continue;

    // Find the next table after this header
    const afterHeader = html.substring(match.index);
    const tableMatch = afterHeader.match(/<table[^>]*>([\s\S]*?)<\/table>/);
    if (!tableMatch) continue;

    const tableHtml = tableMatch[1];
    const prizes: Prize[] = [];

    // Parse table rows
    const rowRegex = /<tr[^>]*>\s*<td[^>]*>\s*(\d+)º\s*<\/td>\s*<td[^>]*>\s*(\d{4})\s*<\/td>\s*<td[^>]*>\s*(\d{1,2})\s*<\/td>\s*<td[^>]*>\s*([^<]+)<\/td>/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const pos = parseInt(rowMatch[1]);
      if (pos > 5) continue;
      const milhar = rowMatch[2];
      const group = parseInt(rowMatch[3]);
      prizes.push({ milhar, group, bicho: BICHOS[group] || rowMatch[4].trim() });
    }

    if (prizes.length >= 5) {
      seen.add(enumVal);
      results.push({ draw_time: enumVal, prizes: prizes.slice(0, 5) });
    }
  }

  return results;
}

function parseResultsFromMarkdown(md: string, timeMap: Record<string, string>): DrawResult[] {
  const results: DrawResult[] = [];
  const seen = new Set<string>();

  // Match headers like "### Resultado do Jogo do Bicho RJ, 09:20, PT, 1º ao 5º"
  const headerRegex = /###\s*Resultado do Jogo do Bicho[^,]*,\s*(\d{2}:\d{2})[^,]*,\s*(\w+),\s*1º ao 5º/g;
  let match;
  const headers: Array<{ time: string; label: string; index: number }> = [];

  while ((match = headerRegex.exec(md)) !== null) {
    headers.push({ time: match[1], label: match[2], index: match.index });
  }

  for (let i = 0; i < headers.length; i++) {
    const { time, label } = headers[i];
    const key = `${time}_${label}`;
    const enumVal = timeMap[key];
    if (!enumVal || seen.has(enumVal)) continue;

    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : md.length;
    const section = md.substring(start, end);

    const prizes: Prize[] = [];
    // Parse markdown table rows: | 1º | 4278 | 20 | Peru |
    const rowRegex = /\|\s*(\d)º\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*([^|]+)\|/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(section)) !== null) {
      const pos = parseInt(rowMatch[1]);
      if (pos > 5) continue;
      const milhar = rowMatch[2];
      const group = parseInt(rowMatch[3]);
      prizes.push({ milhar, group, bicho: BICHOS[group] || rowMatch[4].trim() });
    }

    if (prizes.length >= 5) {
      seen.add(enumVal);
      results.push({ draw_time: enumVal, prizes: prizes.slice(0, 5) });
    }
  }

  return results;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function dateLte(a: string, b: string): boolean {
  return a <= b;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const startDate: string = body.start_date;
    const endDate: string = body.end_date;
    const type: string = body.type || 'rio'; // 'rio' or 'capital'

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'start_date and end_date required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const table = type === 'capital' ? 'capital_results' : 'draw_results';
    const stateCode = type === 'capital' ? 'sp' : 'rj';
    const timeMap = type === 'capital' ? CAPITAL_TIME_MAP : RIO_TIME_MAP;

    let totalInserted = 0;
    let totalDays = 0;
    let errorDays: string[] = [];
    let currentDate = startDate;

    while (dateLte(currentDate, endDate)) {
      totalDays++;
      const url = `https://resultadofacil.com.br/resultado-do-jogo-do-bicho/${stateCode}/do-dia/${currentDate}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          },
        });

        if (!response.ok) {
          console.log(`❌ ${currentDate}: HTTP ${response.status}`);
          errorDays.push(currentDate);
          currentDate = addDays(currentDate, 1);
          continue;
        }

        const html = await response.text();
        
        // Try parsing as HTML first, then as markdown-like content
        let results = parseResultsFromMarkdown(html, timeMap);
        
        if (results.length === 0) {
          // Try HTML parsing
          results = parseResultsFromHTML(html, timeMap);
        }

        if (results.length === 0) {
          console.log(`⚠️ ${currentDate}: no results found`);
          currentDate = addDays(currentDate, 1);
          continue;
        }

        // Upsert results
        for (const result of results) {
          const p = result.prizes;
          const row: Record<string, unknown> = {
            draw_date: currentDate,
            draw_time: result.draw_time,
            prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
            prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
            prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
            prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
            prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase.from(table).upsert(row, { onConflict: 'draw_date,draw_time' });
          if (error) {
            console.error(`Error ${currentDate} ${result.draw_time}:`, error.message);
          } else {
            totalInserted++;
          }
        }

        console.log(`✅ ${currentDate}: ${results.length} draws imported`);
      } catch (e) {
        console.error(`Error fetching ${currentDate}:`, e);
        errorDays.push(currentDate);
      }

      // Small delay to be polite
      await new Promise(r => setTimeout(r, 500));
      currentDate = addDays(currentDate, 1);
    }

    return new Response(JSON.stringify({
      success: true,
      type,
      start_date: startDate,
      end_date: endDate,
      days_processed: totalDays,
      results_inserted: totalInserted,
      error_days: errorDays,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
