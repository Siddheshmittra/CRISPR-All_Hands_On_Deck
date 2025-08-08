import { EditInstruction } from './llmParser';
import { validateGenes } from './geneValidator';
import { resolveGene } from '@/lib/ensembl';
import type { Module } from '@/lib/types';

// Map actions to module types
export function mapActionToModuleType(action: string): 'overexpression' | 'knockdown' | 'knockout' | 'knockin' {
  switch (action) {
    case 'knockdown':
    case 'knockout':
    case 'knockin':
      return action;
    default:
      return 'overexpression';
  }
}

export async function createModule(edit: EditInstruction): Promise<Module> {
  let moduleType = mapActionToModuleType(edit.action);

  // If LLM suggested knockin for a natural gene (present in Ensembl), override to OE
  if (moduleType === 'knockin') {
    try {
      await resolveGene(edit.target, 'homo_sapiens');
      moduleType = 'overexpression';
    } catch {
      // Not found in Ensembl → keep as knockin (likely synthetic)
    }
  }

  return {
    id: `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: edit.target,
    type: moduleType,
    description: edit.description || `${moduleType} ${edit.target}`,
    sequence: '', // Will be filled in later
    color: getColorForType(moduleType)
  };
}

function getColorForType(type: string): string {
  const colors: Record<string, string> = {
    overexpression: 'bg-blue-100 text-blue-800',
    knockdown: 'bg-yellow-100 text-yellow-800',
    knockout: 'bg-red-100 text-red-800',
    knockin: 'bg-green-100 text-green-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}

export async function dispatchEdits(edits: EditInstruction[]): Promise<{
  modules: Module[];
  warnings: string[];
}> {
  const { valid, invalid, sensitive } = validateGenes(edits);
  const warnings: string[] = [];

  if (invalid.length > 0) {
    warnings.push(`Skipped invalid gene symbols: ${invalid.join(', ')}`);
  }

  // Sensitive warnings disabled per user preference

  const modules = await Promise.all(valid.map(createModule));
  
  return { modules, warnings };
}
