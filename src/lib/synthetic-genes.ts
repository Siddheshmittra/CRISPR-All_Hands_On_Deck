import rawKnockInLibrary from './KnockIn.json'
import type { SyntheticGene, SyntheticGeneReference } from './types'

interface RawKnockInEntry {
  Type: string
  Name: string
  References?: string
  'DNA Sequence': string
  Length?: number | string
  'Sequence\nDerivation'?: string
  '': string | undefined
}

const TYPE_CONFIG: Record<string, { id: string; label: string; order: number }> = {
  'Gene- Synthetic': { id: 'synthetic-gene', label: 'Synthetic Gene', order: 0 },
  'CAR Specificity Domain': { id: 'car-specificity-domain', label: 'CAR Specificity Domain', order: 1 },
  'CAR Signalling Domain': { id: 'car-signalling-domain', label: 'CAR Signalling Domain', order: 2 },
}

const slugify = (value: string, fallback: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized || fallback
}

const normalizeOptional = (value?: string): string | undefined => {
  if (!value) return undefined
  const trimmed = value
    .split(/\r?\n/) // preserve intentional separators while trimming
    .map(segment => segment.trim())
    .filter(Boolean)
    .join(' ')
  return trimmed || undefined
}

const splitReferences = (value?: string): string[] => {
  if (!value) return []
  return value
    .split(/\r?\n/)
    .map(ref => ref.trim())
    .filter(Boolean)
}

const isPatentReference = (reference: string): boolean => {
  const lower = reference.toLowerCase()
  if (lower.includes('patent')) return true
  if (lower.includes('pct')) return true
  return /(\bwo\b|\bus\b|\bep\b)\s*\d/.test(lower)
}

const buildReference = (raw: string): SyntheticGeneReference => {
  const trimmed = raw.trim()
  const patent = isPatentReference(trimmed)
  const baseUrl = patent
    ? 'https://patents.google.com/?q='
    : 'https://pubmed.ncbi.nlm.nih.gov/?term='
  return {
    raw: trimmed,
    url: `${baseUrl}${encodeURIComponent(trimmed)}`,
    source: patent ? 'patent' : 'pubmed',
  }
}

const toSyntheticGene = (entry: RawKnockInEntry, index: number): SyntheticGene => {
  const typeInfo = TYPE_CONFIG[entry.Type] ?? {
    id: slugify(entry.Type || 'other', 'other'),
    label: entry.Type || 'Other',
    order: 99,
  }

  const cleanSequence = (entry['DNA Sequence'] || '')
    .replace(/\s+/g, '')
    .toUpperCase()

  const declaredLength = typeof entry.Length === 'number'
    ? entry.Length
    : entry.Length
      ? Number.parseInt(entry.Length, 10)
      : undefined

  const sequenceLength = declaredLength && Number.isFinite(declaredLength)
    ? declaredLength
    : cleanSequence.length || undefined

  const sequenceDerivation = normalizeOptional(entry['Sequence\nDerivation'])
  const notes = normalizeOptional(entry[''])

  const descriptionParts = [sequenceDerivation, notes]
    .filter(Boolean) as string[]

  const references = splitReferences(entry.References)
    .map(buildReference)

  const baseId = slugify(entry.Name || `knockin-${index}`, `knockin-${index}`)
  const id = `${typeInfo.id}-${index}-${baseId}`
  const displayName = entry.Name.trim()

  return {
    id,
    name: displayName,
    description: descriptionParts.join(' • ') || `${typeInfo.label} knock-in`,
    sequence: cleanSequence,
    category: typeInfo.id,
    tags: Array.from(new Set([typeInfo.label, 'knock-in'])),
    knockinType: entry.Type,
    knockinTypeLabel: typeInfo.label,
    knockinTypeOrder: typeInfo.order,
    sequenceLength,
    sequenceDerivation,
    notes,
    references,
  }
}

const knockInEntries = (rawKnockInLibrary as RawKnockInEntry[]).map(toSyntheticGene)

export const syntheticGenes: SyntheticGene[] = knockInEntries.sort((a, b) => {
  if (a.knockinTypeOrder !== b.knockinTypeOrder) {
    return (a.knockinTypeOrder ?? 99) - (b.knockinTypeOrder ?? 99)
  }
  return a.name.localeCompare(b.name)
})

export const syntheticGeneCategories = Array.from(
  syntheticGenes.reduce<Map<string, { id: string; label: string; order: number }>>((acc, gene) => {
    if (!acc.has(gene.category)) {
      acc.set(gene.category, {
        id: gene.category,
        label: gene.knockinTypeLabel || gene.category,
        order: gene.knockinTypeOrder ?? 99,
      })
    }
    return acc
  }, new Map()).values()
).sort((a, b) => {
  if (a.order !== b.order) return a.order - b.order
  return a.label.localeCompare(b.label)
})

export const getSyntheticGenesByCategory = (category: string): SyntheticGene[] => {
  if (category === 'all') return syntheticGenes
  return syntheticGenes.filter(gene => gene.category === category)
}

export const searchSyntheticGenes = (query: string): SyntheticGene[] => {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return syntheticGenes

  return syntheticGenes.filter(gene => {
    const referenceText = gene.references ? gene.references.map(ref => ref.raw).join(' ') : ''
    const fields = [
      gene.name,
      gene.description,
      gene.knockinType,
      gene.knockinTypeLabel,
      gene.sequenceDerivation,
      gene.notes,
      gene.tags.join(' '),
      referenceText,
    ]

    return fields.some(field =>
      (field || '').toLowerCase().includes(trimmed)
    )
  })
}
