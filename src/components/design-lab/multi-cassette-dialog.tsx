import { useState, useMemo, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, ArrowRight, X, Trash2, GripVertical } from "lucide-react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { toast } from "sonner"
import { Module, LibrarySyntax } from "@/lib/types"
import { enrichModuleWithSequence } from "@/lib/ensembl"
import { randomUUID } from "@/lib/uuid"

// Hardcoded syntax components with their sequences and types
const HARDCODED_COMPONENTS = {
  t2a: {
    id: 't2a',
    name: 'T2A',
    type: 'hardcoded' as const,
    sequence: 'GAGGGCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCT',
    color: 'bg-muted',
    description: 'T2A self-cleaving peptide'
  },
  stop: {
    id: 'stop',
    name: 'STOP-Triplex-Adaptor',
    type: 'hardcoded' as const,
    sequence: 'TAATAAgaattcgattcgtcagtagggttgtaaaggtttttcttttcctgagaaaacaaccttttgttttctcaggttttgctttttggcctttccctagctttaaaaaaaaaaaagcaaaactcaccgaggcagttccataggatggcaagatcctggtattggtctgcgaGTAA',
    color: 'bg-muted',
    description: 'STOP codon with Triplex-Adaptor sequence'
  },
  intron: {
    id: 'intron',
    name: 'Intron',
    type: 'hardcoded' as const,
    sequence: 'GTAAGTCTTATTTAGTGGAAAGAATAGATCTTCTGTTCTTTCAAAAGCAGAAATGGCAATAACATTTTGTGCCATGAttttttttttCTGCAG',
    color: 'bg-muted',
    description: 'Intron sequence for mRNA processing'
  },
  isbc: {
    id: 'isbc',
    name: 'Internal Stuffer-Barcode Array',
    type: 'hardcoded' as const,
    sequence: 'GTAACGAGACCAGTATCAAGCCCGGGCAACAATGTGCGGACGGCGTTGGTCTCTAGCGNNNNNNNNNNNNNAGCG',
    color: 'bg-muted',
    description: 'Internal Stuffer-Barcode Array'
  },
  polya: {
    id: 'polya',
    name: 'polyA',
    type: 'hardcoded' as const,
    sequence: 'A'.repeat(300), // Truncated for display
    color: 'bg-muted',
    description: 'Poly-A tail for mRNA stability'
  }
} as const;

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





  const applyCassetteSyntax = (modules: Module[]): Module[] => {
    // 1. Re-order so all OE/KI come before KO/KD
    const early = modules.filter(m => m.type === 'overexpression' || m.type === 'knockin');
    const late = modules.filter(m => m.type === 'knockout' || m.type === 'knockdown');
    const ordered = [...early, ...late];
    
    const result: Module[] = [];
    const firstKOIdx = ordered.findIndex(m => m.type === 'knockout' || m.type === 'knockdown');

    ordered.forEach((module, idx) => {
      // Add intron before OE modules
      if (module.type === 'overexpression') {
        result.push({
          ...HARDCODED_COMPONENTS.intron,
          id: `intron-${randomUUID()}`,
        });
      }

      // Add STOP-Triplex-Adaptor before first KO/KD
      if (idx === firstKOIdx && firstKOIdx !== -1) {
        result.push({
          ...HARDCODED_COMPONENTS.stop,
          id: `stop-${randomUUID()}`,
        });
      }

      // Add the module itself with a new ID to ensure uniqueness
      result.push({
        ...module,
        id: `${module.id}-${randomUUID()}`,
      });

      // Add T2A after OE modules (except last)
      if (module.type === 'overexpression' && idx !== ordered.length - 1) {
        result.push({
          ...HARDCODED_COMPONENTS.t2a,
          id: `t2a-${randomUUID()}`,
        });
      }
    });

    // Add Internal Stuffer-Barcode Array at the end
    result.push({
      ...HARDCODED_COMPONENTS.isbc,
      id: `isbc-${randomUUID()}`,
    });

    // Add polyA if last module is KO/KD
    const lastModule = ordered[ordered.length - 1];
    if (lastModule && (lastModule.type === 'knockout' || lastModule.type === 'knockdown')) {
      result.push({
        ...HARDCODED_COMPONENTS.polya,
        id: `polya-${randomUUID()}`,
      });
    }

    return result;
  };

  const handleManualGenerate = async () => {
    if (!onAddCassettes || isGenerating) return;

    if (librarySyntax.length === 0) {
      toast.error('Please add libraries to the syntax section first');
      return;
    }

    // Show a confirmation dialog for large numbers of cassettes
    if (cassetteCount > 10) {
      const proceed = confirm(`You're generating ${cassetteCount} cassettes. This may take a while. Continue?`);
      if (!proceed) return;
    }

    // Initialize loading state
    setIsGenerating(true);
    const loadingToast = toast.loading(`Preparing to generate ${cassetteCount} cassettes...`);
    
    // Optimize batch size based on cassette count
    const BATCH_SIZE = Math.min(5, Math.max(1, Math.floor(50 / librarySyntax.length)));
    const totalBatches = Math.ceil(cassetteCount / BATCH_SIZE);
    let processedCount = 0;
    let successfulCassettes: Module[][] = [];

    try {
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const batchStart = batchNum * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, cassetteCount);
        const currentBatchSize = batchEnd - batchStart;
        
        // Update loading message
        toast.loading(
          `Generating cassettes ${batchStart + 1}-${batchEnd} of ${cassetteCount}...`, 
          { id: loadingToast }
        );

        // Process each cassette in the batch
        const batchPromises = Array.from({ length: currentBatchSize }, async (_, i) => {
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
            try {
              // Create a new module with the correct type
              const moduleWithNewType = {
                ...randomModule,
                id: `${randomModule.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: libSyntax.type,
                // Only clear sequence if type changed and we need to re-enrich
                sequence: randomModule.type === libSyntax.type ? randomModule.sequence : '',
                sequenceSource: randomModule.type === libSyntax.type ? randomModule.sequenceSource : undefined,
                // Store original sequence as fallback
                originalSequence: randomModule.sequence
              };
              
              // Only enrich if necessary
              if (randomModule.type !== libSyntax.type) {
                // Update loading message for this specific module
                toast.loading(
                  `Processing ${libSyntax.name} (${libSyntax.type})...`, 
                  { id: loadingToast }
                );
                
                const enriched = await enrichModuleWithSequence(moduleWithNewType)
                  .catch(err => {
                    console.error(`Failed to enrich ${randomModule.name}`, err);
                    toast.warning(`Using basic module for ${randomModule.name}`, {
                      id: `warning-${randomModule.id}`,
                      duration: 3000
                    });
                    return moduleWithNewType; // Return unenriched module as fallback
                  });
                
                // Apply cassette syntax to the enriched module
                return applyCassetteSyntax([enriched]);
              }
              
              // If no enrichment needed, just apply cassette syntax
              return applyCassetteSyntax([moduleWithNewType]);
              
            } catch (error) {
              console.error('Error processing module:', error);
              toast.error(`Error processing ${randomModule.name}`, {
                id: `error-${randomModule.id}`,
                duration: 3000
              });
              return [];
            }
        });
        
        const cassetteModules = await Promise.all(cassettePromises);
        // Flatten the array of module arrays into a single array of modules
        return cassetteModules.flat();
      });

      // Process batch with timeout to prevent UI freeze
      const batchTimeout = new Promise<Module[][]>((resolve) => {
        setTimeout(() => resolve([]), 30000); // 30s timeout per batch
      });
      
      const newCassettes = await Promise.race([
        Promise.all(batchPromises),
        batchTimeout
      ]);
      
      // Filter out any empty cassettes from failed module processing
      const validCassettes = newCassettes.filter(cassette => cassette.length > 0);
      successfulCassettes = [...successfulCassettes, ...validCassettes];
      processedCount += validCassettes.length;
      
      // Update progress
      const progress = Math.min(100, Math.round((processedCount / cassetteCount) * 100));
      toast.loading(
        `Generated ${processedCount} of ${cassetteCount} cassettes (${progress}%)...`, 
        { id: loadingToast }
      );
      
      // Small delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Only keep the requested number of cassettes
    const finalCassettes = successfulCassettes.slice(0, cassetteCount);
    
    if (finalCassettes.length > 0) {
      onAddCassettes(finalCassettes);
      toast.success(`Successfully generated ${finalCassettes.length} cassettes.`, {
        id: loadingToast,
        duration: 5000
      });
    } else {
      toast.error('Failed to generate any valid cassettes. Please check your libraries and try again.', {
        id: loadingToast,
        duration: 10000
      });
    }
  } catch (error) {
    console.error('Error generating cassettes:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    toast.error(`Failed to generate cassettes: ${errorMessage}`, {
      id: loadingToast,
      duration: 10000
    });
  } finally {
    setIsGenerating(false);
    // Ensure any remaining loading toasts are dismissed
    toast.dismiss(loadingToast);
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">3. Syntax</label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Randomize
                </Button>
                <Button variant="outline" size="sm">
                  Reset
                </Button>
              </div>
            </div>
            <div className="border-2 border-dashed border-border rounded-lg p-4 bg-background">
              <Droppable droppableId="library-syntax" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex items-center gap-2 flex-wrap min-h-[80px] p-4 rounded transition-all ${
                      snapshot.isDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary' : ''
                    }`}
                  >
                    {librarySyntax.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Add libraries above or drag them from the module selector to build your cassette syntax</span>
                    ) : (
                      <>
                        {/* Generate the syntax flow with hardcoded components interspersed */}
                        {librarySyntax.map((library, index) => {
                          const components = [];
                          
                          // Add Intron before OE libraries
                          if (library.type === 'overexpression') {
                            components.push(
                              <div key={`intron-${index}`} className="flex items-center gap-2">
                                <div className="px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm font-medium">
                                  Intron
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            );
                          }
                          
                          // Add STOP-Triplex-Adaptor before first KO/KD
                          const isFirstKOKD = (library.type === 'knockout' || library.type === 'knockdown') && 
                            !librarySyntax.slice(0, index).some(l => l.type === 'knockout' || l.type === 'knockdown');
                          if (isFirstKOKD) {
                            components.push(
                              <div key={`stop-${index}`} className="flex items-center gap-2">
                                <div className="px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm font-medium">
                                  STOP-Triplex-Adaptor
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            );
                          }
                          
                          // Add the library itself
                          components.push(
                            <Draggable key={library.id} draggableId={library.id} index={index}>
                              {(provided, snapshot) => (
                                <div key={`library-${index}`} className="flex items-center gap-2">
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`px-3 py-2 rounded-md text-sm font-medium cursor-move transition-all ${
                                      snapshot.isDragging ? 'shadow-lg rotate-2' : 'hover:shadow-md'
                                    } ${
                                      library.type === 'overexpression' ? 'bg-overexpression text-overexpression-foreground' :
                                      library.type === 'knockout' ? 'bg-knockout text-knockout-foreground' :
                                      library.type === 'knockdown' ? 'bg-knockdown text-knockdown-foreground' :
                                      'bg-card text-card-foreground'
                                    }`}
                                  >
                                    {library.name}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveLibrary(library.id);
                                      }}
                                      className="ml-2 h-4 w-4 p-0 opacity-60 hover:opacity-100"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {index < librarySyntax.length - 1 && (
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                          
                          // Add T2A after OE libraries (except if it's the last element)
                          if (library.type === 'overexpression' && index < librarySyntax.length - 1) {
                            components.push(
                              <div key={`t2a-${index}`} className="flex items-center gap-2">
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <div className="px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm font-medium">
                                  T2A
                                </div>
                              </div>
                            );
                          }
                          
                          return components;
                        }).flat()}
                        
                        {/* Always add final components */}
                        {librarySyntax.length > 0 && (
                          <>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div className="px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm font-medium">
                              Internal Stuffer-Barcode Array
                            </div>
                            {/* Add polyA if last library is KO/KD */}
                            {librarySyntax.length > 0 && 
                             (librarySyntax[librarySyntax.length - 1].type === 'knockout' || 
                              librarySyntax[librarySyntax.length - 1].type === 'knockdown') && (
                              <>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <div className="px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm font-medium">
                                  polyA
                                </div>
                              </>
                            )}
                          </>
                        )}
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
