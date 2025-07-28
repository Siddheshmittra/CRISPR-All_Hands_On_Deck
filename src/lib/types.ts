export interface Module {
  id: string;
  name: string;
  type: "overexpression" | "knockout" | "knockdown" | "knockin";
  description?: string;
  sequence?: string;
}

export interface Linker {
  id: string
  name: string
  type: 'linker'
  sequence: string
  description?: string
}

export type ConstructItem = Module | Linker

export interface EnsemblModule extends Module {
  symbol: string;
  hgncId?: string;
  ensemblGeneId?: string;
  canonicalTranscriptId?: string;
  sequenceSource?: 'ensembl_grch38' | 'ensembl_grch37';
  ensemblRelease?: string;
} 