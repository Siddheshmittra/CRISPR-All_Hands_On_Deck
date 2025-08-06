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
import { LibraryManager } from "@/components/design-lab/library-manager"
import { CassetteBatch } from "@/components/design-lab/cassette-batch"
import { SimpleModuleSelector } from "@/components/design-lab/simple-module-selector"
import { Trash2 } from "lucide-react"
import React from "react"
import { useConstructManager } from "@/hooks/use-construct-manager"
import { LinkerSelector } from "@/components/design-lab/linker-selector"
import { enrichModuleWithSequence } from "@/lib/ensembl"
import { toast } from "sonner"

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
  const [cassetteCount, setCassetteCount] = useState(2)
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

  const handleAddLibrary = (libraryId: string) => {
    const library = folders.find(f => f.id === libraryId)
    if (!library || librarySyntax.find(l => l.id === libraryId)) return

    const newLibrary: LibrarySyntax = {
      id: libraryId,
      name: library.name,
      type: 'overexpression' // default type
    }
    setLibrarySyntax(prev => [...prev, newLibrary])
  }

  const handleRemoveLibrary = (libraryId: string) => {
    setLibrarySyntax(prev => prev.filter(l => l.id !== libraryId))
  }

  const handleLibraryTypeChange = (libraryId: string, type: 'overexpression' | 'knockout' | 'knockdown') => {
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
      barcode: barcode?.trim() || undefined
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
      
      const newLibraryItem: LibrarySyntax = {
        id: folder.id,
        name: folder.name,
        type: 'overexpression' // default type
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-card shadow-elevated rounded-lg overflow-hidden">
          <Header />
          
          <div className="p-6 space-y-6">
            <DesignMode
              cassetteMode={cassetteMode}
              onCassetteModeChange={setCassetteMode}
              inputMode={inputMode}
              onInputModeChange={setInputMode}
            />
            
            {inputMode === 'natural' && (
              <NaturalLanguageMode
                onSuggestedConstruct={modules => setConstructModules(modules)}
              />
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
                          <MultiCassetteSetup
                            cassetteCount={cassetteCount}
                            setCassetteCount={setCassetteCount}
                            onAddCassettes={(cassettes) => cassettes.forEach(c => handleAddCassette(c))}
                            folders={folders}
                            customModules={customModules}
                            librarySyntax={librarySyntax}
                            onAddLibrary={handleAddLibrary}
                            onRemoveLibrary={handleRemoveLibrary}
                            onLibraryTypeChange={handleLibraryTypeChange}
                          />
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
                  
                  {inputMode === 'manual' && (
                    <>
                      <LinkerSelector
                        selectedLinker={selectedLinkerId}
                        onLinkerChange={setSelectedLinkerId}
                        autoLink={autoLink}
                        onAutoLinkChange={setAutoLink}
                      />
                      <CassetteBatch 
                        cassetteBatch={cassetteBatch}
                        onDeleteCassette={handleDeleteCassette}
                        onExportBatch={handleExportBatch}
                        onUpdateCassette={handleUpdateCassette}
                      />
                    </>
                  )}
                </div>
              </div>
            </DragDropContext>
            
            <FinalConstruct constructModules={constructWithLinkers} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DesignLab