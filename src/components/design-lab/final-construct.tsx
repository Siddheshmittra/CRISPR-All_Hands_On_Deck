import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Tippy from '@tippyjs/react';
import { Download, Eye, EyeOff } from "lucide-react"
import { generateGenbank } from "@/lib/genbank"
import { toast } from "sonner"

import { ConstructItem, Module, AnnotatedSegment } from "@/lib/types"
import { SequenceViewer } from "./sequence-viewer"

interface FinalConstructProps {
  constructModules: ConstructItem[]
}

const T2A_SEQUENCE = "GAGGGCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCCAGGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCAGAGGCT"
const STOP_TAMPLEX_SEQUENCE = "TAATAA" 
const POLYA_SEQUENCE = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"



export const FinalConstruct = ({ constructModules }: FinalConstructProps) => {
  const [constructName, setConstructName] = useState("")
  const [promoter, setPromoter] = useState("EF1a")
  const [leftArm, setLeftArm] = useState("e.g. TRAC upstream")
  const [rightArm, setRightArm] = useState("e.g. TRAC downstream")
  const [barcode, setBarcode] = useState("e.g. Unique 10-20bp")
  const [polyASignal, setPolyASignal] = useState("bGH")
  const [showSequence, setShowSequence] = useState(true)

  const generateAnnotatedSequence = (): AnnotatedSegment[] => {
    const segments: AnnotatedSegment[] = [];
    
    constructModules.forEach((item, index) => {
      const isLinker = item.type === 'linker';
      segments.push({
        name: item.name,
        sequence: item.sequence || "",
        type: isLinker ? 'linker' : 'module',
        action: isLinker ? undefined : item.type
      });
      
      const nextItem = constructModules[index + 1];
      if (item.type !== 'linker' && nextItem && nextItem.type !== 'linker') {
        segments.push({ name: 'T2A', sequence: T2A_SEQUENCE, type: 'hardcoded' });
      }
    });

    // Add Stop/PolyA at the end
    segments.push({ name: 'Stop/PolyA', sequence: STOP_TAMPLEX_SEQUENCE + POLYA_SEQUENCE, type: 'hardcoded' });

    return segments;
  };

  const fullSequence = generateAnnotatedSequence().map(s => s.sequence).join('');


  const modules = constructModules.filter(item => item.type !== 'linker') as Module[]

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
    
    const exportData = {
      name: constructName,
      modules: modules,
      details: {
        promoter,
        leftArm,
        rightArm,
        barcode,
        polyASignal
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
        <h2 className="text-lg font-semibold">4. Final Construct</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowSequence(!showSequence)}
          >
            {showSequence ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showSequence ? "Hide" : "Show"} Sequence
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
        <div>
          <Label htmlFor="construct-name">Construct Name:</Label>
          <Input
            id="construct-name"
            placeholder="e.g. KO_TET2+KO_DOK"
            value={constructName}
            onChange={(e) => setConstructName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="promoter">Promoter:</Label>
            <Select value={promoter} onValueChange={setPromoter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EF1a">EF1a</SelectItem>
                <SelectItem value="CMV">CMV</SelectItem>
                <SelectItem value="PGK">PGK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="polya">PolyA Signal:</Label>
            <Select value={polyASignal} onValueChange={setPolyASignal}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bGH">bGH</SelectItem>
                <SelectItem value="SV40">SV40</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="left-arm">Left Homology Arm:</Label>
            <Input
              id="left-arm"
              value={leftArm}
              onChange={(e) => setLeftArm(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="right-arm">Right Homology Arm:</Label>
            <Input
              id="right-arm"
              value={rightArm}
              onChange={(e) => setRightArm(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="barcode">Barcode:</Label>
          <Input
            id="barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">Predicted Function:</h3>
          <p className="text-sm">{generatePredictedFunction()}</p>
        </div>

        {showSequence && (
          <div className="space-y-4">
            <Label>Nucleotide Sequence:</Label>
            
            <SequenceViewer segments={generateAnnotatedSequence()} />
          </div>
        )}
      </div>
    </Card>
  )
}
