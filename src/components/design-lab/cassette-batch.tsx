import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Download, Edit3, Check, X, GripVertical } from "lucide-react"
import { Module } from "@/lib/types"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

interface Cassette {
  id: string
  modules: Module[]
}

interface CassetteBatchProps {
  cassetteBatch: Cassette[]
  onDeleteCassette: (cassetteId: string) => void
  onExportBatch: () => void
  onUpdateCassette?: (cassetteId: string, modules: Module[]) => void
}

export const CassetteBatch = ({ cassetteBatch, onDeleteCassette, onExportBatch, onUpdateCassette }: CassetteBatchProps) => {
  const [editingCassetteId, setEditingCassetteId] = useState<string | null>(null)
  const [editingModules, setEditingModules] = useState<Module[]>([])

  if (cassetteBatch.length === 0) {
    return null
  }

  const handleStartEdit = (cassette: Cassette) => {
    setEditingCassetteId(cassette.id)
    setEditingModules([...cassette.modules])
  }

  const handleSaveEdit = () => {
    if (editingCassetteId && onUpdateCassette) {
      onUpdateCassette(editingCassetteId, editingModules)
    }
    setEditingCassetteId(null)
    setEditingModules([])
  }

  const handleCancelEdit = () => {
    setEditingCassetteId(null)
    setEditingModules([])
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(editingModules)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setEditingModules(items)
  }

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Cassette Batch</h2>
        <Button variant="outline" size="sm" onClick={onExportBatch}>
          <Download className="h-4 w-4 mr-2" />
          Export Batch
        </Button>
      </div>
      <div className="space-y-4">
        {cassetteBatch.map((cassette, index) => (
          <div key={cassette.id} className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Cassette {index + 1}</div>
              <div className="flex gap-2">
                {editingCassetteId === cassette.id ? (
                  <>
                    <Button variant="outline" size="sm" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    {onUpdateCassette && (
                      <Button variant="outline" size="sm" onClick={() => handleStartEdit(cassette)}>
                        <Edit3 className="h-4 w-4 mr-1" />
                        Edit Syntax
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onDeleteCassette(cassette.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {editingCassetteId === cassette.id ? (
              <div className="border-2 border-dashed border-border rounded-lg p-4 bg-background">
                <p className="text-sm text-muted-foreground mb-3">Drag modules to reorder the cassette syntax:</p>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId={`cassette-${cassette.id}`} direction="horizontal">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex items-center gap-2 flex-wrap min-h-[48px] p-2 rounded transition-all ${
                          snapshot.isDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary' : ''
                        }`}
                      >
                        {editingModules.map((module, moduleIndex) => (
                          <Draggable key={module.id} draggableId={module.id} index={moduleIndex}>
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
                                <span className="text-xs text-muted-foreground">({module.type.toUpperCase()})</span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            ) : (
              <div>
                <p className="text-sm font-mono break-all">
                  {cassette.modules.map(m => m.name).join(' → ')}
                </p>
                <p className="text-xs text-muted-foreground font-mono break-all mt-1">
                  Sequence: {cassette.modules.map(m => m.sequence || '').join('')}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
} 