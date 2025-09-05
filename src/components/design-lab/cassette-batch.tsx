import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Download, Edit3, Check, X, GripVertical, ScanBarcode, Loader2, Copy } from "lucide-react"
import { toast } from "sonner"
import { Module, AnnotatedSegment } from "@/lib/types"
import { SequenceViewer } from "./sequence-viewer"
import { generateGenbank } from "@/lib/genbank"
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
  barcodeMode?: 'internal' | 'general'
  requestGenerateBarcode?: (cassetteId: string) => string
  isBarcodeTaken?: (barcode: string, cassetteId?: string) => boolean
}

const T2A_SEQUENCE = "GAAGGAAGAGGAAGCCTTCTCACATGCGGAGATGTGGAAGAGAATCCTGGACCA";
const STOP_TAMPLEX_SEQUENCE = "TGA";
const POLYA_SEQUENCE = "caccgggtcttcaacttgtttattgcagcttataatggttacaaataaagcaatagcatcacaaatttcacaaataaagcatttttttcactgcattctagttgtggtttgtccaaactcatcaatgtatcttatcatgtctggaagacctgtttacc";
const TRIPLEX_SEQUENCE = "gaattcgattcgtcagtagggttgtaaaggtttttcttttcctgagaaaacaaccttttgttttctcaggttttgctttttggcctttccctagctttaaaaaaaaaaaagcaaaactcaccgaggcagttccataggatggcaagatcctggtattggtctgcga";
const ADAPTOR_SEQUENCE = "GTAA";

