import { useState } from "react"
import { DragDropContext, type DropResult, Droppable } from "@hello-pangea/dnd"
import { Header } from "@/components/design-lab/header"
import { DesignMode } from "@/components/design-lab/design-mode"
import { ModuleSelector, predefinedModules } from "@/components/design-lab/module-selector"
import { ConstructLayout } from "@/components/design-lab/construct-layout"
import { FinalConstruct } from "@/components/design-lab/final-construct"
import { MultiCassetteDialog } from "@/components/design-lab/multi-cassette-dialog"
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
  const [designMode, setDesignMode] = useState<"manual" | "natural" | "multi">("manual")

  const handleModeChange = (mode: "manual" | "natural" | "multi") => {
    setDesignMode(mode)
    if (mode === "multi") {
      setMultiOpen(true)
    }
  }
  const [selectedModules, setSelectedModules] = useState<Module[]>([])
  const [constructModules, setConstructModules] = useState<Module[]>([])
  const [multiOpen, setMultiOpen] = useState(false)
  const [cassetteCount, setCassetteCount] = useState(2)
  const [modulesPerCassette, setModulesPerCassette] = useState(3)
  const [customModules, setCustomModules] = useState<Module[]>([])

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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    if (
      result.source.droppableId === "construct" &&
      result.destination.droppableId === "construct"
    ) {
      const items = Array.from(constructModules)
      const [reorderedItem] = items.splice(result.source.index, 1)
      items.splice(result.destination.index, 0, reorderedItem)
      setConstructModules(items)
    }

    if (
      result.source.droppableId === "available-modules" &&
      result.destination.droppableId === "construct"
    ) {
      // Try both predefined and custom modules
      const allModules = [...predefinedModules, ...customModules]
      const module = allModules.find(m => m.id === result.draggableId)
      if (!module) return
      if (constructModules.some(m => m.id === module.id)) return
      if (constructModules.length >= 5) return
      setConstructModules(prev => [...prev, module])
      setSelectedModules(prev => [...prev, module])
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
            <DesignMode mode={designMode} onModeChange={handleModeChange} />
            <MultiCassetteDialog
              open={multiOpen}
              cassetteCount={cassetteCount}
              modulesPerCassette={modulesPerCassette}
              setCassetteCount={setCassetteCount}
              setModulesPerCassette={setModulesPerCassette}
              onClose={() => setMultiOpen(false)}
            />
            
            <LibraryManager
              customModules={customModules}
              onCustomModulesChange={setCustomModules}
            />
            
            {designMode === "natural" && (
              <NaturalLanguageMode
                onSuggestedConstruct={(modules) => setConstructModules(modules)}
              />
            )}
            
            {designMode === "manual" && (
              <DragDropContext onDragEnd={handleDragEnd}>
                <ModuleSelector
                  selectedModules={selectedModules}
                  onModuleSelect={handleModuleSelect}
                  onModuleDeselect={handleModuleDeselect}
                  customModules={customModules}
                  onCustomModulesChange={setCustomModules}
                />
                
                <ConstructLayout
                  constructModules={constructModules}
                  onModuleRemove={handleModuleRemove}
                  onRandomize={handleRandomize}
                  onReset={handleReset}
                />
                {/* Trash Area for drag-to-remove */}
                <div className="flex justify-center mt-6">
                  <Droppable droppableId="trash">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-col items-center justify-center w-24 h-24 rounded-full border-2 border-dashed transition-colors ${snapshot.isDraggingOver ? 'bg-destructive/20 border-destructive' : 'bg-muted border-border'}`}
                      >
                        <Trash2 className={`h-10 w-10 ${snapshot.isDraggingOver ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <span className="text-xs mt-2 text-muted-foreground">Trash</span>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
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