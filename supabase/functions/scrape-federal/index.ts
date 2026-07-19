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

const MONTHS: Record<string, string> = {
  'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03', 'abril': '04',
  'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
  'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12',
};

function toDateStringBRT(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

function groupFromMilhar(milhar: string): number {
  const dezena = parseInt(milhar.slice(-2), 10);
  if (isNaN(dezena) || dezena === 0) return 25;
  return Math.ceil(dezena / 4);
}

interface Prize { milhar: string; group: number; bicho: string; }
interface FedResult { date: string; prizes: Prize[]; source: string; }

// PRIMARY: ojogodobicho.com/deu_no_poste.htm
// Structure: <caption>Domingo, 19 de Julho de 2026</caption>
// <thead>...<th>FED</th>...</thead>
// <tbody> rows with <td>1º</td><td class="ylig" title="Macaco">...7667</a>-17</td>
function parseOjogodobicho(html: string, todayISO: string): FedResult | null {
  // Find the table containing FED column
  const tableRegex = /<table[^>]*>[\s\S]*?<caption>([^<]+)<\/caption>[\s\S]*?<thead>([\s\S]*?)<\/thead>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/gi;
  let m;
  while ((m = tableRegex.exec(html)) !== null) {
    const caption = m[1];
    const thead = m[2];
    const tbody = m[3];

    // Parse date: "Domingo, 19 de Julho de 2026"
    const dm = caption.match(/(\d{1,2})\s+de\s+([A-Za-zçãéê]+)\s+de\s+(\d{4})/i);
    if (!dm) continue;
    const day = dm[1].padStart(2, '0');
    const monthName = dm[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTHS[monthName] || MONTHS[dm[2].toLowerCase()];
    if (!month) continue;
    const dateISO = `${dm[3]}-${month}-${day}`;

    // Find index of FED column
    const ths = Array.from(thead.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map(t => t[1].replace(/<[^>]+>/g, '').trim().toUpperCase());
    const fedIdx = ths.findIndex(t => t === 'FED' || t === 'FEDERAL');
    if (fedIdx < 0) continue;

    if (dateISO !== todayISO) {
      console.log(`⏭️ ojogodobicho: date ${dateISO} != today ${todayISO}`);
      continue;
    }

    // Parse rows
    const prizes: Prize[] = [];
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    let rm;
    while ((rm = rowRegex.exec(tbody)) !== null) {
      const tds = Array.from(rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(t => t[1]);
      if (tds.length <= fedIdx) continue;
      const posText = tds[0].replace(/<[^>]+>/g, '').trim();
      const posMatch = posText.match(/(\d+)/);
      if (!posMatch) continue;
      const pos = parseInt(posMatch[1], 10);
      if (pos < 1 || pos > 5) continue;
      const cell = tds[fedIdx].replace(/<[^>]+>/g, '').trim();
      // e.g. "7667-17"
      const cm = cell.match(/(\d{3,5})\s*-\s*(\d{1,2})/);
      if (!cm) continue;
      const milhar = cm[1].slice(-4).padStart(4, '0');
      const group = parseInt(cm[2], 10) || groupFromMilhar(milhar);
      if (milhar === '0000') continue;
      prizes[pos - 1] = { milhar, group, bicho: BICHOS[group] || '' };
    }

    if (prizes.filter(Boolean).length >= 5) {
      console.log(`✅ ojogodobicho FED ${dateISO}: ${prizes[0].milhar}`);
      return { date: dateISO, prizes: prizes.slice(0, 5), source: 'ojogodobicho.com' };
    }
  }
  return null;
}

// SECONDARY: bichocerto.com/resultados/fd/loteria-federal/
// Structure has inline JS: var dados = [{"1p":"17667","2p":"39675",...}];
// and page date like "19/07/2026" nearby.
function parseBichocerto(html: string, todayISO: string): FedResult | null {
  const dateMatch = html.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!dateMatch) return null;
  const dateISO = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  if (dateISO !== todayISO) {
    console.log(`⏭️ bichocerto: date ${dateISO} != today ${todayISO}`);
    return null;
  }
  const dadosMatch = html.match(/var\s+dados\s*=\s*(\[[^\]]+\])\s*;/);
  if (!dadosMatch) return null;
  let arr: any;
  try { arr = JSON.parse(dadosMatch[1]); } catch { return null; }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const obj = arr[0] || {};
  const prizes: Prize[] = [];
  for (let i = 1; i <= 5; i++) {
    const raw = String(obj[`${i}p`] ?? '').trim();
    if (!raw) return null;
    const milhar = raw.slice(-4).padStart(4, '0');
    const group = groupFromMilhar(milhar);
    prizes.push({ milhar, group, bicho: BICHOS[group] || '' });
  }
  console.log(`✅ bichocerto FED ${dateISO}: ${prizes[0].milhar}`);
  return { date: dateISO, prizes, source: 'bichocerto.com' };
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!res.ok) { console.error(`HTTP ${res.status} for ${url}`); return null; }
    return await res.text();
  } catch (e) {
    console.error(`Fetch failed ${url}:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = toDateStringBRT(new Date());

    let result: FedResult | null = null;

    // Primary source
    const html1 = await fetchHtml('https://www.ojogodobicho.com/deu_no_poste.htm');
    if (html1) result = parseOjogodobicho(html1, today);

    // Fallback
    if (!result) {
      console.log('⚠️ Primary failed, trying bichocerto.com...');
      const html2 = await fetchHtml('https://bichocerto.com/resultados/fd/loteria-federal/');
      if (html2) result = parseBichocerto(html2, today);
    }

    if (!result) {
      return new Response(JSON.stringify({
        success: false, date: today,
        message: 'Federal ainda não disponível em nenhuma das fontes',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: existing } = await supabase
      .from('federal_results')
      .select('id, draw_number, prize_1_milhar, prize_2_milhar, prize_3_milhar, prize_4_milhar, prize_5_milhar')
      .eq('draw_date', result.date)
      .maybeSingle();

    const p = result.prizes;
    const newSig = [p[0].milhar, p[1].milhar, p[2].milhar, p[3].milhar, p[4].milhar].join('|');
    const oldSig = existing
      ? [existing.prize_1_milhar, existing.prize_2_milhar, existing.prize_3_milhar, existing.prize_4_milhar, existing.prize_5_milhar].join('|')
      : '';

    if (existing && newSig === oldSig) {
      return new Response(JSON.stringify({
        success: true, date: result.date, source: result.source,
        message: 'Federal já atualizada', unchanged: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const row = {
      draw_date: result.date,
      draw_number: existing?.draw_number ?? null,
      prize_1_milhar: p[0].milhar, prize_1_group: p[0].group, prize_1_bicho: p[0].bicho,
      prize_2_milhar: p[1].milhar, prize_2_group: p[1].group, prize_2_bicho: p[1].bicho,
      prize_3_milhar: p[2].milhar, prize_3_group: p[2].group, prize_3_bicho: p[2].bicho,
      prize_4_milhar: p[3].milhar, prize_4_group: p[3].group, prize_4_bicho: p[3].bicho,
      prize_5_milhar: p[4].milhar, prize_5_group: p[4].group, prize_5_bicho: p[4].bicho,
      status: 'confirmed',
      updated_at: new Date().toISOString(),
      source: result.source,
      scraped_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('federal_results')
      .upsert(row, { onConflict: 'draw_date' });

    if (error) {
      console.error('Upsert error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true, date: result.date, source: result.source,
      inserted: !existing, updated: !!existing,
      milhar: p[0].milhar, bicho: p[0].bicho,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('scrape-federal error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
