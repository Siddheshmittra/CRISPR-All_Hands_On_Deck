import { useState } from "react"
import { DragDropContext, type DropResult, Droppable } from "@hello-pangea/dnd"
import { Header } from "@/components/design-lab/header"
import { DesignMode } from "@/components/design-lab/design-mode"
import { ModuleSelector } from "@/components/design-lab/module-selector"
import { randomUUID } from "@/lib/uuid"
import { ConstructLayout } from "@/components/design-lab/construct-layout"
import { FinalConstruct } from "@/components/design-lab/final-construct"
import { MultiCassetteSetup } from "@/components/design-lab/multi-cassette-dialog"
import { NaturalLanguageMode } from "@/components/design-lab/natural-language-mode"
import { MultiCassetteNatural } from "@/components/design-lab/multi-cassette-natural"
import { NaturalLanguageInput } from "@/components/design-lab/NaturalLanguageInput"
import { LibraryManager } from "@/components/design-lab/library-manager"
import { Card } from "@/components/ui/card"
import { CassetteBatch } from "@/components/design-lab/cassette-batch"
import { ErrorBoundary } from "@/components/error-boundary"
import { SimpleModuleSelector } from "@/components/design-lab/simple-module-selector"
import { LibraryViewer } from "@/components/design-lab/library-viewer"
import { Trash2 } from "lucide-react"
import React from "react"
import { useConstructManager } from "@/hooks/use-construct-manager"
import { enrichModuleWithSequence } from "@/lib/ensembl"
import { toast } from "sonner"
import { generateBarcode } from "@/lib/barcode-utils"
import { predictTCellFunction } from "@/lib/llm/predictFunction"

import { Module, LibrarySyntax } from "@/lib/types"

interface Cassette {
  id: string
  modules: Module[]
  barcode?: string
}

