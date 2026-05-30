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

    const T2A_SEQ = 'GAAGGAAGAGGAAGCCTTCTCACATGCGGAGATGTGGAAGAGAATCCTGGACCA'
    const INTRON_SEQ = 'GTAAGTCTTATTTAGTGGAAAGAATAGATCTTCTGTTCTTTCAAAAGCAGAAATGGCAATAACATTTTGTGCCATGAttttttttttCTGCAG'

    // Protein-coding elements (Gene / Domain / synthetic knock-in) are placed to
    // the 5' side and spliced scarlessly via introns.
    const isCodingType = (t: Module['type']) =>
      t === 'overexpression' || t === 'domain' || t === 'knockin'
    // A "separate protein product" terminates the upstream ORF and therefore
    // requires a 2A. Domains fuse into the neighbouring ORF (no 2A). A knock-in
    // may opt out of being a separate product via metadata.has2ASequence === false.
    const isSeparateProtein = (m: Module) =>
      m.type === 'overexpression' || (m.type === 'knockin' && m.metadata?.has2ASequence !== false)

    // Find index of first KO/KD to insert STOP-Triplex-Adaptor before it (rule 3)
    const firstKOIdx = ordered.findIndex(m => m.type === 'knockout' || m.type === 'knockdown')

    ordered.forEach((mod, idx) => {
      // Intron before every coding element (Gene / Domain / synthetic knock-in)
      if (isCodingType(mod.type)) {
        result.push(createLinker('Intron', idx, INTRON_SEQ))
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

      // 2A multicistronic element: inserted ONLY where a separate protein product
      // begins. Domains fuse scarlessly (via introns) into the preceding ORF, so
      // they receive no 2A. A 2A is added after a coding element when the next
      // coding element is its own protein, and as a terminal cap after a final
      // gene/knock-in (matching the 2A placed before the Internal Stuffer).
      if (isCodingType(mod.type)) {
        let nextCoding: Module | undefined
        for (let j = idx + 1; j < ordered.length; j++) {
          if (isCodingType(ordered[j].type)) { nextCoding = ordered[j]; break }
        }
        const insert2A = nextCoding ? isSeparateProtein(nextCoding) : isSeparateProtein(mod)
        if (insert2A) {
          result.push(createLinker('T2A', idx, T2A_SEQ))
        }
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
