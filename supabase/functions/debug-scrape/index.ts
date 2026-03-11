const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  const { url } = await req.json();

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url || 'https://rdjdb.com.br',
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 5000,
    }),
  });

  const data = await response.json();
  const markdown = data.data?.markdown || data.markdown || '';

  // Extract all lines containing draw time headers (### sections)
  const lines = markdown.split('\n');
  const headerLines = lines.filter((l: string, i: number) => 
    l.includes('#') || l.match(/resultado|ppt|ptm|ptv|ptn|cor|sorteio/i)
  ).slice(0, 40);

  return new Response(JSON.stringify({
    markdown_length: markdown.length,
    headers: headerLines,
    first_2000: markdown.substring(0, 2000),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
