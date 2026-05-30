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
  'CAR Specificity Domain': { id: 'car-specificity-domain', label: 'Specificity Domain', order: 1 },
  'CAR Signalling Domain': { id: 'car-signalling-domain', label: 'Signalling Domain', order: 2 },
  CAR: { id: 'car', label: 'CAR', order: 3 },
}

const REPORTER_CATEGORY = { id: 'reporter', label: 'Reporter', order: -1 }

const REPORTER_TEMPLATES = [
  {
    name: 'BFP',
    description: 'Blue fluorescent protein reporter for multiplex visualization assays.',
    sequence: `
      ATGGTGAGCAAGGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAGGGCGATGCCACCTACGGCAAGCTGACCCTGAAGTTCATCTGCACCACCGGCAAGCTGCCCGTGCCCTGGCCCACCCTCGTGACCACCCTGACCTACGGCGTGCAGTGCTTCAGCCGCTACCCCGACCACATGAAGCAGCACGACTTCTTCAAGTCCGCCATGCCCGAAGGCTACGTCCAGGAGCGCACCATCTTCTTCAAGGACGACGGCAACTACAAGACCCGCGCCGAGGTGAAGTTCGAGGGCGACACCCTGGTGAACCGCATCGAGCTGAAGGGCATCGACTTCAAGGAGGACGGCAACATCCTGGGGCACAAGCTGGAGTACAACTACAACAGCCACAACGTCTATATCATGGCCGACAAGCAGAAGAACGGCATCAAGGTGAACTTCAAGATCCGCCACAACATCGAGGACGGCAGCGTGCAGCTCGCCGACCACTACCAGCAGAACACCCCCATCGGCGACGGCCCCGTGCTGCTGCCCGACAACCACTACCTGAGCACCCAGTCCGCCCTGAGCAAAGACCCCAACGAGAAGCGCGATCACATGGTCCTGCTGGAGTTCGTGACCGCCGCCGGGATCACTCTCGGCATGGACGAGCTGTACAAG
    `,
    references: ['Blue fluorescent protein sequence (template)'],
    notes: 'Template CDS without stop codon so it can precede 2A linkers.',
  },
  {
    name: 'GFP',
    description: 'Enhanced green fluorescent protein reporter for tracking knock-in expression.',
    sequence: `
      ATGGTGAGCAAGGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAGGGCGATGCCACCTACGGCAAGCTGACCCTGAAGTTCATCTGCACCACCGGCAAGCTGCCCGTGCCCTGGCCCACCCTCGTGACCACCCTGACCTACGGCGTGCAGTGCTTCAGCCGCTACCCCGACCACATGAAGCAGCACGACTTCTTCAAGTCCGCCATGCCCGAAGGCTACGTCCAGGAGCGCACCATCTTCTTCAAGGACGACGGCAACTACAAGACCCGCGCCGAGGTGAAGTTCGAGGGCGACACCCTGGTGAACCGCATCGAGCTGAAGGGCATCGACTTCAAGGAGGACGGCAACATCCTGGGGCACAAGCTGGAGTACAACTACAACAGCCACAACGTCTATATCATGGCCGACAAGCAGAAGAACGGCATCAAGGTGAACTTCAAGATCCGCCACAACATCGAGGACGGCAGCGTGCAGCTCGCCGACCACTACCAGCAGAACACCCCCATCGGCGACGGCCCCGTGCTGCTGCCCGACAACCACTACCTGAGCACCCAGTCCGCCCTGAGCAAAGACCCCAACGAGAAGCGCGATCACATGGTCCTGCTGGAGTTCGTGACCGCCGCCGGGATCACTCTCGGCATGGACGAGCTGTACAAG
    `,
    references: ['1994 - "Green fluorescent protein as a marker for gene expression"'],
    notes: 'Human codon-optimized sequence without a stop codon so it can precede 2A linkers.',
  },
  {
    name: 'mCherry',
    description: 'mCherry red fluorescent protein reporter for multiplex assays.',
    sequence: `
      ATGGCCTCCTCCGAGGACGTCATCAAGGAGTTCATGCGCTTCAAGGTGCGCATGGAGGGCTCCGTGAACGGCCACGAGTTCGAGATCGAGGGCGAGGGCGAGGGCCGCCCCTACGAGGGCACCCAGACCGCCAAGCTGAAGGTGACCAAGGGCGGCCCCCTGCCCTTCGCCTGGGACATCCTGTCCCCTCAGTTCATGTACGGCTCCAAGGCCTACGTGAAGCACCCCGCCGACATCCCCGACTACTTGAAGCTGTCCTTCCCCGAGGGCTTCAAGTGGGAGCGCGTGATGAACTTCGAGGACGGCGGCGTGGTGACCGTGACCCAGGACTCCTCCCTGCAGGACGGCGAGTTCATCTACAAGGTGAAGCTGCGCGGCACCAACTTCCCCTCCGACGGCCCCGTAATGCAGAAGAAGACCATGGGCTGGGAGGCCTCCACCGAGCGGATGTACCCCGAGGACGGCGCCCTGAAGGGCGAGATCAAGCAGAGGCTGAAGCTGAAGGACGGCGGCCACTACGACGCCGAGGTCAAGACCACCTACAAGGCCAAGAAGCCCGTGCAGCTGCCCGGCGCCTACAACGTCAACATCAAGCTGGACATCACCTCCCACAACGAGGACTACACCATCGTGGAACAGTACGAGCGCGCCGAGGGCCGCCACTCCACCGGCGGC
    `,
    references: ['mCherry coding sequence (template)'],
    notes: 'Monomeric variant without terminal stop codon to remain in-frame with downstream elements.',
  },
  {
    name: 'RFP',
    description: 'Monomeric red fluorescent protein reporter for multiplex assays.',
    sequence: `
      ATGGCCTCCTCCGAGGACGTCATCAAGGAGTTCATGCGCTTCAAGGTGCGCATGGAGGGCTCCGTGAACGGCCACGAGTTCGAGATCGAGGGCGAGGGCGAGGGCCGCCCCTACGAGGGCACCCAGACCGCCAAGCTGAAGGTGACCAAGGGCGGCCCCCTGCCCTTCGCCTGGGACATCCTGTCCCCTCAGTTCATGTACGGCTCCAAGGCCTACGTGAAGCACCCCGCCGACATCCCCGACTACTTGAAGCTGTCCTTCCCCGAGGGCTTCAAGTGGGAGCGCGTGATGAACTTCGAGGACGGCGGCGTGGTGACCGTGACCCAGGACTCCTCCCTGCAGGACGGCGAGTTCATCTACAAGGTGAAGCTGCGCGGCACCAACTTCCCCTCCGACGGCCCCGTAATGCAGAAGAAGACCATGGGCTGGGAGGCCTCCACCGAGCGGATGTACCCCGAGGACGGCGCCCTGAAGGGCGAGATCAAGCAGAGGCTGAAGCTGAAGGACGGCGGCCACTACGACGCCGAGGTCAAGACCACCTACAAGGCCAAGAAGCCCGTGCAGCTGCCCGGCGCCTACAACGTCAACATCAAGCTGGACATCACCTCCCACAACGAGGACTACACCATCGTGGAACAGTACGAGCGCGCCGAGGGCCGCCACTCCACCGGCGGC
    `,
    references: ['2002 - "Improved monomeric red, orange and yellow fluorescent proteins"'],
    notes: 'Monomeric variant without terminal stop codon to remain in-frame with downstream elements.',
  },
]

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

  const tagSet = new Set<string>([typeInfo.label, 'knock-in'])
  if (entry.Type) tagSet.add(entry.Type)
  if (sequenceDerivation) tagSet.add(sequenceDerivation)
  if (notes) {
    tagSet.add(notes)
    notes.split(/[^A-Za-z0-9]+/).forEach(token => {
      if (token.length > 1) {
        tagSet.add(token)
      }
    })
  }
  displayName.split(/[^A-Za-z0-9]+/).forEach(token => {
    if (token.length > 1) {
      tagSet.add(token)
    }
  })

  return {
    id,
    name: displayName,
    description: descriptionParts.join(' • ') || `${typeInfo.label} knock-in`,
    sequence: cleanSequence,
    category: typeInfo.id,
    tags: Array.from(tagSet),
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

const reporterEntries: SyntheticGene[] = REPORTER_TEMPLATES.map((template, index) => {
  const cleanSequence = template.sequence.replace(/\s+/g, '').toUpperCase()
  const references = (template.references ?? []).map(buildReference)
  const baseId = slugify(template.name, `reporter-${index}`)

  return {
    id: `${REPORTER_CATEGORY.id}-${index}-${baseId}`,
    name: template.name.trim(),
    description: template.description?.trim() || `${template.name.trim()} reporter`,
    sequence: cleanSequence,
    category: REPORTER_CATEGORY.id,
    tags: ['Reporter', 'knock-in'],
    knockinType: 'Reporter',
    knockinTypeLabel: REPORTER_CATEGORY.label,
    knockinTypeOrder: REPORTER_CATEGORY.order,
    sequenceLength: cleanSequence.length,
    notes: template.notes?.trim(),
    references,
  }
})

const syntheticGeneEntries = [...knockInEntries, ...reporterEntries]

export const syntheticGenes: SyntheticGene[] = syntheticGeneEntries.sort((a, b) => {
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

// Map a curated library entry to its CRISPR-All Function/module type.
// CAR signaling and specificity domains are sub-gene "Domain" Functions, while
// full-length synthetic genes, CARs, and reporters are introduced as "Gene"
// Functions via knock-in.
export const syntheticGeneModuleType = (
  gene: Pick<SyntheticGene, 'category' | 'knockinType'>
): 'domain' | 'knockin' => {
  const haystack = `${gene.category || ''} ${gene.knockinType || ''}`.toLowerCase()
  if (haystack.includes('domain')) return 'domain'
  return 'knockin'
}

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
