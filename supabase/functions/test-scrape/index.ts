const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { url } = await req.json();

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url || 'https://loteriasbr.com/',
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 8000,
    }),
  });

  const data = await response.json();
  const markdown = data.data?.markdown || data.markdown || '';

  return new Response(JSON.stringify({
    status: response.status,
    markdown_length: markdown.length,
    markdown_preview: markdown.substring(0, 5000),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
