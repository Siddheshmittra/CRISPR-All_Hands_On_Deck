// Vercel serverless function (Edge-compatible) to proxy OpenAI requests.
// Deploy by pushing this file in a Vercel project; set OPENAI_API_KEY as an environment variable in Vercel.

import OpenAI from 'openai';

export const config = {
  runtime: 'edge',
};

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop() || '';

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('Server missing OPENAI_API_KEY', { status: 500 });

  const openai = new OpenAI({ apiKey });

  const messages = (body.messages || []) as ChatMessage[];
  const model = 'gpt-4-turbo';

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ content: JSON.stringify({ instructions: [] }) }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature: path === 'parse' ? 0.1 : 0.2,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices?.[0]?.message?.content || '{}';
  return new Response(JSON.stringify({ content }), { headers: { 'Content-Type': 'application/json' } });
}


