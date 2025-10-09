import { useState, useMemo } from 'react'
import { Module } from '@/lib/types'

export type ConstructItem = Module | { id: string; type: 'linker'; name: string, sequence: string }

export function useConstructManager(initialModules: Module[] = []) {
  const [constructModules, setConstructModules] = useState<Module[]>(initialModules)
  const [autoLink, setAutoLink] = useState(true)
  // Linker selection removed; default to T2A

  const constructWithLinkers = useMemo((): ConstructItem[] => {
    // If auto-linking is disabled or there are no modules, just return the raw list
    if (!autoLink || constructModules.length === 0) {
      return constructModules
    }

    // Preserve user's explicit ordering; do NOT auto-reorder OE/KI vs OE/KI
    const ordered = [...constructModules]

    // Helper to build linker items with stable-ish ids
    const createLinker = (base: string, idx: number, sequence = ""): ConstructItem => ({
      id: `${base}-${idx}`,
      type: 'linker',
      name: base,
      sequence,
    })

    const result: ConstructItem[] = []

    // Find index of first KO/KD to insert STOP-Triplex-Adaptor before it (rule 3)
    const firstKOIdx = ordered.findIndex(m => m.type === 'knockout' || m.type === 'knockdown')

    ordered.forEach((mod, idx) => {
      // Rule KI/OE: intron before every overexpression or knockin domain
      if (mod.type === 'overexpression' || mod.type === 'knockin') {
        result.push(createLinker('Intron', idx, 'GTAAGTCTTATTTAGTGGAAAGAATAGATCTTCTGTTCTTTCAAAAGCAGAAATGGCAATAACATTTTGTGCCATGAttttttttttCTGCAG'))
      }

      // Insert STOP-Triplex-Adaptor immediately before first KO/KD (rule 3)
      if (idx === firstKOIdx && firstKOIdx !== -1) {
        result.push(createLinker('STOP-Triplex-Adaptor', idx, 'TGAgaattcgattcgtcagtagggttgtaaaggtttttcttttcctgagaaaacaaccttttgttttctcaggttttgctttttggcctttccctagctttaaaaaaaaaaaagcaaaactcaccgaggcagttccataggatggcaagatcctggtattggtctgcgaGTAA'))
      } else if (
        firstKOIdx !== -1 &&
        idx > firstKOIdx &&
        (mod.type === 'knockout' || mod.type === 'knockdown')
      ) {
        result.push(createLinker('Adaptor (GTAA)', idx, 'GTAA'))
      }

      // Actual module
      result.push(mod)

      // Rule KI/OE: T2A after overexpression; conditional after knockin based on dialog choice
      if (mod.type === 'overexpression') {
        result.push(createLinker('T2A', idx, 'GAAGGAAGAGGAAGCCTTCTCACATGCGGAGATGTGGAAGAGAATCCTGGACCA'))
      } else if (mod.type === 'knockin' && (mod.metadata?.has2ASequence === true)) {
        result.push(createLinker('T2A', idx, 'GAAGGAAGAGGAAGCCTTCTCACATGCGGAGATGTGGAAGAGAATCCTGGACCA'))
      }
    })

    // Rule 4: always add Internal Stuffer-Barcode Array after the last module
    // Split into Internal Stuffer + Barcodes + Barcode Adapter to match updated hardcoded elements
    result.push(createLinker('Internal Stuffer', ordered.length, 'GTAACGAGACCAGTATCAAGCCCGGGCAACAATGTGCGGACGGCGTTGGTCTCTAGCG'))
    result.push(createLinker('Barcodes', ordered.length + 0.1, 'NNNNNNNNNNN'))
    result.push(createLinker('Barcode Adapter', ordered.length + 0.2, 'AGCG'))

    // Rule 5: if the last module is KO/KD, add polyA after IS-BCs
    const lastModule = ordered[ordered.length - 1]
    if (lastModule && (lastModule.type === 'knockout' || lastModule.type === 'knockdown')) {
      result.push(createLinker('polyA', ordered.length + 1, 'caccgggtcttcaacttgtttattgcagcttataatggttacaaataaagcaatagcatcacaaatttcacaaataaagcatttttttcactgcattctagttgtggtttgtccaaactcatcaatgtatcttatcatgtctggaagacctgtttacc'))
    }

    return result
  }, [constructModules, autoLink])

  return {
    constructModules,
    setConstructModules,
    autoLink,
    setAutoLink,
    constructWithLinkers,
  }
} 