export const CassetteBatch = ({ cassetteBatch, onDeleteCassette, onExportBatch, onUpdateCassette, barcodeMode = 'general', requestGenerateBarcode, isBarcodeTaken }: CassetteBatchProps) => {
  const [editingCassetteId, setEditingCassetteId] = useState<string | null>(null)
  const [editingModules, setEditingModules] = useState<Module[]>([])
  const [editingBarcode, setEditingBarcode] = useState<string>('')
  const [barcodeError, setBarcodeError] = useState<string>('')
  const [expandedCassetteId, setExpandedCassetteId] = useState<string | null>(null);
  const [cassetteSegments, setCassetteSegments] = useState<Record<string, AnnotatedSegment[]>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const CASSETTES_PER_PAGE = 20; // Limit to 20 cassettes per page

  // Do not early-return before all hooks are declared; render guard moved below

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
    if (barcodeMode === 'internal' && editingBarcode) {
      if (isBarcodeTaken && isBarcodeTaken(editingBarcode, editingCassetteId || undefined)) {
        setBarcodeError('Barcode already assigned to another cassette (Internal mode)')
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

  const handleCopySequence = async (cassette: Cassette) => {
    try {
      const segments = await generateAnnotatedSequence(cassette.modules, extractBarcodeSequence(cassette.barcode))
      const sequence = segments.map(s => s.sequence).join('')
      await navigator.clipboard.writeText(sequence)
      toast.success('Nucleotide sequence copied to clipboard')
    } catch (err) {
      console.error('Failed to copy sequence', err)
      toast.error('Failed to copy sequence')
    }
  }

  const handleExportGenbankCassette = async (cassette: Cassette) => {
    try {
      const segments = await generateAnnotatedSequence(cassette.modules, extractBarcodeSequence(cassette.barcode))
      const nameBase = cassette.modules.length > 0 ? cassette.modules.map(m => `${m.name || 'Unnamed'}[${m.type}]`).join('_') : cassette.id
      const gb = generateGenbank((nameBase || 'CASSETTE').toUpperCase(), segments, {})
      const blob = new Blob([gb], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${nameBase || cassette.id}.gb`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        try { document.body.removeChild(link) } catch {}
      }, 1000)
      toast.success('GenBank file exported')
    } catch (err) {
      console.error('Failed to export GenBank', err)
      toast.error('Failed to export GenBank')
    }
  }
  
  const handleGenerateBarcode = () => {
    if (requestGenerateBarcode) {
      const payload = requestGenerateBarcode(editingCassetteId || '')
      const parts = payload.split('|')
      if (parts.length === 2 && /^[0-9]+$/.test(parts[0])) {
        setEditingBarcode(parts[1])
      } else {
        setEditingBarcode(payload)
      }
      setBarcodeError('')
      return
    }
    const existingBarcodes = cassetteBatch
      .map(c => c.barcode)
      .filter((b): b is string => !!b)
    const newBarcode = generateBarcode(12, existingBarcodes)
    setEditingBarcode(newBarcode)
    setBarcodeError('')
  }

  const extractBarcodeSequence = (value?: string): string | undefined => {
    if (!value) return undefined
    if (value.includes('|')) {
      const parts = value.split('|')
      if (parts.length === 2 && /^[0-9]+$/.test(parts[0])) return parts[1]
    }
    return value
  }

  const integrateBarcode = (placeholder: string, bc?: string): string => {
    if (!bc || !/^[ACGT]+$/i.test(bc)) return placeholder
    const bcUpper = bc.toUpperCase()
    const nMatch = placeholder.match(/^N+/i)
    const tail = placeholder.slice(nMatch ? nMatch[0].length : 0)
    const tailUpper = tail.toUpperCase()
    const endsWithAGCG = bcUpper.endsWith('AGCG')
    const adjustedTail = endsWithAGCG && tailUpper.startsWith('AGCG') ? tail.slice(4) : tail
    return bcUpper + adjustedTail
  }

  const generateAnnotatedSequence = async (rawModules: Module[], barcode?: string): Promise<AnnotatedSegment[]> => {
    // Apply library‐specific cassette syntax rules.
    // 1. Re-order so all OE/KI come before KO/KD
    const early = rawModules.filter(m => m.type === 'overexpression' || m.type === 'knockin');
    const late = rawModules.filter(m => m.type === 'knockout' || m.type === 'knockdown');
    const ordered = [...early, ...late];

    const segments: AnnotatedSegment[] = [];

    // Determine index of first KO/KD for STOP-Triplex-Adaptor insertion
    const firstKOIdx = ordered.findIndex(m => m.type === 'knockout' || m.type === 'knockdown');
    const hasKnockinDomain = ordered.some(m => m.type === 'knockin');

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

      // Rule 1: intron before every OE gene and also before KI domain modules
      if (item.type === 'overexpression' || item.type === 'knockin') {
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
      } else if (firstKOIdx !== -1 && idx > firstKOIdx && (item.type === 'knockout' || item.type === 'knockdown')) {
        // Adaptor before subsequent KO/KD modules (after the first)
        segments.push({ name: 'Adaptor', sequence: ADAPTOR_SEQUENCE, type: 'hardcoded' });
      }

      // Actual library module (single explicit perturbation annotation)
      segments.push({
        name: `${item.name} [${(item.type || 'module').toUpperCase()}]`,
        sequence: correctSequence,
        type: 'module',
        action: item.type as any,
      });

      // Rule 2: T2A after each OE gene (except last element)
      if (item.type === 'overexpression' && idx !== ordered.length - 1) {
        segments.push({ name: 'T2A', sequence: T2A_SEQUENCE, type: 'hardcoded' });
      }

      // KI domain specific: add Internal Stuffer + Barcodes after each KI module
      if (item.type === 'knockin') {
        segments.push({
          name: 'Internal Stuffer',
          sequence: 'GTAACGAGACCAGTATCAAGCCCGGGCAACAATGTGCGGACGGCGTTGGTCTCTAGCG',
          type: 'hardcoded'
        });
        segments.push({
          name: 'Barcodes',
          sequence: integrateBarcode('NNNNNNNNNNNAGCG', barcode),
          type: 'hardcoded'
        });
      }
    }

      // Rule 4 (modified): If no KI domain modules present, add global IS + BCs tail
      if (!hasKnockinDomain && ordered.length > 0) {
        segments.push({
          name: 'Internal Stuffer',
          sequence: 'GTAACGAGACCAGTATCAAGCCCGGGCAACAATGTGCGGACGGCGTTGGTCTCTAGCG',
          type: 'hardcoded'
        });
        segments.push({
          name: 'Barcodes',
          sequence: integrateBarcode('NNNNNNNNNNNAGCG', barcode),
          type: 'hardcoded'
        });
      }

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

  const exportBatchAsCSV = async () => {
    try {
      setIsExportingCsv(true)
      // Normalize component labels for stable column keys
      const toKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

      // Expand combined components into discrete ones for columnization
      const explodeSegments = (segments: AnnotatedSegment[]) => {
        const expanded: AnnotatedSegment[] = []
        for (const seg of segments) {
          if (seg.name === 'STOP-Triplex-Adaptor') {
            expanded.push({ name: 'STOP', sequence: STOP_TAMPLEX_SEQUENCE, type: 'hardcoded' })
            expanded.push({ name: 'Triplex', sequence: TRIPLEX_SEQUENCE, type: 'hardcoded' })
            expanded.push({ name: 'Adaptor', sequence: ADAPTOR_SEQUENCE, type: 'hardcoded' })
          } else if (seg.name === 'Internal Stuffer-Barcode Array') {
            // Split into Internal Stuffer + Barcodes
            expanded.push({ name: 'Internal Stuffer', sequence: 'GTAACGAGACCAGTATCAAGCCCGGGCAACAATGTGCGGACGGCGTTGGTCTCTAGCG', type: 'hardcoded' })
            expanded.push({ name: 'Barcodes', sequence: 'NNNNNNNNNNNAGCG', type: 'hardcoded' })
          } else {
            expanded.push(seg)
          }
        }
        return expanded
      }

      // Compute all cassette segments in parallel (preserves cassette order)
      const perCassetteSegments: AnnotatedSegment[][] = await Promise.all(
        cassetteBatch.map(c => generateAnnotatedSequence(c.modules).then(explodeSegments))
      )

      // Derive a global column order that follows the cassette syntax order.
      type Token = { kind: 'component'; key: string; occurrence: number } | { kind: 'module'; index: number }
      const orderedTokens: Token[] = []
      const maxOccurrenceByComponent: Record<string, number> = {}
      let maxModuleIndex = 0

      for (const segments of perCassetteSegments) {
        const localCounts: Record<string, number> = {}
        let localModuleIndex = 0
        for (const seg of segments) {
          if (seg.type === 'module') {
            localModuleIndex += 1
            if (localModuleIndex > maxModuleIndex) {
              orderedTokens.push({ kind: 'module', index: localModuleIndex })
              maxModuleIndex = localModuleIndex
            }
          } else {
            const key = toKey(seg.name)
            localCounts[key] = (localCounts[key] || 0) + 1
            const occ = localCounts[key]
            if (occ > (maxOccurrenceByComponent[key] || 0)) {
              orderedTokens.push({ kind: 'component', key, occurrence: occ })
              maxOccurrenceByComponent[key] = occ
            }
          }
        }
      }

      // Build header: base, tokens (in syntax order), and final_sequence last
      // Include a dedicated barcode column (and optional index if available)
      const baseHeader = ['cassette_id', 'barcode', 'barcode_index', 'modules', 'final_length']
      const header: string[] = [...baseHeader]
      for (const token of orderedTokens) {
        if (token.kind === 'component') header.push(`${token.key}_${token.occurrence}_sequence`)
        else { header.push(`module_${token.index}_name`); header.push(`module_${token.index}_sequence`) }
      }
      header.push('final_sequence')

      const rows: string[] = []
      rows.push(header.join(','))

      const esc = (v: string | null | undefined) => {
        const s = (v ?? '').replace(/"/g, '""')
        return `"${s}"`
      }

      // Compose rows
      for (let idx = 0; idx < cassetteBatch.length; idx++) {
        const cassette = cassetteBatch[idx]
        const segments = perCassetteSegments[idx]
        const finalSeq = segments.map(s => s.sequence).join('')
        const modulesStr = cassette.modules.map(m => `${m.name} [${m.type}]`).join(' + ')
        // Parse barcode index when tagged as INDEX|SEQUENCE; keep sequence in barcode column
        let barcodeValue = cassette.barcode || ''
        let barcodeIndex = ''
        if (barcodeValue && barcodeValue.includes('|')) {
          const parts = barcodeValue.split('|')
          if (parts.length === 2 && /^[0-9]+$/.test(parts[0])) {
            barcodeIndex = parts[0]
            barcodeValue = parts[1]
          }
        }

        // Buckets for components
        const componentBuckets: Record<string, string[]> = {}
        const componentKeys = Object.keys(maxOccurrenceByComponent)
        for (const key of componentKeys) componentBuckets[key] = []

        const moduleNames: string[] = []
        const moduleSeqs: string[] = []

        for (const seg of segments) {
          if (seg.type === 'module') {
            moduleNames.push(seg.name)
            moduleSeqs.push(seg.sequence)
          } else {
            const key = toKey(seg.name)
            if (!componentBuckets[key]) componentBuckets[key] = []
            componentBuckets[key].push(seg.sequence)
          }
        }

        const row: (string | number)[] = [
          esc(cassette.id),
          esc(barcodeValue),
          esc(barcodeIndex),
          esc(modulesStr),
          String(finalSeq.length)
        ]

        for (const token of orderedTokens) {
          if (token.kind === 'component') {
            const arr = componentBuckets[token.key] || []
            row.push(esc(arr[token.occurrence - 1] || ''))
          } else {
            row.push(esc(moduleNames[token.index - 1] || ''))
            row.push(esc(moduleSeqs[token.index - 1] || ''))
          }
        }

        row.push(esc(finalSeq))

        rows.push(row.join(','))
      }

      const csvContent = rows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      link.href = url
      link.download = `cassette-batch_${timestamp}.csv`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      // Delay revocation to avoid canceling download in some browsers
      setTimeout(() => {
        URL.revokeObjectURL(url)
        try { document.body.removeChild(link) } catch {}
      }, 1000)
      toast.success(`Exported ${cassetteBatch.length} cassettes as CSV`)
    } catch (err) {
      console.error('Failed to export CSV', err)
      toast.error('Failed to export CSV')
    } finally {
      setIsExportingCsv(false)
    }
  }

  if (cassetteBatch.length === 0) {
    return null
  }

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">3. Encoding</h2>
          {cassetteBatch.length > CASSETTES_PER_PAGE && (
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, cassetteBatch.length)} of {cassetteBatch.length} cassettes
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExportBatch}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={exportBatchAsCSV} disabled={isExportingCsv}>
            {isExportingCsv ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting CSV...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </>
            )}
          </Button>
        </div>
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
                  <Button variant="outline" size="sm" onClick={() => handleExportGenbankCassette(cassette)} title="Export GenBank">
                    <Download className="h-4 w-4 mr-1" />
                    Export GenBank
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCopySequence(cassette)} title="Copy full nucleotide sequence">
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
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
                  {expandedCassetteId === cassette.id ? 'Hide' : 'Show'} Final Construct Sequence
                </Button>
                {expandedCassetteId === cassette.id && (
                  <div className="mt-2">
                    {cassetteSegments[cassette.id] ? (
                      <SequenceViewer segments={cassetteSegments[cassette.id].map(seg => seg.name === 'Barcodes' ? { ...seg, sequence: integrateBarcode(seg.sequence, extractBarcodeSequence(cassette.barcode)) } : seg)} />
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