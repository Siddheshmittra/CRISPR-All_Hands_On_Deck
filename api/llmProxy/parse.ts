// Edge runtime only to avoid Node-specific response handling
export const config = { runtime: 'edge' } as const;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders() });

  let body: any = undefined;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400, headers: corsHeaders() });
  }

  const apiKey = process.env.OAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing OAI_API_KEY' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  try {
    const messages = (body.messages || []) as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    const model =
      process.env.OPENAI_MODEL ||
      process.env.OAI_MODEL ||
      'gpt-4o-mini';
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages
      })
    });
    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = json?.error?.message || upstream.statusText || 'OpenAI request failed';
      const payload = JSON.stringify({ error: msg });
      return new Response(payload, { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
    }
    const content = json?.choices?.[0]?.message?.content || '{}';
    const payload = JSON.stringify({ content });
    return new Response(payload, { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'LLM call failed';
    const payload = JSON.stringify({ error: message });
    return new Response(payload, { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  } as Record<string, string>;
}


