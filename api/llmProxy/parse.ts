// Use direct REST calls for Edge compatibility

export const config = { runtime: 'nodejs' } as const;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders() });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400, headers: corsHeaders() });
  }

  const apiKey = process.env.OAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing OAI_API_KEY/OPENAI_API_KEY' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  try {
    const messages = (body.messages || []) as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || res.statusText || 'OpenAI request failed';
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }
    const content = json?.choices?.[0]?.message?.content || '{}';
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'LLM call failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  } as Record<string, string>;
}


