import { useState, useMemo } from 'react'
import { Module } from '@/lib/types'
import { linkerOptions } from './use-linker-options'

export type ConstructItem = Module | { id: string; type: 'linker'; name: string, sequence: string }

export function useConstructManager(initialModules: Module[] = []) {
  const [constructModules, setConstructModules] = useState<Module[]>(initialModules)
  const [autoLink, setAutoLink] = useState(true)
  const [selectedLinkerId, setSelectedLinkerId] = useState('p2a')

  const constructWithLinkers = useMemo((): ConstructItem[] => {
    // If auto-linking is disabled or there are no modules, just return the raw list
    if (!autoLink || constructModules.length === 0) {
      return constructModules
    }

    // 1. Re-order so that KO/KD always come after OE/KI
    const early = constructModules.filter(m => m.type === 'overexpression' || m.type === 'knockin')
    const late  = constructModules.filter(m => m.type === 'knockout' || m.type === 'knockdown')
    const ordered = [...early, ...late]

    // Helper to build linker items with stable-ish ids
    const createLinker = (base: string, idx: number, sequence = ""): ConstructItem => ({
      id: `${base}-${idx}`,
      type: 'linker',
      name: base,
      sequence,
    })

    // Pre-fetch T2A sequence (if available)
    const t2aSeq = linkerOptions.find(l => l.id === 't2a')?.sequence ?? ""

    const result: ConstructItem[] = []

    // Find index of first KO/KD to insert STOP-Triplex-Adaptor before it (rule 3)
    const firstKOIdx = ordered.findIndex(m => m.type === 'knockout' || m.type === 'knockdown')

    ordered.forEach((mod, idx) => {
      // Rule 1: intron before every overexpression gene
      if (mod.type === 'overexpression') {
        result.push(createLinker('Intron', idx))
      }

      // Insert STOP-Triplex-Adaptor immediately before first KO/KD (rule 3)
      if (idx === firstKOIdx && firstKOIdx !== -1) {
        result.push(createLinker('STOP-Triplex-Adaptor', idx))
      }

      // Actual module
      result.push(mod)

      // Rule 1: T2A after overexpression gene
      if (mod.type === 'overexpression') {
        result.push(createLinker('T2A', idx, t2aSeq))
      }
    })

    // Rule 4: always add Internal Stuffer-Barcode Array after the last module
    result.push(createLinker('Internal Stuffer-Barcode Array', ordered.length))

    // Rule 5: if the last module is KO/KD, add polyA after IS-BCs
    const lastModule = ordered[ordered.length - 1]
    if (lastModule && (lastModule.type === 'knockout' || lastModule.type === 'knockdown')) {
      result.push(createLinker('polyA', ordered.length + 1))
    }

    return result
  }, [constructModules, autoLink])

  return {
    constructModules,
    setConstructModules,
    autoLink,
    setAutoLink,
    selectedLinkerId,
    setSelectedLinkerId,
    constructWithLinkers,
  }
} 