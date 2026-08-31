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

const HEADER_TO_ENUM: Record<string, string> = {
  'LCAP-09:00': 'LCAP_09', 'LCAP-10:00': 'LCAP_10', 'LCAP-11:00': 'LCAP_11',
  'LCAP-13:00': 'LCAP_13', 'LCAP-14:00': 'LCAP_14', 'PTSP-13:00': 'PTSP_13',
  'CAP-14:00': 'CAP_14',
  'LCAP-15:00': 'LCAP_15', 'BAND-15:00': 'BAND_15', 'LCAP-16:00': 'LCAP_16',
  'CAP-18:00': 'CAP_18', 'LCAP-18:00': 'LCAP_18',
  'LCAP-20:00': 'LCAP_20', 'PTNSP-20:00': 'PTNSP_20',
  'LCAP-22:30': 'LCAP_2230',
};

interface CapitalResult {
  draw_time: string;
  prizes: Array<{ milhar: string; group: number; bicho: string }>;
}

function parseBrazilianDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseVejaResultadoCapital(markdown: string, targetDate: string): CapitalResult[] {
  const results: CapitalResult[] = [];
  const headerRegex = /^## ((?:LCAP|CAP|PTSP|BAND|PTNSP)-\d{2}:\d{2})\s*$/gm;
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

  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i].index;
    const end = i + 1 < headerPositions.length ? headerPositions[i + 1].index : markdown.length;
    const section = markdown.substring(start, end);

    // Validate date in section
    const dateMatch = section.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) {
      const sectionDate = parseBrazilianDate(dateMatch[1]);
      if (sectionDate && sectionDate !== targetDate) {
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
      results.push({ draw_time: headerPositions[i].enumVal, prizes: prizes.slice(0, 5) });
    }
  }

  return results;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const startDate: string = body.start_date;
    const endDate: string = body.end_date;

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'start_date and end_date required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!firecrawlKey || !lovableApiKey) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY or LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let totalInserted = 0;
    let totalDays = 0;
    const errorDays: string[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      totalDays++;
      console.log(`Scraping Capital for ${currentDate}...`);

      try {
        // Use Firecrawl with actions to fill date and submit form
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
            waitFor: 5000,
            actions: [
              // Set the date via JavaScript and submit
              { type: 'executeJavascript', script: `document.querySelector('#formData\\\\:inDate').value = '${currentDate}';` },
              { type: 'wait', milliseconds: 500 },
              { type: 'click', selector: '#formData\\:j_idt10' },
              { type: 'wait', milliseconds: 6000 },
              { type: 'scroll', direction: 'down', amount: 3000 },
              { type: 'wait', milliseconds: 2000 },
            ],
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Firecrawl error for ${currentDate}: ${response.status} - ${errText}`);
          errorDays.push(currentDate);
          currentDate = addDays(currentDate, 1);
          continue;
        }

        const data = await response.json();
        const markdown = data.data?.markdown || data.markdown || '';

        if (!markdown) {
          console.log(`⚠️ ${currentDate}: empty markdown`);
          currentDate = addDays(currentDate, 1);
          continue;
        }

        console.log(`Got ${markdown.length} chars for ${currentDate}`);
        const results = parseVejaResultadoCapital(markdown, currentDate);
        console.log(`Parsed ${results.length} Capital results for ${currentDate}`);

        if (results.length === 0) {
          console.log(`⚠️ ${currentDate}: no Capital results found`);
          currentDate = addDays(currentDate, 1);
          continue;
        }

        // Upsert results
        for (const result of results) {
          const p = result.prizes;
          const row = {
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

          const { error } = await supabase.from('capital_results').upsert(row, { onConflict: 'draw_date,draw_time' });
          if (error) {
            console.error(`Error ${currentDate} ${result.draw_time}:`, error.message);
          } else {
            totalInserted++;
          }
        }

        console.log(`✅ ${currentDate}: ${results.length} Capital draws imported`);
      } catch (e) {
        console.error(`Error for ${currentDate}:`, e);
        errorDays.push(currentDate);
      }

      // Delay between requests
      await new Promise(r => setTimeout(r, 1000));
      currentDate = addDays(currentDate, 1);
    }

    return new Response(JSON.stringify({
      success: true,
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
