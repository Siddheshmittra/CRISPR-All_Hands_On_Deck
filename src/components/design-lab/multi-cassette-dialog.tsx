import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, ArrowRight, X, Trash2, GripVertical } from "lucide-react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { toast } from "sonner"
import { searchEnsembl, enrichModuleWithSequence } from "@/lib/ensembl"
import { Module } from "@/lib/types"
import { UnifiedGeneSearch } from "./unified-gene-search"

interface MultiCassetteSetupProps {
  cassetteCount: number
  setCassetteCount: (n: number) => void
  overexpressionCount: number
  setOverexpressionCount: (n: number) => void
  knockoutCount: number
  setKnockoutCount: (n: number) => void
  knockdownCount: number
  setKnockdownCount: (n: number) => void
  showGoButton?: boolean
  onAddCassettes?: (cassettes: Module[][]) => void
  folders: any[]
  customModules: Module[]
}

interface LibrarySyntax {
  id: string;
  name: string;
  type: 'overexpression' | 'knockout' | 'knockdown';
}

export const MultiCassetteSetup = ({
  cassetteCount,
  setCassetteCount,
  overexpressionCount,
  setOverexpressionCount,
  knockoutCount,
  setKnockoutCount,
  knockdownCount,
  setKnockdownCount,
  showGoButton = false,
  onAddCassettes,
  folders,
  customModules
}: MultiCassetteSetupProps) => {
  const [mode, setMode] = useState<'manual' | 'search'>('manual')
  const [selectedLibrary, setSelectedLibrary] = useState<string>('total-library')
  const [librarySyntax, setLibrarySyntax] = useState<LibrarySyntax[]>([])
  
  // Gene search functionality - simplified with unified component
  const [selectedModules, setSelectedModules] = useState<Module[]>([])

  const totalPerturbations =
    (Number(overexpressionCount) || 0) +
    (Number(knockoutCount) || 0) +
    (Number(knockdownCount) || 0)
  const maxPerturbations = 5
  const overLimit = totalPerturbations > maxPerturbations

  // Unified gene search handlers
  const handleAddModule = (module: Module) => {
    setSelectedModules(prev => [...prev, module])
  }

  const handleRemoveModule = (moduleId: string) => {
    setSelectedModules(prev => prev.filter(m => m.id !== moduleId))
  }

  const handleClearAllModules = () => {
    setSelectedModules([])
  }

  // Library syntax handlers
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
    setLibrarySyntax(prev => prev.map(l => l.id === libraryId ? { ...l, type } : l))
  }

  const handleLibrarySyntaxDragEnd = (result: DropResult) => {
    if (!result.destination) return
    
    const items = Array.from(librarySyntax)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)
    
    setLibrarySyntax(items)
  }

  // Helper for input: allow empty, clamp, no leading zeros
  function handleCountChange(setter: (n: number) => void, value: string) {
    if (value === "") {
      setter(0)
      return
    }
    const sanitized = value.replace(/^0+(?!$)/, "")
    let n = parseInt(sanitized, 10)
    if (isNaN(n) || n < 0) n = 0
    if (n > maxPerturbations) n = maxPerturbations
    setter(n)
  }

  function handleSearchGenerate() {
    if (!onAddCassettes || selectedModules.length === 0) {
      toast.error('Please add some modules first')
      return
    }

    const cassettes: Module[][] = []
    for (let i = 0; i < cassetteCount; i++) {
      const cassette: Module[] = []
      // Use selected modules to create cassettes
      const shuffledModules = [...selectedModules].sort(() => Math.random() - 0.5)
      const modulesToUse = shuffledModules.slice(0, Math.min(totalPerturbations, selectedModules.length))
      cassette.push(...modulesToUse)
      cassettes.push(cassette)
    }
    onAddCassettes(cassettes)
    toast.success(`Generated ${cassetteCount} cassettes`)
  }

  function handleManualGenerate() {
    if (!onAddCassettes) return

    if (librarySyntax.length === 0) {
      toast.error('Please add libraries to the syntax section first')
      return
    }

    const cassettes: Module[][] = []
    for (let i = 0; i < cassetteCount; i++) {
      const cassette: Module[] = []
      
      // Generate modules based on library syntax order and types
      librarySyntax.forEach(libSyntax => {
        const library = folders.find(f => f.id === libSyntax.id)
        if (!library) return
        
        const libraryModules = customModules.filter(m => 
          library.modules.includes(m.id) && m.type === libSyntax.type
        )
        
        if (libraryModules.length > 0) {
          const randomModule = libraryModules[Math.floor(Math.random() * libraryModules.length)]
          cassette.push({ ...randomModule, type: libSyntax.type })
        }
      })
      
      cassettes.push(cassette)
    }
    onAddCassettes(cassettes)
    toast.success(`Generated ${cassetteCount} cassettes from library syntax`)
  }



  return (
    <Card className="p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4">Multi-Cassette Setup</h3>
      
      {/* Mode Selection */}
      <div className="flex gap-2 mb-6">
        <Button 
          variant={mode === 'manual' ? 'default' : 'outline'} 
          onClick={() => setMode('manual')}
          size="sm"
        >
          Manual Library
        </Button>
        <Button 
          variant={mode === 'search' ? 'default' : 'outline'} 
          onClick={() => setMode('search')}
          size="sm"
        >
          <Search className="w-4 h-4 mr-1" />
          Gene Search
        </Button>
      </div>

      {/* Manual Library Mode - Primary */}
      {mode === 'manual' && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1 text-sm font-medium">Number of Cassettes</label>
              <Input
                type="number"
                min={1}
                value={cassetteCount}
                onChange={e => setCassetteCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Add Library to Syntax</label>
              <div className="flex gap-2">
                <select
                  value={selectedLibrary}
                  onChange={e => setSelectedLibrary(e.target.value)}
                  className="h-9 px-2 flex-1 rounded-md border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => handleAddLibrary(selectedLibrary)}
                  disabled={librarySyntax.find(l => l.id === selectedLibrary) !== undefined}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Library Syntax Section */}
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium">Library Syntax (Drag to reorder)</label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 bg-background">
              <DragDropContext onDragEnd={handleLibrarySyntaxDragEnd}>
                <Droppable droppableId="library-syntax" direction="horizontal">
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex items-center gap-2 flex-wrap min-h-[48px] p-2 rounded transition-all ${
                        snapshot.isDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary' : ''
                      }`}
                    >
                      {librarySyntax.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Add libraries above to build your cassette syntax</span>
                      ) : (
                        librarySyntax.map((library, index) => (
                          <Draggable key={library.id} draggableId={library.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`flex items-center gap-2 px-3 py-2 bg-card border rounded-md cursor-move transition-all ${
                                  snapshot.isDragging ? 'shadow-lg rotate-2' : 'hover:shadow-md'
                                }`}
                              >
                                <GripVertical className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm font-medium">{library.name}</span>
                                <Select
                                  value={library.type}
                                  onValueChange={(value: 'overexpression' | 'knockout' | 'knockdown') => 
                                    handleLibraryTypeChange(library.id, value)
                                  }
                                >
                                  <SelectTrigger className="w-32 h-6 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="overexpression">Overexpression</SelectItem>
                                    <SelectItem value="knockout">Knockout</SelectItem>
                                    <SelectItem value="knockdown">Knockdown</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveLibrary(library.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>
          <Button 
            className="mt-4 w-full" 
            onClick={handleManualGenerate}
            disabled={librarySyntax.length === 0}
          >
            Generate {cassetteCount} Cassettes from Library Syntax
          </Button>
        </>
      )}

      {/* Gene Search Mode */}
      {mode === 'search' && (
        <>
          <div className="space-y-4">
            {/* Unified Gene Search Component */}
            <UnifiedGeneSearch
              onModuleAdd={handleAddModule}
              selectedModules={selectedModules}
              onModuleRemove={handleRemoveModule}
              onClearAll={handleClearAllModules}
              showTypeButtons={true}
              showSelectedModules={true}
            />

            {/* Cassette Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">Number of Cassettes</label>
                <Input
                  type="number"
                  min={1}
                  value={cassetteCount}
                  onChange={e => setCassetteCount(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Modules per Cassette</label>
                <Input
                  type="number"
                  min={1}
                  max={selectedModules.length}
                  value={Math.min(selectedModules.length, 5)}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleSearchGenerate}
              disabled={selectedModules.length === 0}
            >
              Generate {cassetteCount} Cassettes from Selected Modules
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
