import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Search, Sparkles } from "lucide-react"

interface Module {
  id: string
  name: string
  type: "overexpression" | "knockout" | "knockdown"
  description?: string
}

interface NaturalLanguageModeProps {
  onSuggestedConstruct: (modules: Module[]) => void
}

export const NaturalLanguageMode = ({ onSuggestedConstruct }: NaturalLanguageModeProps) => {
  const [phenotype, setPhenotype] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastSuggestion, setLastSuggestion] = useState<Module[] | null>(null)

  const handleGenerate = async () => {
    if (!phenotype.trim()) return
    
    setIsGenerating(true)
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Mock AI response based on phenotype keywords
    const mockSuggestion = generateMockSuggestion(phenotype)
    setLastSuggestion(mockSuggestion)
    onSuggestedConstruct(mockSuggestion)
    
    setIsGenerating(false)
  }

  const generateMockSuggestion = (input: string): Module[] => {
    const lower = input.toLowerCase()
    
    if (lower.includes("persistence") || lower.includes("exhaustion")) {
      return [
        { id: "BATF", name: "BATF", type: "overexpression" },
        { id: "KO-PDCD1", name: "KO-PDCD1", type: "knockout" },
        { id: "IL-21", name: "IL-21", type: "overexpression" }
      ]
    }
    
    if (lower.includes("cytotoxic") || lower.includes("killing")) {
      return [
        { id: "KU-GZMB", name: "KU-GZMB", type: "overexpression" },
        { id: "KU-IFNG", name: "KU-IFNG", type: "overexpression" },
        { id: "IRF4", name: "IRF4", type: "overexpression" }
      ]
    }
    
    if (lower.includes("metabol")) {
      return [
        { id: "KD-SOcs1", name: "KD-SOcs1", type: "knockdown" },
        { id: "KO-TET2", name: "KO-TET2", type: "knockout" }
      ]
    }
    
    // Default suggestion
    return [
      { id: "BATF", name: "BATF", type: "overexpression" },
      { id: "IRF4", name: "IRF4", type: "overexpression" },
      { id: "KO-PDCD1", name: "KO-PDCD1", type: "knockout" }
    ]
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">2. Natural Language Design</h2>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Describe the desired phenotype
          </label>
          <Textarea
            placeholder="e.g., 'Improve T-cell persistence and reduce exhaustion in tumor microenvironment'"
            value={phenotype}
            onChange={(e) => setPhenotype(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        
        <Button 
          onClick={handleGenerate}
          disabled={!phenotype.trim() || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Sparkles className="h-4 w-4 mr-2 animate-spin" />
              Generating Construct...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Construct
            </>
          )}
        </Button>
        
        {lastSuggestion && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h3 className="font-medium mb-2">AI Suggested Modules:</h3>
            <div className="text-sm text-muted-foreground">
              {lastSuggestion.map(m => m.name).join(" → ")}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}