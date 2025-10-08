import { useState, useMemo, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, ArrowRight, X, GripVertical } from "lucide-react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { toast } from "sonner"
import { Module, LibrarySyntax, LibrarySyntaxAddOptions } from "@/lib/types"
import { enrichModuleWithSequence } from "@/lib/ensembl"
import { randomUUID } from "@/lib/uuid"
import { AnimatedSyntaxHeading } from "@/components/ui/animated-syntax-heading"
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
  onAddLibrary: (libraryId: string, options?: LibrarySyntaxAddOptions) => void;
  onRemoveLibrary: (libraryId: string) => void;
  onLibraryTypeChange: (libraryId: string, type: 'overexpression' | 'knockout' | 'knockdown' | 'knockin') => void;
  onReorderLibraries: (newOrder: LibrarySyntax[]) => void;
  onLibrariesChange?: (libraries: LibrarySyntax[]) => void;
  // No global module injection; constants are handled as virtual libraries
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
    onLibrariesChange,
    globalModule
  } = props;
  const [selectedLibrary, setSelectedLibrary] = useState<string>('total-library')
  const [isGenerating, setIsGenerating] = useState(false)
  const [libraries, setLibraries] = useState<LibrarySyntax[]>([])
  
  // Filter libraries: hide 'total-library' if it mixes perturbation types; include Constants as virtual per-module entries
  const eligibleLibraries = useMemo(() => {
    const CONSTANTS_FOLDER_ID = 'constants-library'
    const result = folders.filter(folder => {
      if (folder.id === CONSTANTS_FOLDER_ID) return false
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
  
  // Normalize syntax entries to ensure mode is always defined
  const normalizedSyntax = useMemo(() => {
    return librarySyntax.map(item => item.mode ? item : { ...item, mode: 'variable' });
  }, [librarySyntax]);

  const constantSyntax = useMemo(() => normalizedSyntax.filter(item => item.mode === 'constant'), [normalizedSyntax]);
  const variableSyntax = useMemo(() => normalizedSyntax.filter(item => item.mode !== 'constant'), [normalizedSyntax]);
  const generationOrder = useMemo(() => [...constantSyntax, ...variableSyntax], [constantSyntax, variableSyntax]);

  // If legacy syntax entries lack a mode, promote them to parent state once
  useEffect(() => {
    const missingPlacement = librarySyntax.some(item => !item.mode);
    if (missingPlacement) {
      onReorderLibraries(normalizedSyntax);
    }
  }, [librarySyntax, normalizedSyntax, onReorderLibraries]);

  // Group counts for UI separators in preview
  const geneLikeCount = useMemo(
    () => generationOrder.filter(l => l.type === 'overexpression' || l.type === 'knockin').length,
    [generationOrder]
  );
  const koKdCount = generationOrder.length - geneLikeCount;

  // Quick lookup for module counts per library (folder)
  const getFolderCount = (libraryId: string) => {
    if (libraryId.startsWith('const-lib-')) {
      return 1;
    }
    const actualId = libraryId.startsWith('lib:') ? libraryId.split(':')[1] : libraryId;
    const folder = folders.find(f => f.id === actualId);
    return folder?.modules?.length || 0;
  }

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

    if (generationOrder.length === 0) {
      toast.error('Please add libraries to the syntax section first');
      return;
    }

    // Initialize loading state
    setIsGenerating(true);
    const loadingToast = toast.loading('Preparing to generate all combinations...');
    
      // Build module lists for each library in the syntax order
    const libraryModuleLists: Module[][] = [];
    for (const libSyntax of generationOrder) {
        // Handle virtual constant library entries: id starts with 'const-lib-<moduleId>'
        if (libSyntax.id.startsWith('const-lib-')) {
          const moduleId = libSyntax.id.replace('const-lib-', '')
          const m = customModules.find(mm => mm.id === moduleId)
          if (!m) {
            toast.error(`Constant '${libSyntax.name}' not found.`)
            setIsGenerating(false); toast.dismiss(loadingToast); return;
          }
          libraryModuleLists.push([
            {
              ...m,
              id: `${m.id}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
              type: libSyntax.type,
              sequence: m.type === libSyntax.type ? m.sequence : '',
              sequenceSource: m.sequenceSource,
              originalType: m.type,
              originalSequence: m.sequence,
            } as any
          ])
          continue
        }

        const actualFolderId = libSyntax.id.startsWith('lib:') ? libSyntax.id.split(':')[1] : libSyntax.id
        const library = folders.find(f => f.id === actualFolderId);
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
      // Pre-enrich modules using batched, best-effort enrichment for speed
      for (let i = 0; i < libraryModuleLists.length; i++) {
        const list = libraryModuleLists[i];
        try {
          const { batchEnrichModulesBestEffort } = await import('@/lib/ensembl');
          const enriched = await batchEnrichModulesBestEffort(list, { enforceTypeSource: true, concurrency: 8 });
          libraryModuleLists[i] = enriched;
        } catch (err) {
          // Fallback: keep originals if batch fails
          console.error('Batch enrichment failed, using original list', err);
          libraryModuleLists[i] = list;
        }
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
          if (globalModule) {
            const exists = cassette.some(m => m.id === globalModule.id)
            if (!exists) {
              if (globalModule.type === 'knockin') {
                cassette = [
                  { ...HARDCODED_COMPONENTS.intron, id: `intron-${randomUUID()}` } as any,
                  { ...globalModule, id: `${globalModule.id}-${randomUUID()}`, name: globalModule.name },
                  { ...HARDCODED_COMPONENTS.internalStuffer, id: `is-domain-${randomUUID()}` } as any,
                  { ...HARDCODED_COMPONENTS.barcodes, id: `bc-domain-${randomUUID()}` } as any,
                  ...cassette,
                ]
              } else {
                cassette = [
                  { ...HARDCODED_COMPONENTS.intron, id: `intron-${randomUUID()}` } as any,
                  { ...globalModule, id: `${globalModule.id}-${randomUUID()}` },
                  { ...HARDCODED_COMPONENTS.t2a, id: `t2a-${randomUUID()}` } as any,
                  ...cassette,
                ]
              }
            }
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
          if (globalModule) {
            const exists = cassette.some(m => m.id === globalModule.id)
            if (!exists) {
              if (globalModule.type === 'knockin') {
                cassette = [
                  { ...HARDCODED_COMPONENTS.intron, id: `intron-${randomUUID()}` } as any,
                  { ...globalModule, id: `${globalModule.id}-${randomUUID()}`, name: globalModule.name },
                  { ...HARDCODED_COMPONENTS.internalStuffer, id: `is-domain-${randomUUID()}` } as any,
                  { ...HARDCODED_COMPONENTS.barcodes, id: `bc-domain-${randomUUID()}` } as any,
                  ...cassette,
                ]
              } else {
                cassette = [
                  { ...HARDCODED_COMPONENTS.intron, id: `intron-${randomUUID()}` } as any,
                  { ...globalModule, id: `${globalModule.id}-${randomUUID()}` },
                  { ...HARDCODED_COMPONENTS.t2a, id: `t2a-${randomUUID()}` } as any,
                  ...cassette,
                ]
              }
            }
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



  type DroppableKey = 'constants-syntax' | 'variables-syntax';

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    if (!destination) return;
    try { window.dispatchEvent(new CustomEvent('syntax:shuffle')) } catch {}

    const droppableIds: DroppableKey[] = ['constants-syntax', 'variables-syntax'];
    const sourceKey = source.droppableId as DroppableKey;
    const destKey = destination.droppableId as DroppableKey;

    if (!droppableIds.includes(sourceKey) || !droppableIds.includes(destKey)) {
      return;
    }

    if (sourceKey === destKey && source.index === destination.index) {
      return;
    }

    const lists: Record<DroppableKey, LibrarySyntax[]> = {
      'constants-syntax': [...constantSyntax],
      'variables-syntax': [...variableSyntax],
    };

    const moving = lists[sourceKey][source.index];
    if (!moving) return;

    if (destKey === 'constants-syntax' && !moving.id.startsWith('const-lib-')) {
      toast.error('Only single-gene entries can be pinned as constants.');
      return;
    }

    lists[sourceKey].splice(source.index, 1);

    const updatedItem: LibrarySyntax = {
      ...moving,
      mode: destKey === 'constants-syntax' ? 'constant' : 'variable',
    };

    lists[destKey].splice(destination.index, 0, updatedItem);

    const recombined = [...lists['constants-syntax'], ...lists['variables-syntax']];

    // Validate syntax rules: OE/KI must precede KO/KD in the combined order
    const isGeneLike = (type: string) => type === 'overexpression' || type === 'knockin';
    const isKoKd = (type: string) => type === 'knockout' || type === 'knockdown';

    let foundKoKd = false;
    for (const entry of recombined) {
      if (isKoKd(entry.type)) {
        foundKoKd = true;
      } else if (isGeneLike(entry.type) && foundKoKd) {
        toast.error('Syntax rule: Overexpression/Knock-in libraries must come before Knockout/Knockdown libraries.');
        return;
      }
    }

    onReorderLibraries(recombined);
  };

  const getTypeClasses = (type: LibrarySyntax['type']) => {
    if (type === 'overexpression') return 'bg-overexpression text-overexpression-foreground border-overexpression/30';
    if (type === 'knockout') return 'bg-knockout text-knockout-foreground border-knockout/30';
    if (type === 'knockdown') return 'bg-knockdown text-knockdown-foreground border-knockdown/30';
    return 'bg-card text-card-foreground border-border';
  };

  const getTypeIcon = (type: LibrarySyntax['type']) => {
    if (type === 'knockdown') return '↓';
    if (type === 'knockout') return '✖';
    if (type === 'knockin') return '→';
    return '↑';
  };

  const renderSyntaxDraggable = (library: LibrarySyntax, index: number) => (
    <Draggable key={library.id} draggableId={library.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="flex items-center gap-2"
        >
          <div
            {...provided.dragHandleProps}
            className="h-6 w-6 flex items-center justify-center rounded bg-muted/60 text-muted-foreground"
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all border ${
              snapshot.isDragging ? 'shadow-lg rotate-1' : 'hover:shadow-md'
            } ${getTypeClasses(library.type)}`}
          >
            <span className="opacity-80 text-base">{getTypeIcon(library.type)}</span>
            <div className="flex flex-col min-w-[160px] max-w-[200px]">
              <span className="truncate" title={library.name}>{library.name}</span>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                {library.mode === 'constant' ? 'Constant' : 'Variable'} • {getFolderCount(library.id)} {getFolderCount(library.id) === 1 ? 'module' : 'modules'}
              </span>
            </div>
            <Select
              value={library.type}
              onValueChange={(v) =>
                onLibraryTypeChange(
                  library.id,
                  v as 'overexpression' | 'knockout' | 'knockdown' | 'knockin'
                )
              }
            >
              <SelectTrigger className="h-7 w-[8.5rem] bg-background/60 text-foreground border-border">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overexpression">Overexpression</SelectItem>
                <SelectItem value="knockin">Knockin</SelectItem>
                <SelectItem value="knockout">Knockout</SelectItem>
                <SelectItem value="knockdown">Knockdown</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveLibrary(library.id);
              }}
              className="ml-1 h-6 w-6 p-0 opacity-80 hover:opacity-100"
              title="Remove from syntax"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Draggable>
  );

  const renderConstructPreview = () => {
    if (generationOrder.length === 0) {
      return (
        <span className="text-sm text-muted-foreground">
          Add constants and variable libraries above to define the multi-construct syntax.
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {generationOrder.map((library, index) => (
          <div key={`preview-${library.id}`} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border ${getTypeClasses(library.type)}`}>
              <span className="opacity-80 text-base">{getTypeIcon(library.type)}</span>
              <div className="flex flex-col min-w-[140px] max-w-[180px]">
                <span className="truncate" title={library.name}>{library.name}</span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                  {library.mode === 'constant' ? 'Constant' : 'Variable'} • {getFolderCount(library.id)} {getFolderCount(library.id) === 1 ? 'module' : 'modules'}
                </span>
              </div>
            </div>
            {index === geneLikeCount - 1 && koKdCount > 0 ? (
              <div className="flex items-center gap-2 px-2">
                <span className="text-xs text-muted-foreground">STOP</span>
                <span className="text-xs text-muted-foreground">▸</span>
                <span className="text-xs text-muted-foreground">Triplex</span>
                <span className="text-xs text-muted-foreground">▸</span>
                <span className="text-xs text-muted-foreground">Adaptor</span>
                {index < generationOrder.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ) : index < generationOrder.length - 1 ? (
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Card className="p-6 mb-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <AnimatedSyntaxHeading className="text-xl font-bold text-gray-900 dark:text-white" />
            {isGenerating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                Generating...
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div>
              <label className="block mb-1 text-sm font-medium">Add Library or Constant Gene to Syntax</label>
              <div className="flex gap-2">
                <select
                  value={selectedLibrary}
                  onChange={e => setSelectedLibrary(e.target.value)}
                  className="h-9 px-2 flex-1 rounded-md border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {eligibleLibraries.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                  {(() => {
                    // Show all single modules that can be added as constants
                    // First, show modules from constants folder
                    const constantsFolder = folders.find(f => f.id === 'constants-library');
                    const constantsModules = constantsFolder ? constantsFolder.modules.map((mid: string) => {
                      const mod = customModules.find(m => m.id === mid);
                      if (!mod) return null;
                      const virtualId = `const:${mod.id}`;
                      return <option key={virtualId} value={virtualId}>{`Constant: ${mod.name}`}</option>;
                    }) : [];
                    
                    // Then show all other single modules that aren't already in syntax
                    const usedModuleIds = new Set(normalizedSyntax.filter(l => l.id.startsWith('const-lib-')).map(l => l.id.replace('const-lib-', '')));
                    const otherModules = customModules
                      .filter(mod => !usedModuleIds.has(mod.id) && !normalizedSyntax.some(l => l.id.startsWith('const-lib-') && l.id.endsWith(mod.id)))
                      .map(mod => {
                        const virtualId = `const:${mod.id}`;
                        return <option key={virtualId} value={virtualId}>{`Constant: ${mod.name}`}</option>;
                      });
                    
                    // Debug logging
                    console.log('Available modules for constants:', customModules.map(m => ({ id: m.id, name: m.name })));
                    console.log('Constants folder modules:', constantsFolder?.modules);
                    console.log('Used module IDs:', Array.from(usedModuleIds));
                    
                    return [...constantsModules, ...otherModules];
                  })()}
                </select>
                <Button
                  size="sm"
                  onClick={() => {
                    console.log('Add button clicked, selectedLibrary:', selectedLibrary);
                    if (selectedLibrary.startsWith('const:')) {
                      const moduleId = selectedLibrary.replace('const:', '');
                      console.log('Adding constant, moduleId:', moduleId);
                      const mod = customModules.find(m => m.id === moduleId);
                      console.log('Found module:', mod);
                      if (!mod) {
                        console.error('Module not found:', moduleId);
                        toast.error('Module not found');
                        return;
                      }
                      const virtualLibId = `const-lib-${moduleId}`;
                      if (normalizedSyntax.some(l => l.id === virtualLibId)) {
                        toast.message('Constant already added.');
                        return;
                      }
                      const newItem: LibrarySyntax = {
                        id: virtualLibId,
                        name: `Const: ${mod.name}`,
                        type: (mod.type as LibrarySyntax['type']) || 'overexpression',
                        mode: 'constant',
                      };
                      console.log('Adding new constant item:', newItem);
                      const merged = [...normalizedSyntax, newItem];
                      const regrouped = [
                        ...merged.filter(entry => entry.mode === 'constant'),
                        ...merged.filter(entry => entry.mode !== 'constant'),
                      ];
                      onReorderLibraries(regrouped);
                      toast.success(`Added ${mod.name} as constant`);
                      return;
                    }
                    onAddLibrary(selectedLibrary);
                  }}
                  disabled={!selectedLibrary}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 md:items-end md:text-right">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Constants: {constantSyntax.length} • Variable slots: {variableSyntax.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={variableSyntax.length <= 1}
                  onClick={() => {
                    const shuffle = <T,>(arr: T[]) => {
                      const copy = [...arr];
                      for (let i = copy.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [copy[i], copy[j]] = [copy[j], copy[i]];
                      }
                      return copy;
                    };
                    const randomized = shuffle(variableSyntax);
                    onReorderLibraries([
                      ...constantSyntax,
                      ...randomized,
                    ]);
                  }}
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Randomize Variables
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReorderLibraries([])}
                  disabled={generationOrder.length === 0}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <section>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Constants (fixed across every construct)</label>
                <span className="text-xs text-muted-foreground">Drag to reorder</span>
              </div>
              <Droppable droppableId="constants-syntax" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex flex-wrap gap-2 min-h-[72px] rounded-md border border-dashed p-3 transition-all ${
                      snapshot.isDraggingOver ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    {constantSyntax.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Select single-gene entries from the Constants folder to lock them into every construct.
                      </span>
                    ) : (
                      constantSyntax.map((library, index) => renderSyntaxDraggable(library, index))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Variable Libraries (combinatorial slots)</label>
                <span className="text-xs text-muted-foreground">Drag to reorder and mix library types</span>
              </div>
              <Droppable droppableId="variables-syntax" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex flex-wrap gap-2 min-h-[96px] rounded-md border border-dashed p-3 transition-all ${
                      snapshot.isDraggingOver ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    {variableSyntax.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Add libraries to explore combinatorial diversity. Mix knock-outs, knock-downs, knock-ins, or expression libraries.
                      </span>
                    ) : (
                      variableSyntax.map((library, index) => renderSyntaxDraggable(library, index))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Construct Preview</label>
              <span className="text-xs text-muted-foreground">Constants lead, variables expand the search space</span>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-background p-4">
              {renderConstructPreview()}
            </div>
          </div>

          <Button
            className="mt-6 w-full"
            onClick={handleManualGenerate}
            disabled={generationOrder.length === 0}
          >
            Generate All Combinations from Syntax
          </Button>
        </Card>
      </DragDropContext>
    </div>
  );
}
