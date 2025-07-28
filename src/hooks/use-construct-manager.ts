import { useState, useMemo } from 'react'
import { Module } from '@/lib/types'
import { linkerOptions } from './use-linker-options'

export type ConstructItem = Module | { id: string; type: 'linker'; name: string, sequence: string }

export function useConstructManager(initialModules: Module[] = []) {
  const [constructModules, setConstructModules] = useState<Module[]>(initialModules)
  const [autoLink, setAutoLink] = useState(true)
  const [selectedLinkerId, setSelectedLinkerId] = useState('p2a')

  const constructWithLinkers = useMemo((): ConstructItem[] => {
    if (!autoLink || constructModules.length < 2) {
      return constructModules
    }

    const linker = linkerOptions.find(l => l.id === selectedLinkerId)
    if (!linker) {
      return constructModules
    }

    const result: ConstructItem[] = []
    for (let i = 0; i < constructModules.length; i++) {
      result.push(constructModules[i])
      if (i < constructModules.length - 1) {
        // Check if current and next module are of the same type
        if (constructModules[i].type === constructModules[i+1].type) {
            result.push({
                id: `${linker.id}-${i}`,
                type: 'linker',
                name: linker.name,
                sequence: linker.sequence,
            })
        }
      }
    }
    return result
  }, [constructModules, autoLink, selectedLinkerId])

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