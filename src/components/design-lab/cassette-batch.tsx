import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Download, Edit3, Check, X, GripVertical, ScanBarcode } from "lucide-react"
import { Module, AnnotatedSegment } from "@/lib/types"
import { SequenceViewer } from "./sequence-viewer"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { enrichModuleWithSequence } from "@/lib/ensembl"
import { validateBarcode, generateBarcode } from "@/lib/barcode-utils"

interface Cassette {
  id: string
  modules: Module[]
  barcode?: string
}

interface CassetteBatchProps {
  cassetteBatch: Cassette[]
  onDeleteCassette: (cassetteId: string) => void
  onExportBatch: () => void
  onUpdateCassette?: (cassetteId: string, modules: Module[], barcode?: string) => void
}

const T2A_SEQUENCE = "GAGGGCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCT";
const STOP_TAMPLEX_SEQUENCE = "TAATAA";
const POLYA_SEQUENCE = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export const CassetteBatch = ({ cassetteBatch, onDeleteCassette, onExportBatch, onUpdateCassette }: CassetteBatchProps) => {
  const [editingCassetteId, setEditingCassetteId] = useState<string | null>(null)
  const [editingModules, setEditingModules] = useState<Module[]>([])
  const [editingBarcode, setEditingBarcode] = useState<string>('')
  const [barcodeError, setBarcodeError] = useState<string>('')
  const [expandedCassetteId, setExpandedCassetteId] = useState<string | null>(null);
  const [cassetteSegments, setCassetteSegments] = useState<Record<string, AnnotatedSegment[]>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const CASSETTES_PER_PAGE = 20; // Limit to 20 cassettes per page

  if (cassetteBatch.length === 0) {
    return null
  }

  const handleStartEdit = (cassette: Cassette) => {
    setEditingCassetteId(cassette.id)
    setEditingModules([...cassette.modules])
    setEditingBarcode(cassette.barcode || '')
    setBarcodeError('')
  }

  const handleSaveEdit = () => {
    if (editingBarcode) {
      const validation = validateBarcode(editingBarcode)
      if (!validation.isValid) {
        setBarcodeError(validation.message)
        return
      }
    }
    
    if (editingCassetteId && onUpdateCassette) {
      onUpdateCassette(editingCassetteId, editingModules, editingBarcode)
    }
    setEditingCassetteId(null)
    setEditingModules([])
    setEditingBarcode('')
    setBarcodeError('')
  }

  const handleCancelEdit = () => {
    setEditingCassetteId(null)
    setEditingModules([])
    setEditingBarcode('')
    setBarcodeError('')
  }
  
  const handleGenerateBarcode = () => {
    const existingBarcodes = cassetteBatch
      .map(c => c.barcode)
      .filter((b): b is string => !!b)
    
    // Generate a DNA barcode with default length of 12bp
    const newBarcode = generateBarcode(12, existingBarcodes)
    setEditingBarcode(newBarcode)
    setBarcodeError('')
  }

  const generateAnnotatedSequence = async (rawModules: Module[]): Promise<AnnotatedSegment[]> => {
    // Apply library‐specific cassette syntax rules.
    // 1. Re-order so all OE/KI come before KO/KD
    const early = rawModules.filter(m => m.type === 'overexpression' || m.type === 'knockin');
    const late = rawModules.filter(m => m.type === 'knockout' || m.type === 'knockdown');
    const ordered = [...early, ...late];

    const segments: AnnotatedSegment[] = [];

    // Determine index of first KO/KD for STOP-Triplex-Adaptor insertion
    const firstKOIdx = ordered.findIndex(m => m.type === 'knockout' || m.type === 'knockdown');

    // Process all modules in parallel for better performance
    const processedModules = await Promise.all(ordered.map(async (item, idx) => {
      // Only re-enrich if we don't have a sequence or if the sequence source doesn't match the type
      const needsReEnrichment = !item.sequence || (
        (item.type === 'knockout' && item.sequenceSource !== 'gRNA.json') ||
        (item.type === 'knockdown' && item.sequenceSource !== 'shRNA.json') ||
        (item.type === 'overexpression' && item.sequenceSource !== 'ensembl_grch38' && item.sequenceSource !== 'ensembl_grch37')
      );

      let correctSequence = item.sequence || '';
      
      if (needsReEnrichment) {
        try {
          // Clear sequence and source to force re-enrichment
          const moduleToEnrich = { ...item, sequence: '', sequenceSource: undefined };
          const enriched = await enrichModuleWithSequence(moduleToEnrich);
          correctSequence = enriched.sequence || '';
          
          // Update the module with the new sequence and source
          Object.assign(item, {
            sequence: correctSequence,
            sequenceSource: enriched.sequenceSource
          });
        } catch (err) {
          console.error(`Error re-enriching ${item.name}:`, err);
          // If enrichment fails, use existing sequence if available
          if (!correctSequence && item.originalSequence) {
            correctSequence = item.originalSequence;
          }
        }
      }

      return { ...item, sequence: correctSequence };
    }));

    // Now process the ordered modules with their correct sequences
    for (let idx = 0; idx < processedModules.length; idx++) {
      const item = processedModules[idx];
      const correctSequence = item.sequence;

      // Rule 1: intron before every OE gene
      if (item.type === 'overexpression') {
        segments.push({
          name: 'Intron',
          sequence: 'GTAAGTCTTATTTAGTGGAAAGAATAGATCTTCTGTTCTTTCAAAAGCAGAAATGGCAATAACATTTTGTGCCATGAttttttttttCTGCAG',
          type: 'hardcoded'
        });
      }

      // Rule 3: STOP-Triplex-Adaptor immediately before first KO/KD
      if (idx === firstKOIdx && firstKOIdx !== -1) {
        segments.push({
          name: 'STOP-Triplex-Adaptor',
          sequence: STOP_TAMPLEX_SEQUENCE + 'gaattcgattcgtcagtagggttgtaaaggtttttcttttcctgagaaaacaaccttttgttttctcaggttttgctttttggcctttccctagctttaaaaaaaaaaaagcaaaactcaccgaggcagttccataggatggcaagatcctggtattggtctgcga' + 'GTAA',
          type: 'hardcoded'
        });
      }

      // Actual library module
      segments.push({
        name: item.name,
        sequence: correctSequence,
        type: 'module',
        action: item.type as any,
      });

      // Rule 2: T2A after each OE gene (except last element)
      if (item.type === 'overexpression' && idx !== ordered.length - 1) {
        segments.push({ name: 'T2A', sequence: T2A_SEQUENCE, type: 'hardcoded' });
      }
    }

    // Rule 4: always add Internal Stuffer-Barcode Array after last module
    segments.push({
      name: 'Internal Stuffer-Barcode Array',
      sequence: 'GTAACGAGACCAGTATCAAGCCCGGGCAACAATGTGCGGACGGCGTTGGTCTCTAGCGNNNNNNNNNNNNNAGCG',
      type: 'hardcoded'
    });

    // Rule 5: if last module is KO/KD, add polyA after IS-BCs
    const lastModule = ordered[ordered.length - 1];
    if (lastModule && (lastModule.type === 'knockout' || lastModule.type === 'knockdown')) {
      segments.push({
        name: 'polyA',
        sequence: POLYA_SEQUENCE,
        type: 'hardcoded'
      });
    }

    return segments;
  };

  // Generate segments when a cassette is expanded (with throttling)
  useEffect(() => {
    if (expandedCassetteId) {
      const cassette = cassetteBatch.find(c => c.id === expandedCassetteId);
      if (cassette && !cassetteSegments[expandedCassetteId]) {
        const timeoutId = setTimeout(() => {
          generateAnnotatedSequence(cassette.modules)
            .then(segments => {
              setCassetteSegments(prev => ({
                ...prev,
                [expandedCassetteId]: segments
              }));
            })
            .catch(error => {
              console.error('Error generating sequence segments:', error);
              // Set empty segments to prevent infinite loading
              setCassetteSegments(prev => ({
                ...prev,
                [expandedCassetteId]: []
              }));
            });
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [expandedCassetteId, cassetteBatch, cassetteSegments]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(editingModules)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setEditingModules(items)
  }

  // Calculate pagination
  const totalPages = Math.ceil(cassetteBatch.length / CASSETTES_PER_PAGE)
  const startIndex = (currentPage - 1) * CASSETTES_PER_PAGE
  const endIndex = startIndex + CASSETTES_PER_PAGE
  const currentCassettes = cassetteBatch.slice(startIndex, endIndex)

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Cassette Batch</h2>
          {cassetteBatch.length > CASSETTES_PER_PAGE && (
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, cassetteBatch.length)} of {cassetteBatch.length} cassettes
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onExportBatch}>
          <Download className="h-4 w-4 mr-2" />
          Export Batch
        </Button>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
      
      <div className="space-y-4">
        {currentCassettes.map((cassette, index) => (
          <div key={cassette.id} className="p-4 bg-muted rounded-lg">
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {cassette.modules.length > 0 
                    ? cassette.modules.map(m => m.name || 'Unnamed').join(' + ')
                    : `Cassette ${index + 1}`
                  }
                </div>
                <div className="flex gap-2">
                  {onUpdateCassette && (
                    <Button variant="outline" size="sm" onClick={() => handleStartEdit(cassette)}>
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onDeleteCassette(cassette.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              
              {editingCassetteId === cassette.id ? (
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={editingBarcode}
                        onChange={(e) => {
                          setEditingBarcode(e.target.value)
                          if (barcodeError) setBarcodeError('')
                        }}
                        placeholder="Enter DNA barcode (e.g., ATCGATCGATCG)"
                        className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 ${
                          barcodeError ? 'border-red-500 focus:ring-red-200' : 'focus:ring-primary border-input'
                        }`}
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleGenerateBarcode}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        title="Generate barcode"
                      >
                        <ScanBarcode className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSaveEdit}
                      disabled={!!barcodeError}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {barcodeError && (
                    <p className="text-xs text-red-500 mt-1">{barcodeError}</p>
                  )}
                </div>
              ) : (
                cassette.barcode && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">Barcode:</span>
                    <span className="px-2 py-1 text-sm font-mono bg-muted-foreground/10 rounded">
                      {cassette.barcode}
                    </span>
                  </div>
                )
              )}
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
                              <div>
                <Button variant="link" className="p-0 h-auto" onClick={() => setExpandedCassetteId(expandedCassetteId === cassette.id ? null : cassette.id)}>
                  {expandedCassetteId === cassette.id ? 'Hide' : 'Show'} Sequence
                </Button>
                {expandedCassetteId === cassette.id && (
                  <div className="mt-2">
                    {cassetteSegments[cassette.id] ? (
                      <SequenceViewer segments={cassetteSegments[cassette.id]} />
                    ) : (
                      <div className="text-sm text-muted-foreground">Loading sequence with correct perturbation types...</div>
                    )}
                  </div>
                )}
              </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
} 