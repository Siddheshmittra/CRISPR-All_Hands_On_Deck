import OpenAI from 'openai';
import { z } from 'zod';
import { validateGenes } from './geneValidator';

export type LibraryPlanType = 'overexpression' | 'knockdown' | 'knockout' | 'knockin';

export interface PlannedLibrary {
  name: string;
  type: LibraryPlanType;
  criteria?: string;
  geneSymbols: string[];
  sources?: Array<{ title: string; url: string }>;
}

function createOpenAI(): OpenAI | null {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_OAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: import.meta.env.DEV === true,
  });
}

const systemPrompt = `You are a genetics assistant that designs gene libraries for multi-cassette experiments.

Goal: Given a free‑text experimental objective, decompose it into one or more gene "libraries" grouped by action (overexpression, knockdown, knockout, knockin) and return structured JSON only.

Input examples (not exhaustive):
- "I want to knock in surface receptor genes, and knock out various transcription factor genes"
- "Knockdown genes associated with resident memory T cell phenotype, and overexpress genes associated with central memory T cell phenotype"
- "Make T cells that don't have individual/person‑specific markers on them" (interpret as avoiding individual‑specific or highly polymorphic markers)

Output JSON schema (strict):
{
  "libraries": [
    {
      "name": string,                        // short human label (e.g., "Surface receptors")
      "type": "overexpression"|"knockdown"|"knockout"|"knockin",
      "criteria": string,                    // one‑line rationale/selection rule
      "gene_symbols": string[],              // up to MAX_PER_LIBRARY HGNC symbols (uppercase)
      "sources": [{ "title": string, "url": string }] // 1‑3 reputable sources supporting the criteria
    }
  ]
}

Planning rules (apply all):
- Use only human genes (HGNC symbols), uppercase preferred; drop non‑gene tokens.
- Parse complex intent: handle multiple actions, conjunctions, negations, and constraints.
- Respect explicit exclusions/avoidances. If the prompt implies avoiding individual/person‑specific markers, exclude highly polymorphic marker families (e.g., HLA class I/II, KIR) from candidate sets and explain this briefly in \"criteria\" instead of listing exclusions.
- When a phenotype/class is mentioned (e.g., tissue‑resident memory T cells; surface receptors; transcription factors), select well‑supported genes associated with that context from the literature.
- Prefer well‑characterized, frequently cited targets and avoid rarely annotated symbols.
- Cap gene_symbols per library to MAX_PER_LIBRARY; deduplicate within each library.
- Only include canonical reporters (e.g., GFP) if the user asked for reporters explicitly; otherwise prioritize natural genes.
- If nothing actionable is found, return {"libraries": []}.

Few‑shot guidance (do not copy verbatim; use as behavior pattern):
1) Prompt: "Make T cells that don't have individual/person specific markers on them."
   Output idea: one KO library such as { name: "Remove individual markers", type: "knockout", criteria: "Knock out highly polymorphic marker families to minimize person‑specific antigens; avoid HLA/KIR", gene_symbols: [HLA‑A, HLA‑B, HLA‑C, B2M, KIR2DL1, ...], sources: [...] }.

2) Prompt: "Knockdown exhaustion‑associated TFs; overexpress memory‑associated cytokines."
   Output idea: two libraries, one KD of exhaustion TFs (e.g., NR4A1/3, TOX), one OE of memory cytokines (e.g., IL7, IL15, IL21), with brief criteria and sources.
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
    console.log('Request payload:', { messages });
    
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
    console.log('Proxy response:', data);
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
  console.log('Raw LLM response content:', content);
  let parsed: any;
  try {
    parsed = JSON.parse(content);
    console.log('Parsed LLM response:', parsed);
  } catch (e) {
    console.error('Failed to parse LLM response as JSON:', content);
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
          sources: z
            .array(z.object({
              title: z.string().min(1),
              url: z.string().url(),
            }))
            .default([]),
        })
      )
      .default([]),
  });

  const safe = schema.parse(parsed);
  console.log('Schema validation passed:', safe);

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
      sources: lib.sources?.slice(0, 5) || [],
    } as PlannedLibrary;
  });

  const finalPlans = plans.filter((p) => p.geneSymbols.length > 0);
  console.log('Final library plans:', finalPlans);
  return finalPlans;
}


