import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { Module, EnsemblModule } from "@/lib/types"
import { SyntheticGeneSelector } from "./synthetic-gene-selector"
import { SyntheticGene } from "@/lib/types"
import { searchEnsembl } from "@/lib/ensembl"

interface SimpleModuleSelectorProps {
  onModuleAdd: (module: Module) => void
  constructModules: Module[]
}

export const SimpleModuleSelector = ({ onModuleAdd, constructModules }: SimpleModuleSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<'overexpression' | 'knockout' | 'knockdown' | 'knockin'>('overexpression')
  const [showSyntheticSelector, setShowSyntheticSelector] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  const typeOptions = [
    { value: 'overexpression', label: 'OE', icon: '↑' },
    { value: 'knockout', label: 'KO', icon: '✖' },
    { value: 'knockdown', label: 'KD', icon: '↓' },
    { value: 'knockin', label: 'KI*', icon: '→' },
  ]

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const results = await searchEnsembl(query)
      setSuggestions(results.slice(0, 5)) // Limit to 5 suggestions
    } catch (error) {
      console.error('Search error:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }
    
    if (searchTerm.trim()) {
      searchTimeout.current = setTimeout(() => {
        handleSearch(searchTerm)
      }, 300)
    } else {
      setSuggestions([])
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current)
      }
    }
  }, [searchTerm])

  const handleQuickAddModule = (gene: string) => {
    if (constructModules.length >= 5) {
      toast.error("Maximum 5 modules allowed")
      return
    }

    // For knockin modules, show synthetic gene selector
    if (selectedType === 'knockin') {
      const mockSuggestion = {
        symbol: gene,
        description: `Human gene ${gene}`,
        sequence: ""
      }
      setSelectedSuggestion(mockSuggestion)
      setShowSyntheticSelector(true)
      return
    }

    // For non-knockin modules, add directly
    try {
      const newModule: Module = {
        id: `${gene}-${Date.now()}`,
        name: gene,
        type: selectedType,
        description: `Human gene ${gene}`,
        sequence: ""
      }
      
      onModuleAdd(newModule)
      toast.success(`Added ${gene} (${selectedType.toUpperCase()})`)
    } catch (error) {
      console.error("Error adding module:", error)
      toast.error("Failed to add module")
    }
  }

  const handleAddModule = async (suggestion: any) => {
    if (constructModules.length >= 5) {
      toast.error("Maximum 5 modules allowed")
      return
    }

    // For knockin modules, show synthetic gene selector
    if (selectedType === 'knockin') {
      setSelectedSuggestion(suggestion)
      setShowSyntheticSelector(true)
      return
    }

    try {
      const newModule: Module = {
        id: `${suggestion.symbol}-${Date.now()}`,
        name: suggestion.symbol,
        type: selectedType,
        description: suggestion.description || `Human gene ${suggestion.symbol}`,
        sequence: suggestion.sequence || ""
      }
      
      onModuleAdd(newModule)
      setSearchTerm("")
      setSuggestions([])
      toast.success(`Added ${suggestion.symbol} (${selectedType.toUpperCase()})`)
    } catch (error) {
      console.error("Error adding module:", error)
      toast.error("Failed to add module")
    }
  }

  const handleSyntheticGeneSelect = (gene: SyntheticGene) => {
    if (constructModules.length >= 5) {
      toast.error("Maximum 5 modules allowed")
      return
    }

    const newModule: Module = {
      id: `${gene.name}-${Date.now()}`,
      name: gene.name,
      type: 'knockin',
      description: gene.description,
      sequence: gene.sequence,
      isSynthetic: true,
      syntheticSequence: gene.sequence
    }
    
    onModuleAdd(newModule)
    setShowSyntheticSelector(false)
    setSelectedSuggestion(null)
    setSearchTerm("")
    setSuggestions([])
    toast.success(`Added ${gene.name} (KI)`)
  }

  const handleCustomSequence = (sequence: string) => {
    if (constructModules.length >= 5) {
      toast.error("Maximum 5 modules allowed")
      return
    }

    const newModule: Module = {
      id: `custom-synthetic-${Date.now()}`,
      name: "Custom Synthetic Gene",
      type: 'knockin',
      description: "Custom synthetic gene sequence",
      sequence: sequence,
      isSynthetic: true,
      syntheticSequence: sequence
    }
    
    onModuleAdd(newModule)
    setShowSyntheticSelector(false)
    setSelectedSuggestion(null)
    setSearchTerm("")
    setSuggestions([])
    toast.success("Added custom synthetic gene (KI)")
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Add Modules to Construct</h2>
      
      {showSyntheticSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <SyntheticGeneSelector
            onGeneSelect={handleSyntheticGeneSelect}
            onCustomSequence={handleCustomSequence}
            onClose={() => setShowSyntheticSelector(false)}
          />
        </div>
      )}

      <div className="space-y-4">
        {/* Type Selector */}
        <div className="flex gap-2">
          {typeOptions.map(option => (
            <Button
              key={option.value}
              variant={selectedType === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(option.value as any)}
              className="flex-1"
            >
              <span className="mr-2">{option.icon}</span>
              {option.label}
            </Button>
          ))}
        </div>
        
        {/* Legend */}
        <div className="text-xs text-muted-foreground text-center">
          * KI* indicates knock-ins of synthetic genes
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search for genes to ${selectedType}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Suggestions */}
        {loading && (
          <div className="text-center py-4 text-muted-foreground">
            Searching...
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Search Results</h3>
            {suggestions.map((suggestion, index) => (
              <Card 
                key={suggestion.symbol} 
                className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleAddModule(suggestion)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{suggestion.symbol}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {selectedType.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {suggestion.description || suggestion.name || "Human gene"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Add Common Genes */}
        {!searchTerm && suggestions.length === 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Quick Add Common Genes</h3>
            <div className="grid grid-cols-2 gap-2">
              {['BATF', 'IRF4', 'PDCD1', 'TET2', 'GZMB', 'IFNG'].map(gene => (
                <Button
                  key={gene}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAddModule(gene)}
                  className="justify-start"
                >
                  <Plus className="h-3 w-3 mr-2" />
                  {gene}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Module Count */}
        <div className="text-sm text-muted-foreground text-center">
          {constructModules.length}/5 modules in construct
        </div>
      </div>
    </Card>
  )
} 