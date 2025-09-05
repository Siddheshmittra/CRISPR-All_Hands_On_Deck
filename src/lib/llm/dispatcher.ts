import { EditInstruction } from './llmParser';
import { validateGenes } from './geneValidator';
import { resolveGene, enrichModuleWithSequence } from '@/lib/ensembl';
import { syntheticGenes } from '@/lib/synthetic-genes';
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

  // If LLM suggested knockin, decide between synthetic knock-in vs natural OE.
  if (moduleType === 'knockin') {
    const targetUpper = (edit.target || '').trim().toUpperCase();
    const syntheticHit = syntheticGenes.find(g => g.name.toUpperCase() === targetUpper);
    if (!syntheticHit) {
      // Natural gene → treat as overexpression (KI used colloquially)
      try {
        await resolveGene(edit.target, 'homo_sapiens');
        moduleType = 'overexpression';
      } catch {
        // If not resolvable in Ensembl, leave as knockin so downstream can handle custom synthetic
        moduleType = 'knockin';
      }
    } else {
      // Build a synthetic knock-in module with an embedded sequence
      return {
        id: `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: syntheticHit.name,
        type: 'knockin',
        description: edit.description || `knockin ${syntheticHit.name}`,
        sequence: syntheticHit.sequence,
        isSynthetic: true,
        color: getColorForType('knockin'),
      } as Module;
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

export async function dispatchEdits(
  edits: EditInstruction[],
  opts?: { enforceTypeSource?: boolean }
): Promise<{
  modules: Module[];
  warnings: string[];
}> {
  const { valid, invalid, sensitive } = validateGenes(edits);
  const warnings: string[] = [];

  if (invalid.length > 0) {
    warnings.push(`Skipped invalid gene symbols: ${invalid.join(', ')}`);
  }

  // Create modules with sequence validation
  const modules: Module[] = [];
  for (const edit of valid) {
    try {
      const module = await createModule(edit);
      const enriched = await enrichModuleWithSequence(module, { 
        enforceTypeSource: opts?.enforceTypeSource 
      });
      modules.push(enriched);
    } catch (error) {
      if (error instanceof Error) {
        warnings.push(`Failed to create module for ${edit.target}: ${error.message}`);
      }
    }
  }
  
  return { modules, warnings };
}
