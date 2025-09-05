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
// Removed NaturalLanguageInput from multi-cassette manual section

// Hardcoded syntax components with their sequences and types
// Sequences follow the rules table provided by the user
const HARDCODED_COMPONENTS = {
  intron: {
    id: 'intron',
    name: 'Intron',
    type: 'hardcoded' as const,
    sequence:
      'GTAAGTCTTATTTAGTGGAAAGAATAGATCTTCTGTTCTTTCAAAAGCAGAAATGGCAATAACATTTTGTGCCATGA' +
      'tttttttttt' +
      'CTGCAG',
    color: 'bg-muted',
    description: 'Intron sequence for mRNA processing'
  },
  t2a: {
    id: 't2a',
    name: 'T2A',
    type: 'hardcoded' as const,
    sequence: 'GAAGGAAGAGGAAGCCTTCTCACATGCGGAGATGTGGAAGAGAATCCTGGACCA',
    color: 'bg-muted',
    description: 'T2A self-cleaving peptide'
  },
  stop: {
    id: 'stop',
    name: 'STOP',
    type: 'hardcoded' as const,
    sequence: 'TGA',
    color: 'bg-muted',
    description: 'Stop codon'
  },
  triplex: {
    id: 'triplex',
    name: 'Triplex',
    type: 'hardcoded' as const,
    sequence: 'gaattcgattcgtcagtagggttgtaaaggtttttcttttcctgagaaaacaaccttttgttttctcaggttttgctttttggcctttccctagctttaaaaaaaaaaaagcaaaactcaccgaggcagttccataggatggcaagatcctggtattggtctgcga',
    color: 'bg-muted',
    description: 'Triplex sequence'
  },
  adaptor: {
    id: 'adaptor',
    name: 'Adaptor',
    type: 'hardcoded' as const,
    sequence: 'GTAA',
    color: 'bg-muted',
    description: 'Adaptor sequence'
  },
  internalStuffer: {
    id: 'internal-stuffer',
    name: 'Internal Stuffer',
    type: 'hardcoded' as const,
    sequence: 'GTAACGAGACCAGTATCAAGCCCGGGCAACAATGTGCGGACGGCGTTGGTCTCTAGCG',
    color: 'bg-muted',
    description: 'Internal Stuffer'
  },
  barcodes: {
    id: 'barcodes',
    name: 'Barcodes',
    type: 'hardcoded' as const,
    sequence: 'NNNNNNNNNNNAGCG',
    color: 'bg-muted',
    description: 'Barcodes'
  },
  polya: {
    id: 'polya',
    name: 'polyA',
    type: 'hardcoded' as const,
    sequence: 'caccgggtcttcaacttgtttattgcagcttataatggttacaaataaagcaatagcatcacaaatttcacaaataaagcatttttttcactgcattctagttgtggtttgtccaaactcatcaatgtatcttatcatgtctggaagacctgtttacc',
    color: 'bg-muted',
    description: 'Poly-A tail for mRNA stability'
  }
} as const;

interface MultiCassetteSetupProps {
  showGoButton?: boolean;
  onAddCassettes?: (cassettes: Module[][]) => void;
  folders: any[];
  customModules: Module[];
  librarySyntax: LibrarySyntax[];
  onAddLibrary: (libraryId: string) => void;
  onRemoveLibrary: (libraryId: string) => void;
  onLibraryTypeChange: (libraryId: string, type: 'overexpression' | 'knockout' | 'knockdown' | 'knockin') => void;
  onReorderLibraries: (newOrder: LibrarySyntax[]) => void;
  onLibrariesChange?: (libraries: LibrarySyntax[]) => void;
}



