import OpenAI from 'openai';
import { z } from 'zod';
import { validateGenes } from './geneValidator';

export type LibraryPlanType = 'overexpression' | 'knockdown' | 'knockout' | 'knockin';

export interface PlannedLibrary {
  name: string;
  type: LibraryPlanType;
  criteria?: string;
  geneSymbols: string[];
}

function createOpenAI(): OpenAI | null {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: import.meta.env.DEV === true,
  });
}

const systemPrompt = `You are a genetics assistant that designs gene libraries for multi-cassette experiments.

Input: A free text experimental goal, for example: "I want to knock in surface receptor genes, and knock out various transcription factor genes" or "Knockdown genes associated with resident memory T cell phenotype, and overexpress genes associated with central memory T cell phenotype".

Output: A JSON object with key "libraries" that is an array. Each element describes ONE library with:
- name: short human-readable label (e.g., "Surface receptors", "TF knockouts")
- type: one of [overexpression, knockdown, knockout, knockin]
- criteria: a one-line description of how genes were selected
- gene_symbols: up to MAX_PER_LIBRARY unique human gene symbols (HGNC approved uppercase) best matching the intent, avoid duplicates, avoid non-gene tokens.

Rules:
- Stay strictly within human genes (HGNC symbols). Uppercase preferred.
- If the user mentions classes like surface receptors, transcription factors, or phenotypes (e.g., tissue-resident memory T cells), pick well-supported genes associated with those.
- Prefer well-characterized targets used in the literature.
- Cap gene_symbols to MAX_PER_LIBRARY items per library.
- If an action implies inserting a synthetic reporter rather than a natural gene, you may include canonical reporters (e.g., GFP) only if explicitly asked. Otherwise prioritize natural gene symbols.
- If nothing is actionable, return {"libraries": []}.
`;

export async function planLibrariesFromPrompt(prompt: string, maxPerLibrary = 30): Promise<PlannedLibrary[]> {
  const messages = [
    {
      role: 'system' as const,
      content: systemPrompt.replaceAll('MAX_PER_LIBRARY', String(maxPerLibrary)),
    },
    {
      role: 'user' as const,
      content: prompt,
    },
  ];

  const rawProxy = (import.meta.env.VITE_LLM_PROXY_URL || '').trim();
  const proxy = rawProxy ? (rawProxy.endsWith('/') ? rawProxy.slice(0, -1) : rawProxy) : '';
  let contentStr: string | undefined;

  if (proxy) {
    // Handle both absolute URLs and relative paths
    const proxyUrl = proxy.startsWith('http') ? proxy : `${window.location.origin}${proxy}`;
    console.log('Making plan request to:', `${proxyUrl}/plan`);
    
    const res = await fetch(`${proxyUrl}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    
    if (!res.ok) {
      let errorText = '';
      let errorData: any = {};
      try {
        const text = await res.text();
        errorText = text;
        try {
          errorData = JSON.parse(text);
        } catch {}
      } catch {}
      
      const errorMsg = errorData.error || errorText || res.statusText || 'Plan proxy call failed';
      console.error('Plan proxy error:', { status: res.status, error: errorMsg, data: errorData });
      throw new Error(`Proxy call failed (${res.status}): ${errorMsg}`);
    }
    
    const data = await res.json();
    contentStr = data.content || '{}';
  } else {
    const client = createOpenAI();
    if (!client) return [];
    const completion = await client.chat.completions.create({
      model: 'gpt-4-turbo',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages,
    });
    contentStr = completion.choices?.[0]?.message?.content || '{}';
  }
  const content = contentStr || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('Invalid JSON from LLM when planning libraries');
  }

  const schema = z.object({
    libraries: z
      .array(
        z.object({
          name: z.string().min(1),
          type: z.enum(['overexpression', 'knockdown', 'knockout', 'knockin']),
          criteria: z.string().optional(),
          gene_symbols: z.array(z.string()).default([]),
        })
      )
      .default([]),
  });

  const safe = schema.parse(parsed);

  // Normalize, validate symbols, enforce cap, ensure uniqueness within each library
  const plans: PlannedLibrary[] = safe.libraries.map((lib: any) => {
    const raw = (lib.gene_symbols || []).map((s: string) => (s || '').trim()).filter(Boolean);
    // Deduplicate case-insensitively, preserve last uppercase canonical
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const sym of raw) {
      const key = sym.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(key);
      }
    }

    // Validate and canonicalize
    const { valid } = validateGenes(deduped.map((s) => ({ target: s })));
    const cleaned = valid.map((v) => v.target);

    return {
      name: lib.name,
      type: lib.type,
      criteria: lib.criteria,
      geneSymbols: cleaned.slice(0, maxPerLibrary),
    } as PlannedLibrary;
  });

  return plans.filter((p) => p.geneSymbols.length > 0);
}


