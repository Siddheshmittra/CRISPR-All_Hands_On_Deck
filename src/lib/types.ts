export interface AnnotatedSegment {
  name: string;
  sequence: string;
  type: 'module' | 'linker' | 'hardcoded';
  action?: 'overexpression' | 'knockout' | 'knockdown' | 'knockin' | 'synthetic';
}

export interface Module {
  id: string;
  name: string;
  type: "overexpression" | "knockout" | "knockdown" | "knockin" | "synthetic";
  description?: string;
  sequence?: string;
  gene_id?: string;
  sequenceSource?: 'ensembl_grch38' | 'ensembl_grch37' | 'shRNA.json' | 'gRNA.json';
  isSynthetic?: boolean; // Flag for synthetic genes
  syntheticSequence?: string; // Custom synthetic sequence for knockins
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

export interface AnnotatedSegment {
  name: string
  sequence: string
  type: 'module' | 'linker' | 'hardcoded'
}

export interface EnsemblModule extends Module {
  symbol: string;
  hgncId?: string;
  ensemblGeneId?: string;
  canonicalTranscriptId?: string;
  ensemblRelease?: string;
} 

