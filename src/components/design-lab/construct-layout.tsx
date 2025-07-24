import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ModuleButton } from "@/components/ui/module-button"
import { Trash2, RotateCcw, Shuffle, ArrowRight } from "lucide-react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

interface Module {
  id: string
  name: string
  type: "overexpression" | "knockout" | "knockdown"
  description?: string
}

interface ConstructLayoutProps {
  constructModules: Module[]
  onModuleRemove: (moduleId: string) => void
  onModuleReorder: (result: any) => void
  onRandomize: () => void
  onReset: () => void
}

export const ConstructLayout = ({ 
  constructModules, 
  onModuleRemove, 
  onModuleReorder,
  onRandomize,
  onReset 
}: ConstructLayoutProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">3. Construct Layout</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRandomize}>
            <Shuffle className="h-4 w-4 mr-2" />
            Randomize
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <div className="border-2 border-dashed border-border rounded-lg p-6 min-h-[120px] bg-gradient-surface">
        {constructModules.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <p>Drop modules here to build your construct</p>
            <p className="text-sm mt-1">Maximum 5 perturbations</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={onModuleReorder}>
            <Droppable droppableId="construct" direction="horizontal">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="flex items-center gap-3 flex-wrap"
                >
                  {constructModules.map((module, index) => (
                    <div key={module.id} className="flex items-center gap-2">
                      <Draggable draggableId={module.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`relative group ${snapshot.isDragging ? 'z-10' : ''}`}
                          >
                            <ModuleButton
                              moduleType={module.type}
                              className="cursor-move"
                            >
                              {module.name}
                            </ModuleButton>
                            <button
                              onClick={() => onModuleRemove(module.id)}
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                      {index < constructModules.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {constructModules.length > 0 && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">Cassette String:</h3>
          <p className="text-sm font-mono break-all">
            STOP-TAMPLEX → {constructModules.map(m => m.name).join(' → ')} → [PolyA]
          </p>
        </div>
      )}
    </Card>
  )
}