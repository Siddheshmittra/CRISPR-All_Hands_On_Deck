import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Download, Edit3, Check, X, GripVertical } from "lucide-react"
import { Module, AnnotatedSegment } from "@/lib/types"
import { SequenceViewer } from "./sequence-viewer"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { enrichModuleWithSequence } from "@/lib/ensembl"

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

const T2A_SEQUENCE = "GAGGGCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCT";
const STOP_TAMPLEX_SEQUENCE = "TAATAA";
const POLYA_SEQUENCE = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export const CassetteBatch = ({ cassetteBatch, onDeleteCassette, onExportBatch, onUpdateCassette }: CassetteBatchProps) => {
  const [editingCassetteId, setEditingCassetteId] = useState<string | null>(null)
  const [editingModules, setEditingModules] = useState<Module[]>([])
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

  const generateAnnotatedSequence = async (rawModules: Module[]): Promise<AnnotatedSegment[]> => {
    // Apply library‐specific cassette syntax rules.
    // 1. Re-order so all OE/KI come before KO/KD
    const early = rawModules.filter(m => m.type === 'overexpression' || m.type === 'knockin');
    const late  = rawModules.filter(m => m.type === 'knockout' || m.type === 'knockdown');
    const ordered = [...early, ...late];

    const segments: AnnotatedSegment[] = [];

    // Determine index of first KO/KD for STOP-Triplex-Adaptor insertion
    const firstKOIdx = ordered.findIndex(m => m.type === 'knockout' || m.type === 'knockdown');

    for (let idx = 0; idx < ordered.length; idx++) {
      const item = ordered[idx];

      // Re-enrich sequence when the stored sequence doesn't match the new type
      let correctSequence = item.sequence || "";
      const needsReEnrichment = (
        (item.type === 'knockout'   && item.sequenceSource !== 'gRNA.json') ||
        (item.type === 'knockdown'  && item.sequenceSource !== 'shRNA.json') ||
        (item.type === 'overexpression' && item.sequenceSource !== 'ensembl_grch38' && item.sequenceSource !== 'ensembl_grch37')
      );
      if (needsReEnrichment) {
        try {
          const enriched = await enrichModuleWithSequence({ ...item, sequence: '', sequenceSource: undefined });
          correctSequence = enriched.sequence || "";
        } catch (err) {
          console.error(`Error re-enriching ${item.name}:`, err);
        }
      }

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