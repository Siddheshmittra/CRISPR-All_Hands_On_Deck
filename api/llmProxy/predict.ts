export const config = { runtime: 'edge' } as const;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders() });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400, headers: corsHeaders() });
  }

  const apiKey = process.env.OAI_API_KEY;
  if (!apiKey) {
    console.error('OAI_API_KEY environment variable is missing');
    return new Response(JSON.stringify({ 
      error: 'Missing OAI_API_KEY environment variable. Please configure it in Vercel project settings.' 
    }), {
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
    
    console.log('Predict request:', { messagesCount: messages.length, model, timestamp: new Date().toISOString() });
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || res.statusText || 'OpenAI request failed';
      console.error('OpenAI API error:', { 
        status: res.status, 
        error: msg, 
        model, 
        fullError: json?.error 
      });
      return new Response(JSON.stringify({ 
        error: `OpenAI API error (${res.status}): ${msg}`,
        details: json?.error || {}
      }), {
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
    console.error('Predict handler error:', { error: err, message, stack: err?.stack });
    return new Response(JSON.stringify({ 
      error: `Predict handler error: ${message}`,
      type: 'handler_error'
    }), {
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