export const MultiCassetteSetup = (props: MultiCassetteSetupProps) => {
  const {
    showGoButton = false,
    onAddCassettes,
    folders,
    customModules,
    librarySyntax,
    onAddLibrary,
    onRemoveLibrary,
    onLibraryTypeChange,
    onReorderLibraries,
    onLibrariesChange
  } = props;
  const [selectedLibrary, setSelectedLibrary] = useState<string>('total-library')
  const [isGenerating, setIsGenerating] = useState(false)
  const [libraries, setLibraries] = useState<LibrarySyntax[]>([])
  
  // Filter libraries: hide 'total-library' if it mixes perturbation types
  const eligibleLibraries = useMemo(() => {
    const result = folders.filter(folder => {
      if (folder.id !== 'total-library') return true
      const moduleObjs = (folder.modules || []).map((id: string) => customModules.find(m => m.id === id)).filter(Boolean)
      const uniqueTypes = new Set(moduleObjs.map((m: any) => m?.type))
      return uniqueTypes.size <= 1
    })
    return result
  }, [folders, customModules])

  // Ensure selection is always an eligible library
  useEffect(() => {
    if (!eligibleLibraries.find(l => l.id === selectedLibrary)) {
      setSelectedLibrary(eligibleLibraries[0]?.id || '')
    }
  }, [eligibleLibraries, selectedLibrary])
  
  // Always visualize syntax with OE/KI first then KO/KD (Rule 2)
  const orderedSyntax = useMemo(() => {
    const geneLike = librarySyntax.filter(l => l.type === 'overexpression' || l.type === 'knockin')
    const koKd = librarySyntax.filter(l => l.type === 'knockout' || l.type === 'knockdown')
    return [...geneLike, ...koKd]
  }, [librarySyntax])

  // Initialize libraries from props
  useEffect(() => {
    if (props.librarySyntax) {
      setLibraries(props.librarySyntax);
    }
  }, [props.librarySyntax]);

  // Update parent when libraries change
  useEffect(() => {
    if (onLibrariesChange) {
      onLibrariesChange(libraries);
    }
  }, [libraries, onLibrariesChange]);

  const applyCassetteSyntax = (modules: Module[]): Module[] => {
    // 1) Order: all OE/KI ("gene-like") then KO/KD
    const geneLike = modules.filter(m => m.type === 'overexpression' || m.type === 'knockin');
    const koKd = modules.filter(m => m.type === 'knockout' || m.type === 'knockdown');
    const ordered = [...geneLike, ...koKd];

    const result: Module[] = [];
    const lastIdx = ordered.length - 1;
    const firstKoKdIdx = ordered.findIndex(m => m.type === 'knockout' || m.type === 'knockdown');
    const lastKoKdIdx = ordered.length - 1;

    // Handle gene-like libraries (OE vs KI as domains per figures)
    geneLike.forEach((module, localIdx) => {
      if (module.type === 'overexpression') {
        // OE: Intron + OE + T2A (unchanged)
        result.push({ ...HARDCODED_COMPONENTS.intron, id: `intron-${randomUUID()}` } as any);
        result.push({ ...module, id: `${module.id}-${randomUUID()}` });
        result.push({ ...HARDCODED_COMPONENTS.t2a, id: `t2a-${randomUUID()}` } as any);
      } else {
        // KI domain module: Intron + Domain(label) + IS + BC
        result.push({ ...HARDCODED_COMPONENTS.intron, id: `intron-${randomUUID()}` } as any);
        // Label domain explicitly for visualization
        result.push({ ...module, id: `${module.id}-${randomUUID()}`, name: `Domain: ${module.name}` });
        result.push({ ...HARDCODED_COMPONENTS.internalStuffer, id: `is-domain-${randomUUID()}` } as any);
        result.push({ ...HARDCODED_COMPONENTS.barcodes, id: `bc-domain-${randomUUID()}` } as any);
      }
    });

    // Handle KO/KD region according to position rules
    koKd.forEach((module, localIdx) => {
      const globalIdx = geneLike.length + localIdx;
      const isFirstKoKd = localIdx === 0;
      const isLastKoKd = globalIdx === lastIdx;

      if (isFirstKoKd) {
        // STOP-Triplex-Adaptor before first KO/KD
        result.push({ ...HARDCODED_COMPONENTS.stop, id: `stop-${randomUUID()}` } as any);
        result.push({ ...HARDCODED_COMPONENTS.triplex, id: `triplex-${randomUUID()}` } as any);
        result.push({ ...HARDCODED_COMPONENTS.adaptor, id: `adaptor-${randomUUID()}` } as any);
      } else {
        // Internal: Adaptor only before module
        result.push({ ...HARDCODED_COMPONENTS.adaptor, id: `adaptor-${randomUUID()}` } as any);
      }

      // Add the KO/KD module (represents gRNA/shRNA)
      result.push({ ...module, id: `${module.id}-${randomUUID()}` });

      // KO/KD specific tail handled after loop to follow rule 4 & 5 strictly
    });

    // Rule 4 (modified): If no KI domain modules were present, add global IS-BCs tail
    const hadKnockinDomain = geneLike.some(m => m.type === 'knockin');
    if (ordered.length > 0 && !hadKnockinDomain) {
      result.push({ ...HARDCODED_COMPONENTS.internalStuffer, id: `internal-stuffer-end-${randomUUID()}` } as any);
      result.push({ ...HARDCODED_COMPONENTS.barcodes, id: `barcodes-end-${randomUUID()}` } as any);
    }

    // Rule 5: If last module is KO/KD, then add a polyA after IS-BCs
    const lastModule = ordered[ordered.length - 1];
    if (lastModule && (lastModule.type === 'knockout' || lastModule.type === 'knockdown')) {
      result.push({ ...HARDCODED_COMPONENTS.polya, id: `polya-${randomUUID()}` } as any);
    }

    return result;
  };

  const handleManualGenerate = async () => {
    if (!onAddCassettes || isGenerating) return;

    if (librarySyntax.length === 0) {
      toast.error('Please add libraries to the syntax section first');
      return;
    }

    // Initialize loading state
    setIsGenerating(true);
    const loadingToast = toast.loading('Preparing to generate all combinations...');
    
    // Build module lists for each library in the syntax order
    const libraryModuleLists: Module[][] = [];
    for (const libSyntax of librarySyntax) {
      const library = folders.find(f => f.id === libSyntax.id);
      if (!library || !library.modules || library.modules.length === 0) {
        toast.error(`Library '${library?.name || libSyntax.id}' is empty or not found.`);
        setIsGenerating(false);
        toast.dismiss(loadingToast);
        return;
      }
      const libraryModules = customModules.filter(m => library.modules.includes(m.id) && (m.sequence && m.sequence.length > 0));
      if (libraryModules.length === 0) {
        toast.error(`No modules with sequences found for library '${library.name}'.`);
        setIsGenerating(false);
        toast.dismiss(loadingToast);
        return;
      }
      // Map modules to the library's specified type (keep original display name)
      libraryModuleLists.push(
        libraryModules.map((randomModule) => ({
          ...randomModule,
          id: `${randomModule.id}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: libSyntax.type,
          sequence: randomModule.type === libSyntax.type ? randomModule.sequence : '',
          sequenceSource: randomModule.sequenceSource,
          originalType: randomModule.type,
          originalSequence: randomModule.sequence
        }))
      );
    }

    // Compute total combinations
    const totalCombos = libraryModuleLists.reduce((acc, list) => acc * list.length, 1);
    if (!Number.isFinite(totalCombos) || totalCombos <= 0) {
      toast.error('No combinations possible. Please check your libraries.');
      setIsGenerating(false);
      toast.dismiss(loadingToast);
      return;
    }
    const combosToGenerate = totalCombos; // Generate all combinations, stream in chunks
    let produced = 0;
    const CHUNK_SIZE = 50;
    let pendingChunk: Module[][] = [];

    try {
      // Pre-enrich modules if sequence is missing or when library remaps type
      for (let i = 0; i < libraryModuleLists.length; i++) {
        const list = libraryModuleLists[i];
        const enrichedList: Module[] = [];
        for (const mod of list) {
          const modWithOriginal = mod as Module & { originalType?: Module['type'] };
          const needsTypeRemap = !!(modWithOriginal.originalType && modWithOriginal.originalType !== modWithOriginal.type);
          const missingSequence = !modWithOriginal.sequence || modWithOriginal.sequence.length === 0;
          if (needsTypeRemap || missingSequence) {
            try {
              const enriched = await enrichModuleWithSequence({ ...mod }, { enforceTypeSource: true });
              enrichedList.push(enriched);
            } catch (err) {
              console.error(`Failed to enrich ${mod.name}`, err);
              enrichedList.push(mod);
            }
          } else {
            enrichedList.push(mod);
          }
        }
        libraryModuleLists[i] = enrichedList;
      }

      // Fast path: single-library case; just iterate that list
      if (libraryModuleLists.length === 1) {
        const list = libraryModuleLists[0];
        for (let i = 0; i < Math.min(list.length, combosToGenerate); i++) {
          let cassette: Module[] = [];
          try {
            cassette = applyCassetteSyntax([list[i]]);
          } catch (e) {
            console.error('applyCassetteSyntax failed', e);
            cassette = [list[i]];
          }
          pendingChunk.push(cassette);
          produced++;
          if (pendingChunk.length >= CHUNK_SIZE) {
            onAddCassettes?.(pendingChunk);
            pendingChunk = [];
          }
          if (produced % 25 === 0) {
            toast.loading(`Generated ${produced}/${combosToGenerate}...`, { id: loadingToast });
            await new Promise(r => setTimeout(r, 0));
          }
        }
      } else {
        // Iterate combinations using mixed-radix counters to avoid huge intermediate arrays
        const radices = libraryModuleLists.map(list => list.length);
        const indices = new Array(radices.length).fill(0);
        const YIELD_EVERY = 25;

        while (produced < combosToGenerate) {
          // Build the current cassette modules
          const currentModules = indices.map((idx, i) => libraryModuleLists[i][idx]);
          let cassette: Module[] = []
          try {
            cassette = applyCassetteSyntax(currentModules);
          } catch (e) {
            console.error('applyCassetteSyntax failed', e)
            // Fallback: push raw modules if syntax application fails
            cassette = currentModules
          }
          pendingChunk.push(cassette);
          produced++;

          if (pendingChunk.length >= CHUNK_SIZE) {
            onAddCassettes?.(pendingChunk);
            pendingChunk = [];
          }

          if (produced % YIELD_EVERY === 0) {
            toast.loading(`Generated ${produced}/${combosToGenerate}...`, { id: loadingToast });
            await new Promise(r => setTimeout(r, 0));
          }

          // Increment mixed-radix counter
          let pos = indices.length - 1;
          while (pos >= 0) {
            indices[pos]++;
            if (indices[pos] < radices[pos]) break;
            indices[pos] = 0;
            pos--;
          }
          if (pos < 0) break; // Completed all combinations
        }
      }

      // Flush any remaining cassettes
      if (pendingChunk.length > 0) {
        onAddCassettes?.(pendingChunk);
      }

      toast.success(`Successfully generated ${produced} cassettes.`, {
        id: loadingToast,
        duration: 5000
      });
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



  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    
    // Dropped outside the list
    if (!destination) return;
    
    // No change in position
    if (destination.droppableId === source.droppableId && 
        destination.index === source.index) {
      return;
    }

    // Reorder the libraries
    const newLibrarySyntax = Array.from(librarySyntax);
    const [removed] = newLibrarySyntax.splice(source.index, 1);
    newLibrarySyntax.splice(destination.index, 0, removed);
    
    // Update the parent component with the new order
    onReorderLibraries(newLibrarySyntax);
  };

  // Natural language input removed for multi-cassette manual section

  return (
    <div className="space-y-6">
      {/* Natural language input intentionally omitted in multi-cassette manual section */}
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Card className="p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">2. Syntax</h3>
            {isGenerating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                Generating...
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-1 text-sm font-medium">Add Library to Syntax</label>
            <div className="flex gap-2">
                <select
                  value={selectedLibrary}
                  onChange={e => setSelectedLibrary(e.target.value)}
                className="h-9 px-2 flex-1 rounded-md border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {eligibleLibraries.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
              <Button
                size="sm"
                  onClick={() => onAddLibrary(selectedLibrary)}
                  disabled={!selectedLibrary || librarySyntax.find(l => l.id === selectedLibrary) !== undefined}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

          {/* Library Syntax Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Arrange libraries to define cassette syntax</label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={librarySyntax.length === 0}>
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Randomize
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    // TODO: Implement reset functionality
                    console.log('Reset syntax');
                  }}
                  disabled={librarySyntax.length === 0}
                >
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
                      <span className="text-sm text-muted-foreground">
                        Add libraries above or drag them from the module selector to build your cassette syntax
                      </span>
                    ) : (
                      <>
                        {/* Draggable libraries with rule-aware decorations */}
                        {orderedSyntax.map((library, index) => (
                          <Draggable key={library.id} draggableId={library.id} index={index}>
                            {(provided, snapshot) => (
                              <div className="flex items-center gap-2" ref={provided.innerRef} {...provided.draggableProps}>
                                <div
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
                                  {(() => {
                                    const getTypeArrow = (t: string) => t === 'knockdown' ? '↓' : t === 'knockout' ? '✖' : t === 'knockin' ? '→' : '↑';
                                    return `${getTypeArrow(library.type)} ${library.name}`;
                                  })()}
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
                                {/* Draw arrows between libraries */}
                                {index < orderedSyntax.length - 1 && (
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                )}
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
            Generate All Combinations from Library Syntax
          </Button>
        </Card>
      </DragDropContext>
    </div>
  )
  }
