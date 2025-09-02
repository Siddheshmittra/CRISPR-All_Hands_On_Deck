import { Module } from "@/lib/types";

export interface PredictionSource {
  title: string;
  url: string;
}

export interface TCellPrediction {
  sentence: string;
  sources: PredictionSource[];
}

async function fetchCrossrefSources(query: string, rows = 5): Promise<PredictionSource[]> {
  try {
    const params = new URLSearchParams({ query, rows: String(rows), select: 'title,URL' });
    const res = await fetch(`https://api.crossref.org/works?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = (data?.message?.items || []) as Array<{ title?: string[]; URL?: string }>;
    return items
      .filter((it) => (it.title?.[0] || '').trim() && (it.URL || '').trim())
      .slice(0, rows)
      .map((it) => ({ title: it.title![0], url: it.URL! }));
  } catch {
    return [];
  }
}

export async function predictTCellFunction(modules: Module[]): Promise<TCellPrediction> {
  // Build perturbation string
  const perturbations = modules
    .map((m) => `${m.type} ${m.name}`)
    .join(' + ');

  const question = `What is the predicted function of a T cell that has had ${perturbations}?`;

  // Build a search query to ground sources
  const searchQuery = `T cell ${modules.map((m) => m.name).join(' ')} function immunology`;
  const sources = await fetchCrossrefSources(searchQuery, 3);

  // Prepare LLM messages via proxy
  const system = `You are an immunology assistant. Answer strictly as a single concise sentence (<= 30 words), no preamble.
Output JSON only: { "sentence": string, "sources": Array<{"title": string, "url": string}> }.
Ground your answer in the provided sources when possible and do not hallucinate citations.`;

  const userContent = JSON.stringify({ question, searchQuery, sources });

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: userContent },
  ];

  const rawProxy = (import.meta.env.VITE_LLM_PROXY_URL || '').trim();
  const proxy = rawProxy ? (rawProxy.endsWith('/') ? rawProxy.slice(0, -1) : rawProxy) : '';
  
  if (!proxy) {
    // Fallback: return minimal result with sources only
    return {
      sentence: 'Insufficient configuration to run prediction.',
      sources,
    };
  }

  try {
    // Handle both absolute URLs and relative paths
    const proxyUrl = proxy.startsWith('http') ? proxy : `${window.location.origin}${proxy}`;
    console.log('Making predict request to:', `${proxyUrl}/predict`);
    
    const res = await fetch(`${proxyUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    
    if (!res.ok) {
      let errorText = '';
      try {
        errorText = await res.text();
      } catch {}
      console.error('Predict proxy error:', { status: res.status, error: errorText });
      return { sentence: 'Prediction failed.', sources };
    }
    
    const data = await res.json();
    let parsed: any = {};
    try {
      parsed = JSON.parse(data?.content || '{}');
    } catch {
      parsed = {};
    }
  } catch (error) {
    console.error('Predict error:', error);
    return { sentence: 'Prediction failed.', sources };
  }

  const sentence = (parsed?.sentence || '').toString().trim();
  const llmSources = Array.isArray(parsed?.sources) ? parsed.sources : [];
  const mergedSources: PredictionSource[] = (llmSources.length > 0 ? llmSources : sources)
    .filter((s: any) => s && s.title && s.url)
    .slice(0, 5);

  return {
    sentence: sentence || 'No clear prediction available.',
    sources: mergedSources,
  };
}


