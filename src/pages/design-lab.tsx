import { useState } from "react"
import { DragDropContext, type DropResult, Droppable } from "@hello-pangea/dnd"
import { Header } from "@/components/design-lab/header"
import { DesignMode } from "@/components/design-lab/design-mode"
import { ModuleSelector } from "@/components/design-lab/module-selector"
import { ConstructLayout } from "@/components/design-lab/construct-layout"
import { FinalConstruct } from "@/components/design-lab/final-construct"
import { MultiCassetteSetup } from "@/components/design-lab/multi-cassette-dialog"
import { NaturalLanguageMode } from "@/components/design-lab/natural-language-mode"
import { LibraryManager } from "@/components/design-lab/library-manager"
import { Trash2 } from "lucide-react"

interface Module {
  id: string
  name: string
  type: "overexpression" | "knockout" | "knockdown"
  description?: string
}

const DesignLab = () => {
  const [cassetteMode, setCassetteMode] = useState<'single' | 'multi'>('single')
  const [inputMode, setInputMode] = useState<'manual' | 'natural'>('manual')
  const [selectedModules, setSelectedModules] = useState<Module[]>([])
  const [constructModules, setConstructModules] = useState<Module[]>([])
  const [cassetteCount, setCassetteCount] = useState(2)
  const [overexpressionCount, setOverexpressionCount] = useState(0)
  const [knockoutCount, setKnockoutCount] = useState(0)
  const [knockdownCount, setKnockdownCount] = useState(0)
  const [customModules, setCustomModules] = useState<Module[]>([])
  const [folders, setFolders] = useState<any[]>([])

  const handleModuleSelect = (module: Module) => {
    if (constructModules.length >= 5) {
      return // Max 5 modules
    }
    setSelectedModules(prev => [...prev, module])
    setConstructModules(prev => [...prev, module])
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
      setConstructModules(prev => [...prev, module])
      setSelectedModules(prev => [...prev, module])
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


  const handleRandomize = () => {
    const shuffled = [...constructModules].sort(() => Math.random() - 0.5)
    setConstructModules(shuffled)
  }

  const handleReset = () => {
    setConstructModules([])
    setSelectedModules([])
  }

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
            {cassetteMode === 'multi' && (
              <MultiCassetteSetup
                cassetteCount={cassetteCount}
                setCassetteCount={setCassetteCount}
                overexpressionCount={overexpressionCount}
                setOverexpressionCount={setOverexpressionCount}
                knockoutCount={knockoutCount}
                setKnockoutCount={setKnockoutCount}
                knockdownCount={knockdownCount}
                setKnockdownCount={setKnockdownCount}
              />
            )}
            
            {inputMode === 'natural' && (
              <NaturalLanguageMode
                onSuggestedConstruct={modules => setConstructModules(modules)}
              />
            )}
            
            {inputMode === 'manual' && (
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex flex-row gap-4 items-start">
                  <div className="flex-1">
                    <ModuleSelector
                      selectedModules={selectedModules}
                      onModuleSelect={handleModuleSelect}
                      onModuleDeselect={handleModuleDeselect}
                      customModules={customModules}
                      onCustomModulesChange={setCustomModules}
                      folders={folders}
                      setFolders={setFolders}
                      handleModuleClick={handleModuleClick}
                    />
                    <ConstructLayout
                      constructModules={constructModules}
                      onModuleRemove={handleModuleRemove}
                      onRandomize={handleRandomize}
                      onReset={handleReset}
                    />
                  </div>
                </div>
              </DragDropContext>
            )}
            
            <FinalConstruct constructModules={constructModules} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DesignLab