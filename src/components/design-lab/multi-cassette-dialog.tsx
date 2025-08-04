import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, ArrowRight, X, Trash2, GripVertical } from "lucide-react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { toast } from "sonner"
import { Module, LibrarySyntax } from "@/lib/types"
import { enrichModuleWithSequence } from "@/lib/ensembl"

// Hardcoded syntax components
const HARDCODED_COMPONENTS = [
  { id: 't2a', name: 'T2A', type: 'hardcoded' as const },
  { id: 'stop', name: 'STOP', type: 'hardcoded' as const },
  { id: 'polya', name: 'PolyA', type: 'hardcoded' as const }
]

interface MultiCassetteSetupProps {
  cassetteCount: number;
  setCassetteCount: (n: number) => void;
  showGoButton?: boolean;
  onAddCassettes?: (cassettes: Module[][]) => void;
  folders: any[];
  customModules: Module[];
  librarySyntax: LibrarySyntax[];
  onAddLibrary: (libraryId: string) => void;
  onRemoveLibrary: (libraryId: string) => void;
  onLibraryTypeChange: (libraryId: string, type: 'overexpression' | 'knockout' | 'knockdown') => void;
}



export const MultiCassetteSetup = ({
  cassetteCount,
  setCassetteCount,
  showGoButton = false,
  onAddCassettes,
  folders,
  customModules,
  librarySyntax,
  onAddLibrary,
  onRemoveLibrary,
  onLibraryTypeChange,
}: MultiCassetteSetupProps) => {
  const [selectedLibrary, setSelectedLibrary] = useState<string>('total-library')
  const [isGenerating, setIsGenerating] = useState(false)





  const handleManualGenerate = async () => {
    if (!onAddCassettes || isGenerating) return

    if (librarySyntax.length === 0) {
      toast.error('Please add libraries to the syntax section first');
      return;
    }

    if (cassetteCount > 50) {
      const proceed = confirm(`You're generating ${cassetteCount} cassettes. This may take a while. Continue?`);
      if (!proceed) return;
    }

    setIsGenerating(true);
    const BATCH_SIZE = 10; // Process 10 cassettes at a time
    const totalBatches = Math.ceil(cassetteCount / BATCH_SIZE);

    try {
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const batchStart = batchNum * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, cassetteCount);
        toast.info(`Processing batch ${batchNum + 1} of ${totalBatches} (cassettes ${batchStart + 1}-${batchEnd})...`);

        const batchPromises = Array.from({ length: batchEnd - batchStart }, async (_, i) => {
          const cassettePromises = librarySyntax.map(async (libSyntax) => {
            const library = folders.find(f => f.id === libSyntax.id);
            if (!library || !library.modules || library.modules.length === 0) {
              throw new Error(`Library '${library?.name || libSyntax.id}' is empty or not found.`);
            }
            const libraryModules = customModules.filter(m => library.modules.includes(m.id));
            if (libraryModules.length === 0) {
              throw new Error(`No modules found for library '${library.name}'.`);
            }

            const randomModule = libraryModules[Math.floor(Math.random() * libraryModules.length)];
            const moduleWithNewType = {
              ...randomModule,
              type: libSyntax.type,
              sequence: randomModule.type === libSyntax.type ? randomModule.sequence : '',
              sequenceSource: randomModule.type === libSyntax.type ? randomModule.sequenceSource : undefined,
            };

            if (randomModule.type !== libSyntax.type) {
              return enrichModuleWithSequence(moduleWithNewType).catch(err => {
                console.error(`Failed to enrich ${randomModule.name}`, err);
                toast.warning(`Could not enrich ${randomModule.name}, using basic module.`);
                return moduleWithNewType;
              });
            }
            return moduleWithNewType;
          });
          return Promise.all(cassettePromises);
        });

        const newCassettes = await Promise.all(batchPromises);
        onAddCassettes(newCassettes);
      }

      toast.success(`Successfully generated ${cassetteCount} cassettes.`);
    } catch (error) {
      console.error('Error generating cassettes:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast.error(`Failed to generate cassettes: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };



  return (
    <Card className="p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4">Multi-Cassette Setup</h3>
      
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
                  onClick={() => onAddLibrary(selectedLibrary)}
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
              
                <Droppable droppableId="library-syntax" direction="horizontal">
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex items-center gap-2 flex-wrap min-h-[48px] p-2 rounded transition-all ${
                        snapshot.isDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary' : ''
                      }`}
                    >
                      {librarySyntax.length === 0 && HARDCODED_COMPONENTS.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Add libraries above or drag them from the module selector to build your cassette syntax</span>
                      ) : (
                        <>
                          {/* Hardcoded components - always visible */}
                          {HARDCODED_COMPONENTS.map((component, index) => (
                            <Draggable key={component.id} draggableId={component.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`flex items-center gap-2 px-3 py-2 bg-secondary border rounded-md cursor-move transition-all ${
                                    snapshot.isDragging ? 'shadow-lg rotate-2' : 'hover:shadow-md'
                                  }`}
                                >
                                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm font-medium text-secondary-foreground">{component.name}</span>
                                  <span className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground">Hardcoded</span>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          
                          {/* Library components */}
                          {librarySyntax.map((library, index) => (
                            <Draggable key={library.id} draggableId={library.id} index={index + HARDCODED_COMPONENTS.length}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-move transition-all ${
                                    snapshot.isDragging ? 'shadow-lg rotate-2' : 'hover:shadow-md'
                                  } ${
                                    library.type === 'overexpression' ? 'bg-overexpression text-overexpression-foreground border-overexpression/30' :
                                    library.type === 'knockout' ? 'bg-knockout text-knockout-foreground border-knockout/30' :
                                    library.type === 'knockdown' ? 'bg-knockdown text-knockdown-foreground border-knockdown/30' :
                                    'bg-card border'
                                  }`}
                                >
                                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm font-medium">{library.name}</span>
                                  <Select
                                    value={library.type}
                                    onValueChange={(value: 'overexpression' | 'knockout' | 'knockdown') => 
                                      onLibraryTypeChange(library.id, value)
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
                                    onClick={() => onRemoveLibrary(library.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        </>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
            </div>
          </div>
          <Button 
            className="mt-4 w-full" 
            onClick={handleManualGenerate}
            disabled={librarySyntax.length === 0}
          >
            Generate {cassetteCount} Cassettes from Library Syntax
          </Button>
    </Card>
  )
}
