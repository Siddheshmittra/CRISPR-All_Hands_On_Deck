// CACTUS (CRISPR-All Cell Therapy Universal Screening) meta-library presets.
//
// Two kinds of sub-libraries are bundled:
//
// 1. Protein-coding sub-libraries — full-length CARs, CAR binder (specificity)
//    domains, CAR signaling domains and synthetic genes. These carry curated,
//    reference-backed DNA sequences and are sourced from the knock-in library
//    shipped with the app (KnockIn.json, surfaced via `syntheticGenes`).
//
// 2. Natural-gene / microRNA sub-libraries — the curated knockout, knockdown,
//    overexpression and microRNA target lists (see `cactus-list.ts`). These are
//    materialized as modules whose sequences are resolved at load time from the
//    bundled gRNA / shRNA / CDS data (with an Ensembl fallback for OE). Nothing
//    is fabricated: knockout / knockdown targets without a curated gRNA / shRNA
//    sequence are dropped, and microRNA targets (for which the app bundles no
//    sequence source) are surfaced as clearly-labeled placeholders.

import type { Module, SyntheticGene } from './types'
import { syntheticGenes, syntheticGeneModuleType } from './synthetic-genes'
import { batchEnrichModulesBestEffort } from './ensembl'
import {
  CACTUS_KNOCKDOWN_KNOCKOUT_TARGETS,
  CACTUS_OVEREXPRESSION_TARGETS,
  CACTUS_MICRORNA_DELETION_TARGETS,
  CACTUS_MICRORNA_OVEREXPRESSION_TARGETS,
} from './cactus-list'

export interface CactusSubLibrary {
  id: string
  name: string
  categoryId: string // matches a `syntheticGenes` category id
  description: string
}

export const CACTUS_PROTEIN_SUBLIBRARIES: CactusSubLibrary[] = [
  { id: 'cactus-cars', name: 'CACTUS · Full-length CARs', categoryId: 'car', description: 'Full-length chimeric antigen receptors' },
  { id: 'cactus-binders', name: 'CACTUS · CAR Binder Domains', categoryId: 'car-specificity-domain', description: 'CAR specificity / binder domains' },
  { id: 'cactus-signaling', name: 'CACTUS · CAR Signaling Domains', categoryId: 'car-signalling-domain', description: 'CAR signaling domains' },
  { id: 'cactus-synthetic', name: 'CACTUS · Synthetic Genes', categoryId: 'synthetic-gene', description: 'Synthetic gene introductions (e.g. chimeric switch receptors)' },
]

const toModule = (gene: SyntheticGene): Module => ({
  id: `cactus-${gene.id}`,
  name: gene.name,
  type: syntheticGeneModuleType(gene),
  description: gene.description,
  sequence: gene.sequence,
  isSynthetic: true,
  syntheticSequence: gene.sequence,
})

export interface CactusFolder {
  id: string
  name: string
  modules: string[]
  open: boolean
}

export interface CactusBuildResult {
  modules: Module[]
  folders: CactusFolder[]
}

// Normalize a curated target label to a gene-symbol-like token for sequence
// resolution. Strips a single trailing alias parenthetical, preferring the
// inner token only when the outer label is not itself symbol-like (e.g.
// "βII spectrin (SPTBN1)" -> "SPTBN1", but "CXCR1 (IL8R)" -> "CXCR1").
const symbolLike = (t: string) => /^[A-Za-z0-9-]+$/.test(t)

export function normalizeCactusSymbol(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ')
  const m = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (m) {
    const outer = m[1].trim()
    const inner = m[2].trim()
    if (!symbolLike(outer) && symbolLike(inner)) return inner
    return outer
  }
  return s
}

// Build the protein-coding CACTUS preset libraries from the curated knock-in data.
export function buildCactusLibraries(): CactusBuildResult {
  const modules: Module[] = []
  const folders: CactusFolder[] = []
  const stamp = Date.now()

  CACTUS_PROTEIN_SUBLIBRARIES.forEach((sub, idx) => {
    const genes = syntheticGenes.filter(g => g.category === sub.categoryId)
    if (genes.length === 0) return
    const subModules = genes.map(toModule)
    modules.push(...subModules)
    folders.push({
      id: `${sub.id}-${stamp}-${idx}`,
      name: `${sub.name} (${subModules.length})`,
      modules: subModules.map(m => m.id),
      open: false,
    })
  })

  return { modules, folders }
}

