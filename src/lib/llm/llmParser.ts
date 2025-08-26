import OpenAI from 'openai';
import { z } from 'zod';

function createOpenAI(): OpenAI | null {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: import.meta.env.DEV === true
  });
}

export type EditAction = 'overexpress' | 'knockdown' | 'knockout' | 'knockin';

export interface EditInstruction {
  action?: EditAction; // Made optional with default in schema
  target: string; // gene symbol
  description?: string;
}

const systemPrompt = `You are a genetic engineering assistant that helps design genetic constructs.

Input: Free text describing genetic modifications (e.g., "overexpress BATF, knockdown IRF4").
Output: Return a JSON object with key "instructions" containing an array of edit instructions.

Each instruction object:
- action: one of [overexpress, knockdown, knockout, knockin]
- target: gene symbol (string)
- description: optional string

Rules:
- Standardize actions to: overexpress, knockdown, knockout, knockin
- If action is unclear, default to overexpress
- Ignore any text that doesn't contain genetic modifications
- Always return { "instructions": [] } if nothing is found.`;

export async function parseInstructions(text: string): Promise<EditInstruction[]> {
  try {
    console.log('Sending request to LLM with prompt:', text);

    const messages = [
      { 
        role: 'system' as const, 
        content: import.meta.env.VITE_OPENAI_PROMPT_ID 
          ? `[Prompt ID: ${import.meta.env.VITE_OPENAI_PROMPT_ID}] ${systemPrompt}`
          : systemPrompt
      },
      { role: 'user' as const, content: text }
    ];

    console.log('Prepared messages for LLM');

    const rawProxy = (import.meta.env.VITE_LLM_PROXY_URL || '').trim();
    const proxy = rawProxy ? (rawProxy.endsWith('/') ? rawProxy.slice(0, -1) : rawProxy) : '';
    let content: string | undefined;

    if (proxy) {
      const res = await fetch(`${proxy}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Proxy call failed (${res.status}): ${errorText || res.statusText}`);
      }
      const data = await res.json();
      content = data.content;
    } else {
      const client = createOpenAI();
      if (!client) return [];
      const completion = await client.chat.completions.create({
        model: 'gpt-4-turbo',
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
      content = completion.choices?.[0]?.message?.content;
    }

    console.log('OpenAI response received');
    
    if (!content) {
      throw new Error('No content in OpenAI response');
    }
    
    let result: any;
    try {
      result = JSON.parse(content);
      console.log('Parsed response:', result);
    } catch (e) {
      console.error('Failed to parse response:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Extract array from multiple possible shapes when using json_object format
    const extractArray = (obj: any): any[] => {
      if (Array.isArray(obj)) return obj;
      if (!obj || typeof obj !== 'object') return [];
      const preferredKeys = ['instructions', 'edits', 'actions', 'items', 'result', 'results', 'data', 'list'];
      for (const key of preferredKeys) {
        if (Array.isArray(obj[key])) return obj[key];
      }
      // Fallback: first array value in the object
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) return value as any[];
      }
      // Fallback: treat single object as one instruction
      if (obj && (obj.target || obj.gene || obj.symbol || obj.name)) return [obj];
      return [];
    };

    const rawItems = extractArray(result);

    // Normalize possible variations from the LLM
    const normalizeAction = (value?: string): EditAction => {
      const v = (value || '').toLowerCase().replace(/\s+/g, '');
      if (['ko','knockout','knockoutgene','gene_knockout','delete'].includes(v)) return 'knockout';
      if (['kd','knockdown','silence','repress','reduce','downregulate','downregulation','decrease','suppress'].includes(v)) return 'knockdown';
      if (['ki','knockin','insert','integration'].includes(v)) return 'knockin';
      if (['oe','overexpress','upregulate','upregulation','increase','express'].includes(v)) return 'overexpress';
      return 'overexpress';
    };

    const normalizeTarget = (obj: any): string | undefined => {
      const candidate = obj?.target ?? obj?.gene ?? obj?.symbol ?? obj?.name;
      if (typeof candidate !== 'string') return undefined;
      return candidate.trim();
    };

    const normalized = rawItems
      .map((it: any) => {
        const target = normalizeTarget(it);
        const action = normalizeAction(it?.action ?? it?.operation ?? it?.type ?? it?.edit);
        const description = typeof it?.description === 'string' ? it.description : undefined;
        return target ? { action, target, description } : null;
      })
      .filter(Boolean) as Array<{ action: EditAction; target: string; description?: string }>;

    // Validate using strict schema after normalization
    const validated = z.array(z.object({
      action: z.enum(['overexpress', 'knockdown', 'knockout', 'knockin']).default('overexpress'),
      target: z.string().min(1, 'Target gene is required'),
      description: z.string().optional()
    })).parse(normalized);

    const parsed: EditInstruction[] = validated.map(item => ({
      action: item.action || 'overexpress',
      target: item.target,
      ...(item.description && { description: item.description })
    }));
    
    console.log('Validated instructions:', parsed);
    return parsed;
  } catch (error) {
    console.error('Error parsing instructions:', error);
    throw new Error('Failed to parse genetic instructions');
  }
}
