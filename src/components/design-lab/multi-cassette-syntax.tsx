import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, GripVertical, Plus } from "lucide-react"
import { Module, AnnotatedSegment } from "@/lib/types"
import { SequenceViewer } from "./sequence-viewer"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

interface Library {
  id: string
  name: string
  modules: Module[]
  color?: string
}

interface MultiCassetteSyntaxProps {
  libraries: Library[]
  onLibrariesChange: (libraries: Library[]) => void
  availableModules: Module[]
  folders: any[]
}

// Hardcoded syntax elements for multi-cassette constructs
const T2A_SEQUENCE = "GAGGGCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCT"
const STOP_TAMPLEX_SEQUENCE = "TAATAA"
const POLYA_SEQUENCE = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

export const MultiCassetteSyntax = ({ 
  libraries, 
  onLibrariesChange, 
  availableModules, 
  folders 
}: MultiCassetteSyntaxProps) => {
  const [expandedLibraryId, setExpandedLibraryId] = useState<string | null>(null)

  const generateAnnotatedSequence = (modules: Module[]): AnnotatedSegment[] => {
    const segments: AnnotatedSegment[] = []
    modules.forEach((module, index) => {
      segments.push({
        name: module.name,
        sequence: module.sequence || "",
        type: 'module',
        action: module.type as any
      })

      if (index < modules.length - 1) {
        segments.push({ name: 'T2A', sequence: T2A_SEQUENCE, type: 'hardcoded' })
      }
    })
    segments.push({ name: 'Stop/PolyA', sequence: STOP_TAMPLEX_SEQUENCE + POLYA_SEQUENCE, type: 'hardcoded' })
    return segments
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const sourceLibraryId = result.source.droppableId.replace('library-', '')
    const destLibraryId = result.destination.droppableId.replace('library-', '')

    // Handle drag from module selector to library
    if (result.source.droppableId === 'module-selector') {
      const moduleId = result.draggableId
      const module = availableModules.find(m => m.id === moduleId)
      if (!module) return

      const updatedLibraries = libraries.map(lib => {
        if (lib.id === destLibraryId) {
          const newModules = [...lib.modules]
          newModules.splice(result.destination!.index, 0, module)
          return { ...lib, modules: newModules }
        }
        return lib
      })
      onLibrariesChange(updatedLibraries)
      return
    }

    // Handle reordering within the same library
    if (sourceLibraryId === destLibraryId) {
      const updatedLibraries = libraries.map(lib => {
        if (lib.id === sourceLibraryId) {
          const newModules = Array.from(lib.modules)
          const [reorderedModule] = newModules.splice(result.source.index, 1)
          newModules.splice(result.destination!.index, 0, reorderedModule)
          return { ...lib, modules: newModules }
        }
        return lib
      })
      onLibrariesChange(updatedLibraries)
    }
  }

  const removeModuleFromLibrary = (libraryId: string, moduleIndex: number) => {
    const updatedLibraries = libraries.map(lib => {
      if (lib.id === libraryId) {
        const newModules = lib.modules.filter((_, index) => index !== moduleIndex)
        return { ...lib, modules: newModules }
      }
      return lib
    })
    onLibrariesChange(updatedLibraries)
  }

  const addNewLibrary = () => {
    const newLibrary: Library = {
      id: `library-${Date.now()}`,
      name: `Library ${libraries.length + 1}`,
      modules: [],
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    }
    onLibrariesChange([...libraries, newLibrary])
  }

  const removeLibrary = (libraryId: string) => {
    onLibrariesChange(libraries.filter(lib => lib.id !== libraryId))
  }

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Multi-Cassette Library Syntax</h2>
        <Button variant="outline" size="sm" onClick={addNewLibrary}>
          <Plus className="h-4 w-4 mr-2" />
          Add Library
        </Button>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        Drag modules from the module selector into libraries below. Each library represents a collection of modules that will be used to generate cassettes.
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-4">
          {libraries.map((library) => (
            <div key={library.id} className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: library.color }}
                  />
                  <div className="font-semibold">{library.name}</div>
                  <span className="text-sm text-muted-foreground">
                    ({library.modules.length} modules)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeLibrary(library.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <Droppable droppableId={`library-${library.id}`} direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex items-center gap-2 flex-wrap min-h-[60px] p-3 rounded border-2 border-dashed transition-all ${
                      snapshot.isDraggingOver 
                        ? 'bg-primary/10 border-primary' 
                        : 'border-border bg-background'
                    }`}
                  >
                    {library.modules.length === 0 && (
                      <div className="text-sm text-muted-foreground italic">
                        Drag modules here to build this library
                      </div>
                    )}
                    
                    {library.modules.map((module, moduleIndex) => (
                      <Draggable 
                        key={`${library.id}-${module.id}-${moduleIndex}`} 
                        draggableId={`${library.id}-${module.id}-${moduleIndex}`} 
                        index={moduleIndex}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`flex items-center gap-1 px-3 py-2 bg-card border rounded-md cursor-move transition-all ${
                              snapshot.isDragging ? 'shadow-lg rotate-2' : 'hover:shadow-md'
                            }`}
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-medium">{module.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({module.type.toUpperCase()})
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 ml-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeModuleFromLibrary(library.id, moduleIndex)
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {library.modules.length > 0 && (
                <div className="mt-3">
                  <Button 
                    variant="link" 
                    className="p-0 h-auto" 
                    onClick={() => setExpandedLibraryId(
                      expandedLibraryId === library.id ? null : library.id
                    )}
                  >
                    {expandedLibraryId === library.id ? 'Hide' : 'Show'} Library Sequence Preview
                  </Button>
                  {expandedLibraryId === library.id && (
                    <div className="mt-2">
                      <SequenceViewer segments={generateAnnotatedSequence(library.modules)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {libraries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">No libraries created yet</p>
              <p className="text-sm">Click "Add Library" to create your first library for multi-cassette generation</p>
            </div>
          )}
        </div>
      </DragDropContext>
    </Card>
  )
}