const DesignLab = () => {
  const [cassetteMode, setCassetteMode] = useState<'single' | 'multi'>('single')
  const [inputMode, setInputMode] = useState<'manual' | 'natural'>('manual')
  const [selectedModules, setSelectedModules] = useState<Module[]>([])
  const {
    constructModules,
    setConstructModules,
    autoLink,
    setAutoLink,
    selectedLinkerId,
    setSelectedLinkerId,
    constructWithLinkers,
  } = useConstructManager([])
  // Removed explicit cassette count; all combinations will be generated
  const [overexpressionCount, setOverexpressionCount] = useState(0)
  const [knockoutCount, setKnockoutCount] = useState(0)
  const [knockdownCount, setKnockdownCount] = useState(0)
  const [customModules, setCustomModules] = useState<Module[]>([])
  const [folders, setFolders] = useState<any[]>([{
    id: 'total-library',
    name: 'Total Library',
    modules: [],
    open: true
  }])
  const [cassetteBatch, setCassetteBatch] = useState<Cassette[]>([])
  const [librarySyntax, setLibrarySyntax] = useState<LibrarySyntax[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('total-library')
  const [predictedSentence, setPredictedSentence] = useState<string>("")
  const [predictedSources, setPredictedSources] = useState<Array<{ title: string; url: string }>>([])
  const [isPredicting, setIsPredicting] = useState(false)

  // Barcode system state
  const [barcodeMode, setBarcodeMode] = useState<'internal' | 'general'>('general')
  const [barcodePool, setBarcodePool] = useState<string[]>([])
  const [generalPool, setGeneralPool] = useState<Array<{ index: number; sequence: string }>>([])
  const [internalPool, setInternalPool] = useState<Array<{ index: number; sequence: string }>>([])

  // Load Roth pool once (used by Choose Barcode regardless of mode)
  React.useEffect(() => {
    let mounted = true
    import('@/lib/barcodes').then(({ loadBarcodePool, loadGeneralBarcodePool, loadInternalBarcodePool }) => {
      loadBarcodePool()
        .then(pool => { if (mounted) setBarcodePool(pool) })
        .catch(() => { if (mounted) setBarcodePool([]) })
      loadGeneralBarcodePool()
        .then(pool => { if (mounted) setGeneralPool(pool) })
        .catch(() => { if (mounted) setGeneralPool([]) })
      loadInternalBarcodePool()
        .then(pool => { if (mounted) setInternalPool(pool) })
        .catch(() => { if (mounted) setInternalPool([]) })
    })
    return () => { mounted = false }
  }, [])

  // Session restore: persist and hydrate key state
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('design-lab:session')
      if (!raw) return
      const data = JSON.parse(raw)
      if (data.customModules) setCustomModules(data.customModules)
      if (data.folders) setFolders(data.folders)
      if (data.librarySyntax) setLibrarySyntax(data.librarySyntax)
      if (data.cassetteBatch) setCassetteBatch(data.cassetteBatch)
      if (data.cassetteMode) setCassetteMode(data.cassetteMode)
      if (data.inputMode) setInputMode(data.inputMode)
      if (data.barcodeMode) setBarcodeMode(data.barcodeMode)
    } catch {}
  }, [])

  React.useEffect(() => {
    try {
      const payload = {
        customModules,
        folders,
        librarySyntax,
        cassetteBatch,
        cassetteMode,
        inputMode,
        barcodeMode,
      }
      localStorage.setItem('design-lab:session', JSON.stringify(payload))
    } catch {}
  }, [customModules, folders, librarySyntax, cassetteBatch, cassetteMode, inputMode, barcodeMode])

  // Lightweight restore banner with reset option
  const [showRestoreBanner, setShowRestoreBanner] = useState<boolean>(() => {
    try { return !!localStorage.getItem('design-lab:session') } catch { return false }
  })

  const handleClearSession = () => {
    try { localStorage.removeItem('design-lab:session') } catch {}
    setShowRestoreBanner(false)
  }

  const usedBarcodes = React.useMemo(() => new Set(
    cassetteBatch.map(c => c.barcode).filter((b): b is string => !!b)
  ), [cassetteBatch])

  const nextBarcode = React.useCallback(() => {
    // Always draw deterministically from the first available in the pool provided by the user
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { pickNextAvailable } = require('@/lib/barcodes') as any
      const candidate: string | undefined = pickNextAvailable(barcodePool, usedBarcodes)
      if (candidate) return candidate
    } catch {}
    // If pool not loaded or exhausted, fall back to general/internal pools deterministically
    const allPools: string[] = [
      ...generalPool.map(p => p.sequence),
      ...internalPool.map(p => p.sequence)
    ]
    for (const seq of allPools) {
      if (!usedBarcodes.has(seq)) return seq
    }
    // Hard fallback: generate unique
    return generateBarcode(12, Array.from(usedBarcodes))
  }, [barcodePool, usedBarcodes, generalPool, internalPool])

  const handleAddLibrary = (libraryId: string, perturbationType?: 'overexpression' | 'knockout' | 'knockdown' | 'knockin') => {
    const existing = librarySyntax.find(l => l.id === libraryId)
    if (existing) return
    const library = folders.find(f => f.id === libraryId)

    // Enforce Total Library constraint: only add if all contained modules share a single perturbation type
    const isTotalLibrary = library.id === 'total-library'
    const moduleObjs = (library.modules || []).map((id: string) => customModules.find(m => m.id === id)).filter(Boolean) as Module[]
    if (library && isTotalLibrary) {
      const uniqueTypes = new Set(moduleObjs.map(m => m.type))
      if (uniqueTypes.size > 1) {
        toast?.error?.('Total Library contains mixed perturbation types. Please split into separate libraries or set a uniform type before adding.')
        return
      }
    }

    // Decide library type: explicit override > contained modules' uniform type > first module fallback
    let moduleType: 'overexpression' | 'knockout' | 'knockdown' | 'knockin' = 'overexpression';
    if (perturbationType) {
      moduleType = perturbationType;
    } else if (moduleObjs.length > 0) {
      const t = moduleObjs[0].type
      if (t === 'overexpression' || t === 'knockout' || t === 'knockdown' || t === 'knockin') {
        moduleType = t
      } else {
        moduleType = 'overexpression'
      }
    }

    const newLibrary: LibrarySyntax = {
      id: libraryId,
      name: library?.name || libraryId,
      type: moduleType
    }
    setLibrarySyntax(prev => [...prev, newLibrary])
  }

  const handleRemoveLibrary = (libraryId: string) => {
    setLibrarySyntax(prev => prev.filter(l => l.id !== libraryId))
  }

  const handleLibraryTypeChange = (libraryId: string, type: 'overexpression' | 'knockout' | 'knockdown' | 'knockin') => {
    // Update the library type in librarySyntax
    setLibrarySyntax(prev => prev.map(l => l.id === libraryId ? { ...l, type } : l))
    
    // Find the library to get its modules
    const library = folders.find(f => f.id === libraryId)
    if (!library) return
    
    // Update all modules in this library to the new type
    setCustomModules(prevModules => 
      prevModules.map(module => 
        library.modules.includes(module.id) 
          ? { ...module, type } 
          : module
      )
    )
  }

  const handleReorderLibraries = (newOrder: LibrarySyntax[]) => {
    setLibrarySyntax(newOrder);
  }

  const handleModuleSelect = async (module: Module) => {
    if (constructModules.length >= 5) {
      return // Max 5 modules
    }
    
    try {
      // Create a unique ID for this instance
      const uniqueId = `${module.id}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
      const newModule = { ...module, id: uniqueId }
      
      // Only enrich if the module doesn't already have a sequence
      if (!newModule.sequence) {
        const enrichedModule = await enrichModuleWithSequence(newModule);
        setSelectedModules(prev => [...prev, enrichedModule])
        setConstructModules(prev => [...prev, enrichedModule])
      } else {
        setSelectedModules(prev => [...prev, newModule])
        setConstructModules(prev => [...prev, newModule])
      }
    } catch (error) {
      console.error('Failed to enrich module:', error);
      toast.error(`Failed to add module: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const handleModuleDeselect = (moduleId: string) => {
    setSelectedModules(prev => prev.filter(m => m.id !== moduleId))
    setConstructModules(prev => prev.filter(m => m.id !== moduleId))
  }

  const handleModuleRemove = (moduleId: string) => {
    setConstructModules(prev => prev.filter(m => m.id !== moduleId))
    setSelectedModules(prev => prev.filter(m => m.id !== moduleId))
  }

  const handleModuleClick = (module: Module) => {
    if (selectedModules.some(m => m.id === module.id)) {
      handleModuleDeselect(module.id)
    } else {
      handleModuleSelect(module)
    }
  }

  const handleAddCassette = (modules: Module[], barcode?: string) => {
    const newCassette: Cassette = {
      id: `cassette-${randomUUID()}`,
      modules: modules.map(module => ({
        ...module,
        id: `${module.id}-${randomUUID()}` // Ensure module IDs are also unique
      })),
      barcode: (barcode?.trim()) || nextBarcode()
    }
    setCassetteBatch(prev => [...prev, newCassette])
  }

  const handleDeleteCassette = (cassetteId: string) => {
    setCassetteBatch(prev => prev.filter(c => c.id !== cassetteId))
  }

  const handleUpdateCassette = (cassetteId: string, modules: Module[], barcode?: string) => {
    setCassetteBatch(prev => prev.map(cassette => 
      cassette.id === cassetteId 
        ? { 
            ...cassette, 
            modules,
            barcode: barcode?.trim() || cassette.barcode 
          }
        : cassette
    ))
  }

  const handleExportBatch = () => {
    // Create a more structured export object
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalCassettes: cassetteBatch.length,
        cassetteBarcodes: cassetteBatch
          .filter(c => c.barcode)
          .map(c => ({
            cassetteId: c.id,
            barcode: c.barcode,
            moduleCount: c.modules.length,
            moduleTypes: [...new Set(c.modules.map(m => m.type))]
          })),
      },
      cassettes: cassetteBatch.map(cassette => ({
        id: cassette.id,
        barcode: cassette.barcode || null,
        modules: cassette.modules.map(module => ({
          id: module.id,
          name: module.name,
          type: module.type,
          description: module.description || '',
          sequenceLength: module.sequence?.length || 0,
          isSynthetic: module.isSynthetic || false
        }))
      }))
    };
    
    // Create a filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `cassette-batch_${timestamp}.json`
    
    // Create and trigger download
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    // Show success message
    toast.success(`Exported ${cassetteBatch.length} cassettes`)
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    // Reorder within construct
    if (
      result.source.droppableId === "construct" &&
      result.destination.droppableId === "construct"
    ) {
      const items = Array.from(constructModules)
      const [reorderedItem] = items.splice(result.source.index, 1)
      items.splice(result.destination.index, 0, reorderedItem)
      setConstructModules(items)
      return
    }

    // Move from folder to construct
    const folderIds = folders.map(f => f.id)
    if (
      folderIds.includes(result.source.droppableId) &&
      result.destination.droppableId === "construct"
    ) {
      const sourceFolderId = result.source.droppableId
      const moduleId = result.draggableId
      const module = customModules.find(m => m.id === moduleId)
      if (!module) return
      if (constructModules.length >= 5) return
      // Create a unique ID for this instance
      const uniqueId = `${module.id}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
      const newModule = { ...module, id: uniqueId }
      setConstructModules(prev => [...prev, newModule])
      setSelectedModules(prev => [...prev, newModule])
      return
    }

    // Move between folders
    if (
      folderIds.includes(result.source.droppableId) &&
      folderIds.includes(result.destination.droppableId)
    ) {
      const { source, destination, draggableId } = result
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return
      }

      // If source is Total Library, create a clone instead of moving
      if (source.droppableId === 'total-library') {
        const moduleToClone = customModules.find(m => m.id === draggableId)
        if (!moduleToClone) return
        
        // Create a unique ID for the clone
        const uniqueId = `${draggableId}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
        
        setFolders(prevFolders => 
          prevFolders.map(folder => {
            if (folder.id === destination.droppableId) {
              const newModules = Array.from(folder.modules)
              newModules.splice(destination.index, 0, uniqueId)
              return {
                ...folder,
                modules: newModules
              }
            }
            return folder
          })
        )
        
        // Add the cloned module to customModules
        const clonedModule = { ...moduleToClone, id: uniqueId }
        setCustomModules(prev => [...prev, clonedModule])
        return
      }

      // For moves between regular folders (not involving Total Library)
      if (destination.droppableId !== 'total-library') {
        let newFolders = folders.map(folder => {
          if (folder.id === source.droppableId) {
            return {
              ...folder,
              modules: folder.modules.filter(id => id !== draggableId)
            }
          }
          return folder
        })
        newFolders = newFolders.map(folder => {
          if (folder.id === destination.droppableId) {
            const newModules = Array.from(folder.modules)
            newModules.splice(destination.index, 0, draggableId)
            return {
              ...folder,
              modules: newModules
            }
          }
          return folder
        })
        setFolders(newFolders)
      }
      return
    }

    // Remove from construct if dropped in trash
    // Drag folder (library) from module selector to library syntax
    if (
      result.source.droppableId === 'module-selector-folders' &&
      result.destination.droppableId === 'library-syntax'
    ) {
      const folderId = result.draggableId
      const folder = folders.find(f => f.id === folderId)
      if (!folder) return
      
      // Don't add if already exists
      if (librarySyntax.find(l => l.id === folderId)) return
      
      // Get the first module in the folder to determine its type
      const folderModule = customModules.find(m => m.id === folder.modules[0]);
      const moduleType = folderModule?.type || 'overexpression';
      
      const newLibraryItem: LibrarySyntax = {
        id: folder.id,
        name: folder.name,
        type: moduleType as 'overexpression' | 'knockout' | 'knockdown' | 'knockin'
      }
      
      const newSyntax = Array.from(librarySyntax)
      newSyntax.splice(result.destination.index, 0, newLibraryItem)
      setLibrarySyntax(newSyntax)
      return
    }

    // Reorder within library syntax
    if (
      result.source.droppableId === 'library-syntax' &&
      result.destination.droppableId === 'library-syntax'
    ) {
      // Hardcoded components (T2A, STOP, PolyA) are always at indices 0, 1, 2
      // Only allow reordering of library components (index >= 3)
      const HARDCODED_COUNT = 3
      
      if (result.source.index < HARDCODED_COUNT && result.destination.index < HARDCODED_COUNT) {
        // Reordering hardcoded components - this is allowed
        return
      }
      
      if (result.source.index < HARDCODED_COUNT || result.destination.index < HARDCODED_COUNT) {
        // Don't allow mixing hardcoded and library components
        return
      }
      
      // Reorder library components (adjust indices to account for hardcoded components)
      const sourceLibraryIndex = result.source.index - HARDCODED_COUNT
      const destLibraryIndex = result.destination.index - HARDCODED_COUNT
      
      const items = Array.from(librarySyntax)
      const [reorderedItem] = items.splice(sourceLibraryIndex, 1)
      items.splice(destLibraryIndex, 0, reorderedItem)
      setLibrarySyntax(items)
      return
    }

    // Remove from construct if dropped in trash
    if (
      result.source.droppableId === "construct" &&
      result.destination.droppableId === "trash"
    ) {
      const items = Array.from(constructModules)
      items.splice(result.source.index, 1)
      setConstructModules(items)
      setSelectedModules(items)
    }
  }


  const handleReset = () => {
    setConstructModules([])
    setSelectedModules([])
  }

  // Ensure Total Library always exists and contains all modules
  React.useEffect(() => {
    setFolders(currentFolders => {
      const totalLibrary = currentFolders.find(f => f.id === 'total-library')
      if (!totalLibrary) {
        return [{
          id: 'total-library',
          name: 'Total Library',
          modules: customModules.map(m => m.id),
          open: true
        }, ...currentFolders]
      }
      // Update Total Library to include all modules
      return currentFolders.map(folder => 
        folder.id === 'total-library'
          ? { ...folder, modules: customModules.map(m => m.id) }
          : folder
      )
    })
  }, [customModules])

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {showRestoreBanner && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  A previous session was found. Your workspace will auto-restore on load.
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 text-sm border rounded"
                    onClick={() => setShowRestoreBanner(false)}
                  >
                    Hide
                  </button>
                  <button
                    className="px-3 py-1 text-sm border rounded"
                    onClick={handleClearSession}
                  >
                    Clear Saved Session
                  </button>
                </div>
              </div>
            </Card>
          )}
          <DesignMode
            cassetteMode={cassetteMode}
            onCassetteModeChange={setCassetteMode}
            inputMode={inputMode}
            onInputModeChange={setInputMode}
          />
          
          {inputMode === 'natural' && cassetteMode === 'single' && (
            <Card className="p-4">
              <NaturalLanguageInput
                onModulesGenerated={async (modules) => {
                  // Enrich and add each module similarly to manual selection
                  for (const m of modules) {
                    await handleModuleSelect(m)
                  }
                }}
                onError={(err) => toast.error(err)}
              />
            </Card>
          )}

          {inputMode === 'natural' && cassetteMode === 'multi' && (
            <ErrorBoundary>
              <MultiCassetteNatural
                folders={folders}
                setFolders={setFolders}
                customModules={customModules}
                setCustomModules={setCustomModules}
                onAddLibrary={handleAddLibrary}
                setSelectedFolderId={setSelectedFolderId}
              />
              <LibraryViewer folders={folders} customModules={customModules} />
              <MultiCassetteSetup
                onAddCassettes={(cassettes) => cassettes.forEach(c => handleAddCassette(c))}
                folders={folders}
                customModules={customModules}
                librarySyntax={librarySyntax}
                onAddLibrary={handleAddLibrary}
                onRemoveLibrary={handleRemoveLibrary}
                onLibraryTypeChange={handleLibraryTypeChange}
                onReorderLibraries={handleReorderLibraries}
              />
              <CassetteBatch 
                cassetteBatch={cassetteBatch}
                onDeleteCassette={handleDeleteCassette}
                onExportBatch={handleExportBatch}
                onUpdateCassette={handleUpdateCassette}
                barcodeMode={barcodeMode}
                requestGenerateBarcode={() => {
                  // Always choose from pool when available (button semantics)
                  if (barcodePool.length > 0) {
                    if (barcodeMode === 'internal') {
                      const { pickNextAvailable } = require('@/lib/barcodes') as any
                      const candidate = pickNextAvailable(barcodePool, usedBarcodes)
                      return candidate || nextBarcode()
                    }
                    // general: random from pool
                    const idx = Math.floor(Math.random() * barcodePool.length)
                    return barcodePool[idx]
                  }
                  return nextBarcode()
                }}
                isBarcodeTaken={(b, selfId) => !!cassetteBatch.find(c => c.barcode === b && c.id !== selfId)}
              />
            </ErrorBoundary>
          )}
          
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex flex-row gap-4 items-start">
              <div className="flex-1">
                {inputMode === 'manual' && (
                  <>
                    {cassetteMode === 'single' ? (
                      <SimpleModuleSelector
                        onModuleAdd={handleModuleSelect}
                        constructModules={constructModules}
                      />
                    ) : (
                      <>
                        <ModuleSelector
                          selectedModules={selectedModules}
                          onModuleSelect={handleModuleSelect}
                          onModuleDeselect={handleModuleDeselect}
                          customModules={customModules}
                          onCustomModulesChange={setCustomModules}
                          folders={folders}
                          setFolders={setFolders}
                          handleModuleClick={handleModuleClick}
                          hideTypeSelector={cassetteMode === 'multi'}
                        />
                        <ErrorBoundary>
                          <MultiCassetteSetup
                            onAddCassettes={(cassettes) => cassettes.forEach(c => handleAddCassette(c))}
                            folders={folders}
                            customModules={customModules}
                            librarySyntax={librarySyntax}
                            onAddLibrary={handleAddLibrary}
                            onRemoveLibrary={handleRemoveLibrary}
                            onLibraryTypeChange={handleLibraryTypeChange}
                            onReorderLibraries={handleReorderLibraries}
                          />
                        </ErrorBoundary>
                      </>
                    )}
                  </>
                )}
                
                {cassetteMode !== 'multi' && (
                  <ConstructLayout
                    constructModules={constructWithLinkers}
                    onModuleRemove={handleModuleRemove}
                    onReset={handleReset}
                    isMultiCassetteMode={false}
                    onAddCassette={handleAddCassette}
                  />
                )}

                {/* 3. Encoding box */}
                {cassetteMode !== 'multi' && (
                  <Card className="p-6 mt-4">
                    <h2 className="text-lg font-semibold mb-2">3. Encoding</h2>
                    {constructWithLinkers.length > 0 ? (
                      <p className="text-sm font-mono break-all">
                        {constructWithLinkers.map((item: any) => {
                          if (item.type === 'linker') return item.name
                          const type = item.type as Module['type']
                          const abbrev =
                            type === 'overexpression' ? 'OE' :
                            type === 'knockdown' ? 'KD' :
                            type === 'knockout' ? 'KO' :
                            type === 'knockin' ? 'KI' : type
                          return `${item.name} (${abbrev})`
                        }).join(' → ')}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Add elements in Syntax to see the encoding string.</p>
                    )}
                  </Card>
                )}
                
                {inputMode === 'manual' && (
                  <>
                    {/* Linker selector removed per request */}
                    <CassetteBatch 
                      cassetteBatch={cassetteBatch}
                      onDeleteCassette={handleDeleteCassette}
                      onExportBatch={handleExportBatch}
                      onUpdateCassette={handleUpdateCassette}
                      barcodeMode={barcodeMode}
                      requestGenerateBarcode={() => {
                        if (barcodePool.length > 0) {
                          if (barcodeMode === 'internal') {
                            const { pickNextAvailable } = require('@/lib/barcodes') as any
                            const candidate = pickNextAvailable(barcodePool, usedBarcodes)
                            return candidate || nextBarcode()
                          }
                          const idx = Math.floor(Math.random() * barcodePool.length)
                          return barcodePool[idx]
                        }
                        return nextBarcode()
                      }}
                      isBarcodeTaken={(b, selfId) => !!cassetteBatch.find(c => c.barcode === b && c.id !== selfId)}
                    />
                  </>
                )}
              </div>
            </div>
          </DragDropContext>
          
          {cassetteMode === 'single' && (
            <FinalConstruct 
              constructModules={constructWithLinkers}
              barcodeMode={barcodeMode}
              onBarcodeModeChange={setBarcodeMode}
              requestGenerateBarcode={() => {
                if (barcodeMode === 'internal' && internalPool.length > 0) {
                  // Random unused from internal pool
                  const candidates = internalPool.filter(p => !usedBarcodes.has(p.sequence))
                  const pick = candidates.length > 0 
                    ? candidates[Math.floor(Math.random() * candidates.length)]
                    : internalPool[Math.floor(Math.random() * internalPool.length)]
                  return `${pick.index}|${pick.sequence}`
                }
                if (barcodeMode === 'general' && generalPool.length > 0) {
                  const pick = generalPool[Math.floor(Math.random() * generalPool.length)]
                  // Store index alongside sequence by returning a tagged string: INDEX|SEQUENCE
                  return `${pick.index}|${pick.sequence}`
                }
                return nextBarcode()
              }}
              isBarcodeTaken={(b) => !!cassetteBatch.find(c => c.barcode === b)}
            />
          )}

          {/* 5. Predicted Function / Predicted Cellular Program */}
          {cassetteMode === 'single' && inputMode === 'manual' && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-2">5. Predicted Function / Predicted Cellular Program</h2>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm">
                    {predictedSentence ? (
                      <span>{predictedSentence}</span>
                    ) : (
                      <span className="text-muted-foreground">No prediction yet.</span>
                    )}
                  </div>
                  {predictedSources && predictedSources.length > 0 && (
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      {predictedSources.map((s, i) => (
                        <li key={i} className="text-sm">
                          <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                            {s.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Answers come from the same API used by Natural Language mode.</p>
                </div>
                <div>
                  <button
                    className="px-3 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
                    onClick={async () => {
                      const modules = constructWithLinkers.filter((item: any) => item.type !== 'linker') as any[]
                      if (modules.length === 0) { toast.error('No modules selected'); return }
                      setIsPredicting(true)
                      try {
                        const result = await predictTCellFunction(modules as any)
                        setPredictedSentence(result.sentence)
                        setPredictedSources(result.sources || [])
                      } catch (e) {
                        setPredictedSentence('Prediction failed.')
                        setPredictedSources([])
                      } finally {
                        setIsPredicting(false)
                      }
                    }}
                    disabled={isPredicting || constructWithLinkers.filter((i: any) => i.type !== 'linker').length === 0}
                  >
                    {isPredicting ? 'Predicting…' : 'Predict'}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default DesignLab