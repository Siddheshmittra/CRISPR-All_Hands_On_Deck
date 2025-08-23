import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import Tippy from '@tippyjs/react';
import { Download, Eye, EyeOff } from "lucide-react"
import { generateGenbank } from "@/lib/genbank"
import { toast } from "sonner"

import { ConstructItem, Module, AnnotatedSegment } from "@/lib/types"
import { SequenceViewer } from "./sequence-viewer"

interface FinalConstructProps {
  constructModules: ConstructItem[]
  barcodeMode?: 'internal' | 'general'
  onBarcodeModeChange?: (mode: 'internal' | 'general') => void
  requestGenerateBarcode?: () => string
  isBarcodeTaken?: (barcode: string) => boolean
}

const T2A_SEQUENCE = "GAAGGAAGAGGAAGCCTTCTCACATGCGGAGATGTGGAAGAGAATCCTGGACCA"
const STOP_TAMPLEX_SEQUENCE = "TGA"
const POLYA_SEQUENCE = "caccgggtcttcaacttgtttattgcagcttataatggttacaaataaagcaatagcatcacaaatttcacaaataaagcatttttttcactgcattctagttgtggtttgtccaaactcatcaatgtatcttatcatgtctggaagacctgtttacc"



export const FinalConstruct = ({ constructModules, barcodeMode = 'internal', onBarcodeModeChange, requestGenerateBarcode, isBarcodeTaken }: FinalConstructProps) => {
  const [constructName, setConstructName] = useState("")
  const [isNameEdited, setIsNameEdited] = useState(false)
  const [barcode, setBarcode] = useState("")
  const [barcodeError, setBarcodeError] = useState("")
  const [showSequence, setShowSequence] = useState(true)
  const [barcodeIndex, setBarcodeIndex] = useState<number | null>(null)
  const [integratedSegments, setIntegratedSegments] = useState<AnnotatedSegment[] | null>(null)

  const generateAnnotatedSequence = (): AnnotatedSegment[] => {
    const segments: AnnotatedSegment[] = [];

    // The incoming construct already contains any required linkers
    // (Intron, T2A, STOP/Triplex/Adaptor, Internal Stuffer, Barcodes, polyA).
    // Just mirror them as annotated segments without injecting extras here.
    constructModules.forEach((item) => {
      const isLinker = item.type === 'linker';
      segments.push({
        name: isLinker ? item.name : `${item.name} [${(item as Module).type}]`,
        sequence: item.sequence || "",
        type: isLinker ? 'linker' : 'module',
        action: isLinker ? undefined : (item as Module).type,
      });
    });

    return segments;
  };

  const fullSequence = generateAnnotatedSequence().map(s => s.sequence).join('');

  // Integrate chosen barcode into the Barcodes segment of the construct sequence preview
  const integrateBarcodeIntoSegments = (segments: AnnotatedSegment[], bc: string): AnnotatedSegment[] => {
    if (!bc || !/^[ACGT]+$/i.test(bc)) return segments;
    const bcUpper = bc.toUpperCase();
    return segments.map(seg => {
      if (seg.name === 'Barcodes') {
        const placeholder = seg.sequence || '';
        const nMatch = placeholder.match(/^N+/i);
        if (!nMatch) return seg;
        const nRunLen = nMatch[0].length;
        const tail = placeholder.slice(nRunLen);
        const tailUpper = tail.toUpperCase();
        const endsWithAGCG = bcUpper.endsWith('AGCG');
        const adjustedTail = endsWithAGCG && tailUpper.startsWith('AGCG')
          ? tail.slice(4)
          : tail;
        const result = bcUpper + adjustedTail;
        return { ...seg, sequence: result };
      }
      return seg;
    });
  }


  const modules = useMemo(() => (
    constructModules.filter(item => item.type !== 'linker') as Module[]
  ), [constructModules])

  // Derive a sensible default name from current modules and their perturbation types
  useEffect(() => {
    if (isNameEdited) return
    if (modules.length === 0) {
      setConstructName("")
      return
    }
    const typeAbbrev: Record<Module['type'], string> = {
      overexpression: 'OE',
      knockout: 'KO',
      knockdown: 'KD',
      knockin: 'KI',
      synthetic: 'KI',
      hardcoded: ''
    }
    // Keep current order of modules (already arranged elsewhere if needed)
    const parts = modules.map(m => `${typeAbbrev[m.type] || ''}_${m.name}`.replace(/^_/, ''))
    const autoName = parts.filter(Boolean).join('+')
    setConstructName(autoName)
  }, [modules, isNameEdited])

  // Auto-populate barcode when a construct exists and barcode is empty
  useEffect(() => {
    if (modules.length > 0 && !barcode && requestGenerateBarcode) {
      const payload = requestGenerateBarcode()
      const parts = payload.split('|')
      if (parts.length === 2 && /^[0-9]+$/.test(parts[0])) {
        setBarcodeIndex(Number(parts[0]))
        setBarcode(parts[1].toUpperCase())
      } else {
        setBarcodeIndex(null)
        setBarcode(payload.toUpperCase())
      }
      setBarcodeError("")
    }
  }, [modules.length, barcode, requestGenerateBarcode])

  // Auto-integrate barcode into sequence when barcode or modules change
  useEffect(() => {
    const segments = generateAnnotatedSequence()
    if (barcode && /^[ACGT]+$/i.test(barcode)) {
      const integrated = integrateBarcodeIntoSegments(segments, barcode)
      setIntegratedSegments(integrated)
    } else {
      setIntegratedSegments(null)
    }
  }, [barcode, constructModules])

  // Generate predicted function
  const generatePredictedFunction = () => {
    if (modules.length === 0) return "No modules selected"
    
    const overexpression = modules.filter(m => m.type === "overexpression")
    const knockout = modules.filter(m => m.type === "knockout")
    const knockdown = modules.filter(m => m.type === "knockdown")
    
    let prediction = "Modulates epigenetic regulation. Enhances TCR signaling strength"
    
    if (overexpression.length > 0) {
      prediction += ` through overexpression of ${overexpression.map(m => m.name).join(", ")}`
    }
    if (knockout.length > 0) {
      prediction += `${overexpression.length > 0 ? " and" : ""} knockout of ${knockout.map(m => m.name).join(", ")}`
    }
    if (knockdown.length > 0) {
      prediction += `${(overexpression.length > 0 || knockout.length > 0) ? " and" : ""} knockdown of ${knockdown.map(m => m.name).join(", ")}`
    }
    
    return prediction + "."
  }
  
  const handleExport = () => {
    if (modules.length === 0) {
      toast.error("No modules to export")
      return
    }
    if (!barcode || /^N+$/i.test(barcode)) {
      toast.info("Warning: Barcode appears to be a placeholder (N's)")
    }
    
    const exportData = {
      name: constructName,
      modules: modules.map(m => ({ ...m, label: `${m.name} [${m.type}]` })),
      details: {
        barcode,
        cassetteCount: constructModules.length
      },
      sequence: fullSequence,
      predictedFunction: generatePredictedFunction()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${constructName || 'construct'}.json`
    a.click()
    
    toast.success("Construct exported successfully!")
  }

  const handleExportGenBank = () => {
    if (modules.length === 0) {
      toast.error("No modules to export")
      return
    }
    if (!barcode || /^N+$/i.test(barcode)) {
      toast.info("Warning: Barcode appears to be a placeholder (N's)")
    }

    const gb = generateGenbank(
      constructName || 'CONSTRUCT',
      generateAnnotatedSequence(),
      { predictedFunction: generatePredictedFunction() }
    )
    const blob = new Blob([gb], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${constructName || 'construct'}.gb`
    a.click()
    URL.revokeObjectURL(url)

    toast.success("GenBank file exported successfully!")
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">4. DNA Sequence</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowSequence(!showSequence)}
          >
            {showSequence ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showSequence ? "Hide" : "Show"} Nucleotide Sequence
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={handleExportGenBank}>
            <Download className="h-4 w-4 mr-2" />
            Export GenBank
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Barcode Mode</Label>
            <select
              value={barcodeMode}
              onChange={(e) => onBarcodeModeChange?.(e.target.value as 'internal' | 'general')}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="internal">Internal (Roth lab)</option>
              <option value="general">General</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (requestGenerateBarcode) {
                const payload = requestGenerateBarcode()
                // Accept optional tagging: "index|sequence"
                const parts = payload.split('|')
                if (parts.length === 2 && /^[0-9]+$/.test(parts[0])) {
                  setBarcodeIndex(Number(parts[0]))
                  setBarcode(parts[1])
                } else {
                  setBarcodeIndex(null)
                  setBarcode(payload)
                }
                setBarcodeError("")
              }
            }}
          >
            Choose Barcode
          </Button>
        </div>
        <div>
          <Label htmlFor="construct-name">Construct Name:</Label>
          <Input
            id="construct-name"
            placeholder="e.g. KO_TET2+KO_DOK"
            value={constructName}
            onChange={(e) => { setIsNameEdited(true); setConstructName(e.target.value) }}
          />
        </div>

        <div>
          <Label htmlFor="barcode">Barcode:</Label>
          <div className="flex items-center gap-2">
            <Input
              id="barcode"
              value={barcode}
              onChange={(e) => {
                const v = e.target.value.trim().toUpperCase()
                setBarcode(v)
                if (barcodeMode === 'internal' && isBarcodeTaken && v) {
                  if (isBarcodeTaken(v)) setBarcodeError('Barcode already in use (Internal mode)')
                  else setBarcodeError('')
                } else {
                  setBarcodeError('')
                }
              }}
            />
            {barcodeIndex != null && (
              <span className="px-2 py-1 rounded-md border border-border bg-muted text-xs font-mono">#{barcodeIndex}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const integrated = integrateBarcodeIntoSegments(generateAnnotatedSequence(), barcode)
                setIntegratedSegments(integrated)
                toast.success('Integrated barcode into sequence preview')
              }}
            >
              Integrate
            </Button>
          </div>
          {barcodeError && (
            <p className="text-xs text-red-500 mt-1">{barcodeError}</p>
          )}
        </div>

        {showSequence && (
          <div className="space-y-4">
            <Label>Concatenated Nucleotide Sequence:</Label>
            <SequenceViewer segments={integratedSegments ?? generateAnnotatedSequence()} />
          </div>
        )}
      </div>
    </Card>
  )
}
