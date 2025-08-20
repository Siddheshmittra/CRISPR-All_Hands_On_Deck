import { Module } from './types'

// FASTA format utilities
export function generateFasta(module: Module, sequence: string): string {
  const header = `>${module.name || module.gene_id || module.id} [${module.type.toUpperCase()}]`
  if (module.description) {
    return `${header} - ${module.description}\n${sequence}`
  }
  return `${header}\n${sequence}`
}

export function downloadFasta(fastaContent: string, filename: string): void {
  const blob = new Blob([fastaContent], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.fasta`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// UniProt utilities
export async function searchUniProt(geneSymbol: string): Promise<any> {
  try {
    const response = await fetch(`https://rest.uniprot.org/uniprotkb/search?query=gene:${geneSymbol}%20AND%20organism_id:9606&format=json`)
    if (!response.ok) {
      throw new Error(`UniProt search failed: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('UniProt search error:', error)
    throw error
  }
}

export function getUniProtUrl(geneSymbol: string): string {
  return `https://www.uniprot.org/uniprotkb?query=gene:${geneSymbol}%20AND%20organism_id:9606`
}

export function getUniProtEntryUrl(uniprotId: string): string {
  return `https://www.uniprot.org/uniprotkb/${uniprotId}`
}

// Check if module has sequence data
export function hasSequence(module: Module): boolean {
  return !!(module.sequence && module.sequence.trim().length > 0)
}

// Get sequence for module (with fallbacks)
export function getModuleSequence(module: Module): string {
  if (module.sequence) {
    return module.sequence
  }
  if (module.syntheticSequence) {
    return module.syntheticSequence
  }
  return ''
}
