import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ModuleButton } from "@/components/ui/module-button"
import { Trash2, RotateCcw, Shuffle, ArrowRight } from "lucide-react"
import { Droppable, Draggable } from "@hello-pangea/dnd"
import { ConstructItem, Module } from "@/lib/types"
import { Badge } from "../ui/badge"

interface ConstructLayoutProps {
  constructModules: ConstructItem[]
  onModuleRemove: (moduleId: string) => void
  onReset: () => void
  onAddCassette?: (modules: Module[]) => void
  isMultiCassetteMode?: boolean
}

// Helper to get arrow for module type
function getTypeArrow(type: string) {
  switch (type) {
    case 'knockdown': return '↓';
    case 'knockout': return '✖';
    case 'knockin': return '→';
    case 'overexpression': return '↑';
    default: return '';
  }
}

export const ConstructLayout = ({
  constructModules,
  onModuleRemove,
  onReset,
  onAddCassette,
  isMultiCassetteMode = false
}: ConstructLayoutProps) => {
  const handleAddCassetteClick = () => {
    if (onAddCassette) {
      const modulesOnly = constructModules.filter(item => item.type !== 'linker') as Module[]
      onAddCassette(modulesOnly)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">3. Encoding</h2>
        <div className="flex gap-2">
<Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          {isMultiCassetteMode && onAddCassette && constructModules.length > 0 && (
            <Button variant="default" size="sm" onClick={handleAddCassetteClick}>
              Add to Batch
            </Button>
          )}
        </div>
      </div>

      <div className="border-2 border-dashed border-border rounded-lg p-6 min-h-[120px] bg-gradient-surface">
        <div className="flex flex-row items-center w-full gap-4">
          <Droppable droppableId="construct" direction="horizontal">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`flex items-center gap-3 flex-wrap min-h-[48px] flex-1 transition-all duration-200 ${
                  snapshot.isDraggingOver 
                    ? 'bg-primary/10 border-2 border-dashed border-primary rounded-lg' 
                    : ''
                }`}
                style={{ minHeight: 48 }}
              >
                {constructModules.length === 0 ? (
                  <div className="w-full text-center text-muted-foreground pointer-events-none select-none">
                     <p>Arrange modules to define cassette encoding</p>
                    <p className="text-sm mt-1">Maximum 5 perturbations</p>
                  </div>
                ) : (
                  (() => {
                    let draggableIndex = 0
                    return constructModules.map((item, displayIndex) => {
                      const isLast = displayIndex === constructModules.length - 1
                      return (
                        <div key={item.id} className="flex items-center gap-2">
                          {item.type === 'linker' ? (
                            <Badge variant="outline" className="text-xs font-mono">
                              {item.name}
                            </Badge>
                          ) : (
                            <Draggable draggableId={item.id} index={draggableIndex++}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`relative group ${snapshot.isDragging ? 'z-10' : ''}`}
                                >
                                  {(() => {
                                    console.log('Module in syntax area:', item);
                                    return null;
                                  })()}
                                  <ModuleButton
                                    module={item}
                                    moduleType={item.type as any}
                                    className="cursor-move"
                                    enableContextMenu={true}
                                  >
                                    {getTypeArrow(item.type)} {item.name || item.gene_id || item.id || item.type || 'Unnamed'}
                                  </ModuleButton>
                                  <button
                                    onClick={() => onModuleRemove(item.id)}
                                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          )}
                          {!isLast && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      )
                    })
                  })()
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          {/* Inline Trash Area inside the dashed border */}
          <Droppable droppableId="trash">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex flex-col items-center justify-center w-14 h-16 rounded-lg border border-border bg-muted transition-colors select-none shadow-sm ml-2 ${snapshot.isDraggingOver ? 'bg-destructive/20 border-destructive' : ''}`}
              >
                <Trash2 className={`h-5 w-5 mb-1 ${snapshot.isDraggingOver ? 'text-destructive' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">Trash</span>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>

       {constructModules.length > 0 && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">Encoding String:</h3>
          <p className="text-sm font-mono break-all">
            {constructModules.map(m => m.name).join(' → ')}
          </p>
        </div>
      )}
    </Card>
  )
}