// Minimal, bulletproof Edge function
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers 
    });
  }

  try {
    const body = await req.json();
    const messages = body?.messages || [];
    
    const apiKey = process.env.OAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'Missing OAI_API_KEY environment variable' 
      }), { 
        status: 500, 
        headers 
      });
    }

    const model = process.env.OPENAI_MODEL || process.env.OAI_MODEL || 'gpt-4o-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = data?.error?.message || response.statusText || 'OpenAI API error';
      return new Response(JSON.stringify({ 
        error: `OpenAI error (${response.status}): ${errorMsg}` 
      }), { 
        status: 500, 
        headers 
      });
    }

    const content = data?.choices?.[0]?.message?.content || '{}';
    
    return new Response(JSON.stringify({ content }), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Parse handler failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }), { 
      status: 500, 
      headers 
    });
  }
}