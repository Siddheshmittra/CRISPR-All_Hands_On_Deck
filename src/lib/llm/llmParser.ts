import OpenAI from 'openai';
import { z } from 'zod';

console.log('OpenAI API Key:', import.meta.env.VITE_OPENAI_API_KEY ? 'Key found' : 'Key missing');

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for client-side usage
});

export type EditAction = 'overexpress' | 'knockdown' | 'knockout' | 'knockin';

export interface EditInstruction {
  action?: EditAction; // Made optional with default in schema
  target: string; // gene symbol
  description?: string;
}

const systemPrompt = `You are a genetic engineering assistant that helps design genetic constructs.

Input: Free text describing genetic modifications (e.g., "overexpress BATF, knockdown IRF4")
Output: A JSON array of edit instructions with action and target gene.

Rules:
- Only include valid gene symbols
- Standardize actions to: overexpress, knockdown, knockout, knockin
- If action is unclear, default to overexpress
- Ignore any text that doesn't contain genetic modifications
- Always return a valid JSON array, even if empty`;

export async function parseInstructions(text: string): Promise<EditInstruction[]> {
  try {
    console.log('Sending request to OpenAI with prompt:', text);
    console.log('Using prompt ID:', import.meta.env.VITE_OPENAI_PROMPT_ID);
    console.log('Environment variables:', {
      VITE_OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY ? 'Set' : 'Not set',
      VITE_OPENAI_PROMPT_ID: import.meta.env.VITE_OPENAI_PROMPT_ID || 'Not set'
    });

    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not set');
    }
    
    const messages = [
      { 
        role: 'system' as const, 
        content: import.meta.env.VITE_OPENAI_PROMPT_ID 
          ? `[Prompt ID: ${import.meta.env.VITE_OPENAI_PROMPT_ID}] ${systemPrompt}`
          : systemPrompt
      },
      { role: 'user' as const, content: text }
    ];

    console.log('Sending messages to OpenAI:', messages);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    
    console.log('OpenAI response received');
    
    if (!completion.choices?.[0]?.message?.content) {
      throw new Error('No content in OpenAI response');
    }
    
    let result;
    try {
      result = JSON.parse(completion.choices[0].message.content);
      console.log('Parsed response:', result);
    } catch (e) {
      console.error('Failed to parse response:', completion.choices[0].message.content);
      throw new Error('Invalid JSON response from OpenAI');
    }
    
    // Validate the response matches our schema
    const schema = z.array(z.object({
      action: z.enum(['overexpress', 'knockdown', 'knockout', 'knockin']).default('overexpress'),
      target: z.string().min(1, 'Target gene is required'),
      description: z.string().optional()
    }));
    
    // Ensure we have an array and each item has required fields
    const responseData = Array.isArray(result) ? result : [result];
    const validated = schema.parse(responseData);
    
    // Map to EditInstruction type with required fields
    const parsed: EditInstruction[] = validated.map(item => ({
      action: item.action || 'overexpress', // Ensure action has a default
      target: item.target, // Required by schema
      ...(item.description && { description: item.description })
    }));
    
    console.log('Validated instructions:', parsed);
    return parsed;
  } catch (error) {
    console.error('Error parsing instructions:', error);
    throw new Error('Failed to parse genetic instructions');
  }
}
