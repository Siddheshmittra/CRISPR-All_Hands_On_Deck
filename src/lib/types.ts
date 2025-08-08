export interface AnnotatedSegment {
  name: string;
  sequence: string;
  type: 'module' | 'linker' | 'hardcoded';
  action?: 'overexpression' | 'knockout' | 'knockdown' | 'knockin' | 'synthetic' | 'hardcoded';
}

export interface ModuleMetadata {
  has2ASequence?: boolean;
  twoAType?: string;
}

export interface Module {
  id: string;
  name: string;
  type: "overexpression" | "knockout" | "knockdown" | "knockin" | "synthetic" | "hardcoded";
  description?: string;
  sequence?: string;
  gene_id?: string;
  ensemblGeneId?: string; // Store the Ensembl gene ID
  sequenceSource?: 'ensembl_grch38' | 'ensembl_grch37' | 'shRNA.json' | 'gRNA.json';
  isSynthetic?: boolean; // Flag for synthetic genes
  syntheticSequence?: string; // Custom synthetic sequence for knockins
  color?: string; // Optional color for UI
  metadata?: ModuleMetadata; // Additional metadata for the module
  isEnriching?: boolean; // Flag to show loading state during sequence enrichment
  originalSequence?: string; // Store the original sequence before any enrichment or modification
  originalType?: "overexpression" | "knockout" | "knockdown" | "knockin" | "synthetic" | "hardcoded"; // Preserve original perturbation type when remapped by syntax
}

export interface SyntheticGene {
  id: string;
  name: string;
  description: string;
  sequence: string;
  category: string; // e.g., "fluorescent", "reporter", "therapeutic", "custom"
  tags: string[];
}

export interface Linker {
  id: string
  name: string
  type: 'linker'
  sequence: string
  description?: string
}

export type ConstructItem = Module | Linker

export interface LibrarySyntax {
  id: string;
  name: string;
  modules?: Module[]; // Made optional to match usage in the code
  type: 'overexpression' | 'knockout' | 'knockdown' | 'knockin';
}

export interface EnsemblModule extends Module {
  symbol: string;
  hgncId?: string;
  ensemblGeneId?: string;
  canonicalTranscriptId?: string;
  ensemblRelease?: string;
} 

