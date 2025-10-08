import { EditInstruction } from './llmParser';
import { validateGenes } from './geneValidator';
import { resolveGene, enrichModuleWithSequence, suggestGeneAlternatives } from '@/lib/ensembl';
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

  // 2A peptide DNA sequences (same codon choices as manual mode)
  const TWO_A_SEQUENCES: Record<string, string> = {
    P2A: 'GCCACCAACTTCTCCCTGCTGAAGCAGGCTGGTGACGTCGAGGAGAACCCTGGGCCC',
    T2A: 'GAAGGAAGAGGAAGCCTTCTCACATGCGGAGATGTGGAAGAGAATCCTGGACCA',
    E2A: 'CAGTGCAACTACGCCCTGCTGAAGCTGGCGGACGTCGAGTCCAACCCTGGGCCT',
    F2A: 'GTTAAGCAGACCCTGAACTTCGACCTGCTGAAGCTGGCGGACGTCGAGTCCAACCCTGGGCCT',
  };
  const DEFAULT_2A_TYPE = 'T2A';

  // First, check if the target corresponds to a known synthetic gene
  const normalizedTarget = (edit.target || '').trim();
  const upper = normalizedTarget.toUpperCase();
  const syntheticHit = syntheticGenes.find(g => {
    const idMatch = g.id?.toUpperCase() === upper;
    const nameMatch = g.name?.toUpperCase() === upper;
    
    // Also check for common variations (dash vs slash, spaces, etc.)
    const normalizedName = g.name?.toUpperCase().replace(/[-/]/g, '');
    const normalizedTargetVariation = upper.replace(/[-/]/g, '');
    const variationMatch = normalizedName === normalizedTargetVariation;
    
    return idMatch || nameMatch || variationMatch;
  });

  if (syntheticHit) {
    // Always represent synthetic targets as knock-ins with embedded sequence
    const twoASeq = TWO_A_SEQUENCES[DEFAULT_2A_TYPE] || '';
    const finalSequence = syntheticHit.sequence + twoASeq; // default add 2A like manual mode
    return {
      id: `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: syntheticHit.name,
      type: 'knockin',
      description: edit.description || `${moduleType} ${syntheticHit.name}`,
      sequence: finalSequence,
      isSynthetic: true,
      syntheticSequence: syntheticHit.sequence,
      metadata: {
        has2ASequence: true,
        twoAType: DEFAULT_2A_TYPE,
      },
      color: getColorForType('knockin'),
    } as Module;
  }

  // If LLM suggested knockin, decide between synthetic knock-in vs natural OE.
  if (moduleType === 'knockin') {
    const targetUpper = (edit.target || '').trim().toUpperCase();
    const syntheticHitForKnockin = syntheticGenes.find(g => {
      const nameMatch = g.name.toUpperCase() === targetUpper;
      // Also check for common variations (dash vs slash, spaces, etc.)
      const normalizedName = g.name?.toUpperCase().replace(/[-/]/g, '');
      const normalizedTargetVariation = targetUpper.replace(/[-/]/g, '');
      const variationMatch = normalizedName === normalizedTargetVariation;
      return nameMatch || variationMatch;
    });
    if (!syntheticHitForKnockin) {
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
      const twoASeq = TWO_A_SEQUENCES[DEFAULT_2A_TYPE] || '';
      const finalSeq = syntheticHitForKnockin.sequence + twoASeq;
      return {
        id: `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: syntheticHitForKnockin.name,
        type: 'knockin',
        description: edit.description || `knockin ${syntheticHitForKnockin.name}`,
        sequence: finalSeq,
        isSynthetic: true,
        syntheticSequence: syntheticHitForKnockin.sequence,
        metadata: {
          has2ASequence: true,
          twoAType: DEFAULT_2A_TYPE,
        },
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
    knockin: 'bg-knockin text-knockin-foreground',
    synthetic: 'bg-knockin text-knockin-foreground',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}

export interface DispatchWarning {
  message: string;
  alternatives?: string[];
  action?: 'overexpression' | 'knockdown' | 'knockout' | 'knockin';
  originalTarget?: string;
}

export async function dispatchEdits(
  edits: EditInstruction[],
  opts?: { enforceTypeSource?: boolean }
): Promise<{
  modules: Module[];
  warnings: DispatchWarning[];
}> {
  const { valid, invalid, sensitive } = validateGenes(edits);
  const warnings: DispatchWarning[] = [];

  if (invalid.length > 0) {
    warnings.push({
      message: `Skipped invalid gene symbols: ${invalid.join(', ')}`
    });
  }

  // Create modules with sequence validation
  const modules: Module[] = [];
  for (const edit of valid) {
    let draftModule: Module | null = null;
    try {
      draftModule = await createModule(edit);
      const enriched = await enrichModuleWithSequence(draftModule, {
        enforceTypeSource: opts?.enforceTypeSource
      });
      modules.push(enriched);
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : 'Unknown error while creating module';
      const suggestionType = draftModule?.type === 'knockin' ? 'overexpression' : draftModule?.type;
      let alternatives: string[] | undefined;
      try {
        const nextAlternatives = await suggestGeneAlternatives(draftModule?.name ?? edit.target, {
          type: suggestionType,
          limit: 3,
        });
        if (nextAlternatives.length > 0) {
          alternatives = nextAlternatives;
        }
      } catch (suggestionError) {
        console.warn('[dispatchEdits] Failed to compute gene suggestions:', suggestionError);
      }

      warnings.push({
        message: `Failed to create module for ${edit.target}: ${baseMessage}`,
        alternatives,
        action: draftModule?.type ?? mapActionToModuleType(edit.action),
        originalTarget: edit.target,
      });
    }
  }
  
  return { modules, warnings };
}
