import OpenAI from 'openai';

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

  const apiKey = process.env.OAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing OAI_API_KEY/OPENAI_API_KEY' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const messages = (body.messages || []) as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages,
    });

    const content = completion.choices?.[0]?.message?.content || '{}';
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