type NaturalType = 'overexpression' | 'knockout' | 'knockdown'

// De-duplicate by normalized (uppercased) symbol while preserving order.
const dedupeSymbols = (symbols: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of symbols) {
    const key = normalizeCactusSymbol(raw).toUpperCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(raw)
  }
  return out
}

// Build a natural-gene sub-library: create typed modules for each target and
// resolve sequences from the bundled data (enforcing the type-specific source).
// Knockout/knockdown targets without a curated sequence are dropped.
async function buildNaturalSubLibrary(
  idPrefix: string,
  type: NaturalType,
  targets: string[],
): Promise<Module[]> {
  const base: Module[] = dedupeSymbols(targets).map(raw => {
    const name = normalizeCactusSymbol(raw)
    return {
      id: `${idPrefix}-${name.toUpperCase()}`,
      name,
      type,
      description: `Human gene ${name}`,
      sequence: '',
    }
  })

  const enriched = await batchEnrichModulesBestEffort(base, { enforceTypeSource: true })

  if (type === 'knockout' || type === 'knockdown') {
    // Only keep targets for which we have a real curated gRNA / shRNA sequence.
    return enriched.filter(m => !!m.sequence && m.sequence.length > 0)
  }
  // Overexpression: keep all (sequence where available, placeholder otherwise).
  return enriched.map(m => ({
    ...m,
    description: m.sequence && m.sequence.length > 0
      ? m.description
      : `Human gene ${m.name} (sequence not found)`,
  }))
}

// microRNA targets have no bundled sequence source; surface as placeholders.
const buildMicroRnaModules = (
  idPrefix: string,
  type: NaturalType,
  targets: string[],
): Module[] =>
  dedupeSymbols(targets).map(raw => {
    const name = normalizeCactusSymbol(raw)
    return {
      id: `${idPrefix}-${name.toUpperCase()}`,
      name,
      type,
      description: `microRNA ${name} (sequence not bundled)`,
      sequence: '',
    }
  })

const makeFolder = (
  id: string,
  baseName: string,
  modules: Module[],
): CactusFolder => ({
  id,
  name: `${baseName} (${modules.length})`,
  modules: modules.map(m => m.id),
  open: false,
})

// Build the full CACTUS meta-library: protein-coding sub-libraries (sync) plus
// the natural-gene knockout / knockdown / overexpression and microRNA
// sub-libraries (sequences resolved at load time).
export async function buildCactusLibrariesAsync(): Promise<CactusBuildResult> {
  const protein = buildCactusLibraries()
  const modules: Module[] = [...protein.modules]
  const folders: CactusFolder[] = [...protein.folders]
  const stamp = Date.now()

  const [knockout, knockdown, overexpression] = await Promise.all([
    buildNaturalSubLibrary('cactus-ko', 'knockout', CACTUS_KNOCKDOWN_KNOCKOUT_TARGETS),
    buildNaturalSubLibrary('cactus-kd', 'knockdown', CACTUS_KNOCKDOWN_KNOCKOUT_TARGETS),
    buildNaturalSubLibrary('cactus-oe', 'overexpression', CACTUS_OVEREXPRESSION_TARGETS),
  ])

  const mirOverexpression = buildMicroRnaModules('cactus-mir-oe', 'overexpression', CACTUS_MICRORNA_OVEREXPRESSION_TARGETS)
  const mirDeletion = buildMicroRnaModules('cactus-mir-del', 'knockout', CACTUS_MICRORNA_DELETION_TARGETS)

  const sections: Array<{ id: string; name: string; mods: Module[] }> = [
    { id: `cactus-ko-${stamp}`, name: 'CACTUS · Knockouts', mods: knockout },
    { id: `cactus-kd-${stamp}`, name: 'CACTUS · Knockdowns', mods: knockdown },
    { id: `cactus-oe-${stamp}`, name: 'CACTUS · Gene Overexpression', mods: overexpression },
    { id: `cactus-mir-oe-${stamp}`, name: 'CACTUS · microRNA Overexpression', mods: mirOverexpression },
    { id: `cactus-mir-del-${stamp}`, name: 'CACTUS · microRNA Deletion', mods: mirDeletion },
  ]

  for (const section of sections) {
    if (section.mods.length === 0) continue
    modules.push(...section.mods)
    folders.push(makeFolder(section.id, section.name, section.mods))
  }

  return { modules, folders }
}
