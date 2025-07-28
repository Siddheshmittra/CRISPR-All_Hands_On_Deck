import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { Module } from "@/lib/types"

interface FinalConstructProps {
  constructModules: Module[]
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

  // Generate predicted function
  const generatePredictedFunction = () => {
    if (constructModules.length === 0) return "No modules selected"
    
    const overexpression = constructModules.filter(m => m.type === "overexpression")
    const knockout = constructModules.filter(m => m.type === "knockout")
    const knockdown = constructModules.filter(m => m.type === "knockdown")
    
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
  
  // Generate nucleotide sequence by concatenating module sequences
  const generateSequence = () => {
    if (constructModules.length === 0) return ""

    const sortedModules = [...constructModules].sort((a, b) => {
      if (a.type === 'overexpression' && b.type !== 'overexpression') return -1
      if (a.type !== 'overexpression' && b.type === 'overexpression') return 1
      return 0
    })

    let finalSequence = ""
    let firstKoKdAdded = false
    const koKdModules = sortedModules.filter(m => m.type === 'knockout' || m.type === 'knockdown' || m.type === 'knockin')
    const lastKoKdModule = koKdModules.length > 0 ? koKdModules[koKdModules.length - 1] : null

    sortedModules.forEach(module => {
      finalSequence += module.sequence || ""
      
      if (module.type === 'overexpression') {
        finalSequence += T2A_SEQUENCE
      }
      
      if (module.type === 'knockout' || module.type === 'knockdown' || module.type === 'knockin') {
        if (!firstKoKdAdded) {
          finalSequence = STOP_TAMPLEX_SEQUENCE + finalSequence
          firstKoKdAdded = true
        }
        
        if (lastKoKdModule && module.id === lastKoKdModule.id) {
          finalSequence += POLYA_SEQUENCE
        }
      }
    })

    return finalSequence
  }



  const handleExport = () => {
    if (constructModules.length === 0) {
      toast.error("No modules to export")
      return
    }
    
    const exportData = {
      name: constructName,
      modules: constructModules,
      details: {
        promoter,
        leftArm,
        rightArm,
        barcode,
        polyASignal
      },
      sequence: generateSequence(),
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
          <div>
            <Label htmlFor="sequence">Nucleotide Sequence:</Label>
            <Textarea
              id="sequence"
              value={generateSequence()}
              readOnly
              className="h-32 font-mono text-xs"
            />
          </div>
        )}
      </div>
    </Card>
  )
}