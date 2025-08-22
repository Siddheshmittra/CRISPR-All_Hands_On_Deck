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
    { 
      value: 'overexpression', 
      label: 'OE', 
      icon: '↑',
      className: 'bg-[hsl(66,70%,47%)] hover:bg-[hsl(66,70%,40%)] text-white font-semibold',
      outlineClassName: 'text-[hsl(66,70%,47%)] border-[hsl(66,70%,47%)] hover:bg-[hsl(66,70%,47%)]/20 hover:text-[hsl(66,70%,47%)] font-medium'
    },
    { 
      value: 'knockout', 
      label: 'KO', 
      icon: '✖',
      className: 'bg-[hsl(13,95%,59%)] hover:bg-[hsl(13,95%,50%)] text-white font-semibold',
      outlineClassName: 'text-[hsl(13,95%,59%)] border-[hsl(13,95%,59%)] hover:bg-[hsl(13,95%,59%)]/20 hover:text-[hsl(13,95%,59%)] font-medium'
    },
    { 
      value: 'knockdown', 
      label: 'KD', 
      icon: '↓',
      className: 'bg-[hsl(32,75%,49%)] hover:bg-[hsl(32,75%,40%)] text-white font-semibold',
      outlineClassName: 'text-[hsl(32,75%,49%)] border-[hsl(32,75%,49%)] hover:bg-[hsl(32,75%,49%)]/20 hover:text-[hsl(32,75%,49%)] font-medium'
    },
    { 
      value: 'knockin', 
      label: 'KI*', 
      icon: '→',
      className: 'bg-[hsl(220,35%,65%)] hover:bg-[hsl(220,35%,55%)] text-white font-semibold',
      outlineClassName: 'text-[hsl(220,35%,65%)] border-[hsl(220,35%,65%)] hover:bg-[hsl(220,35%,65%)]/20 hover:text-[hsl(220,35%,65%)] font-medium'
    },
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
    // Knock-ins must come from synthetic genes only
    if (selectedType === 'knockin') {
      toast.error("Knock-ins are only available for synthetic genes.")
      return
    }

    if (constructModules.length >= 5) {
      toast.error("Maximum 5 modules allowed");
      return;
    }

    // For non-knockin modules, add directly
    try {
      const moduleName = gene || 'Custom Module';
      const newModule: Module = {
        id: `${moduleName}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: moduleName,
        type: selectedType,
        description: `Human gene ${moduleName}`,
        sequence: "",
        isSynthetic: false
      };
      
      onModuleAdd(newModule);
      toast.success(`Added ${moduleName} (${selectedType.toUpperCase()})`);
    } catch (error) {
      console.error("Error adding module:", error);
      toast.error("Failed to add module");
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
      // Create a properly named module with all required fields
      const moduleName = suggestion.symbol || suggestion.name || suggestion.id || 'Unnamed';
      const moduleDescription = suggestion.description || 
                              (suggestion.symbol ? `Human gene ${suggestion.symbol}` : 'Custom module');
      
      const newModule: Module = {
        id: `${moduleName}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: moduleName,
        type: selectedType,
        description: moduleDescription,
        sequence: suggestion.sequence || "",
        isSynthetic: !!suggestion.isSynthetic
      };
      
      onModuleAdd(newModule);
      setSearchTerm("");
      setSuggestions([]);
      toast.success(`Added ${moduleName} (${selectedType.toUpperCase()})`);
    } catch (error) {
      console.error("Error adding module:", error);
      toast.error("Failed to add module");
    }
  }

  // 2A self-cleaving peptide sequences
  const TWO_A_SEQUENCES = {
    P2A: 'ATNFSLLKQAGDVEENPGP',
    T2A: 'EGRGSLLTCGDVEENPGP',
    E2A: 'QCTNYALLKLAGDVESNPGP',
    F2A: 'VKQTLNFDLLKLAGDVESNPGP'
  }

  const dnaToAminoAcid = (dna: string): string => {
    // Simple DNA to AA translation (simplified - in a real app, use a proper translation function)
    // This is just a placeholder
    return dna
  }

  const handleSyntheticGeneSelect = (gene: SyntheticGene, options?: { add2ASequence?: boolean, twoAType?: string }) => {
    if (constructModules.length >= 5) {
      toast.error("Maximum 5 modules allowed")
      return
    }

    let sequence = gene.sequence
    
    // Add 2A sequence if specified
    if (options?.add2ASequence && options?.twoAType) {
      const twoASequence = TWO_A_SEQUENCES[options.twoAType as keyof typeof TWO_A_SEQUENCES] || ''
      sequence = sequence + twoASequence
    }

    const newModule: Module = {
      id: `${gene.name}-${Date.now()}`,
      name: gene.name,
      type: 'knockin',
      description: gene.description,
      sequence: sequence,
      isSynthetic: true,
      syntheticSequence: gene.sequence, // Store original sequence
      metadata: {
        ...(options?.add2ASequence && { 
          has2ASequence: true,
          twoAType: options.twoAType 
        })
      }
    }
    
    onModuleAdd(newModule)
    setShowSyntheticSelector(false)
    setSelectedSuggestion(null)
    setSearchTerm("")
    setSuggestions([])
    toast.success(`Added ${gene.name} (KI)${options?.add2ASequence ? ` with ${options.twoAType}` : ''}`)
  }

  const handleCustomSequence = (sequence: string, name: string, options: { endsCodingFrame: boolean, add2ASequence?: boolean, twoAType?: string }) => {
    if (constructModules.length >= 5) {
      toast.error("Maximum 5 modules allowed")
      return
    }

    let finalSequence = sequence
    
    // Add stop codon if it's a complete coding frame and doesn't end with one
    if (options.endsCodingFrame && !/T(AA|AG|GA)$/i.test(sequence)) {
      finalSequence = sequence + 'TAA' // Default stop codon
    }
    // Add 2A sequence if specified and not a complete coding sequence
    else if (options.add2ASequence && options.twoAType) {
      const twoASequence = TWO_A_SEQUENCES[options.twoAType as keyof typeof TWO_A_SEQUENCES] || ''
      finalSequence = sequence + twoASequence
    }

    const newModule: Module = {
      id: `custom-synthetic-${Date.now()}`,
      name: name || "Custom Synthetic Gene",
      type: 'knockin',
      description: "Custom synthetic gene sequence" + (options.add2ASequence ? ` (with ${options.twoAType})` : ''),
      sequence: finalSequence,
      isSynthetic: true,
      syntheticSequence: sequence, // Store original sequence
      metadata: {
        ...(options.add2ASequence && { 
          has2ASequence: true,
          twoAType: options.twoAType 
        })
      }
    }
    
    onModuleAdd(newModule)
    setShowSyntheticSelector(false)
    setSelectedSuggestion(null)
    setSearchTerm("")
    setSuggestions([])
    toast.success(`Added custom synthetic gene (KI)${options.add2ASequence ? ` with ${options.twoAType}` : ''}`)
  }

  return (
    <Card className="p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="space-y-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">1. Desired Genetic Perturbation</h2>
        
        {/* Type Selector - Styled to match scan genes dialog */}
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Perturbation Type</div>
          <div className="flex gap-2 flex-wrap">
            {typeOptions.map(option => (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                size="sm"
                className={`flex-1 min-w-[80px] transition-all duration-200 ${
                  selectedType === option.value 
                    ? option.className + ' shadow-md scale-[1.02]' 
                    : option.outlineClassName + ' hover:shadow-md hover:scale-[1.02] hover:font-semibold'
                }`}
                onClick={() => {
                  setSelectedType(option.value as any);
                  // If knockin is selected, show synthetic gene selector
                  if (option.value === 'knockin') {
                    setShowSyntheticSelector(true);
                  }
                }}
              >
                <span className="drop-shadow-sm">{option.icon} {option.label}</span>
              </Button>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
            *indicates knock-ins of synthetic genes
          </p>
        </div>

        {showSyntheticSelector && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <SyntheticGeneSelector
              onGeneSelect={handleSyntheticGeneSelect}
              onCustomSequence={handleCustomSequence}
              onClose={() => setShowSyntheticSelector(false)}
            />
          </div>
        )}

        {/* Search - Enhanced with better styling */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Search symbols for this cassette</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder={`e.g. TP53, BRCA1, EGFR`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 text-base border-gray-300 dark:border-gray-600 focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Suggestions */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Searching...
            </div>
          ) : !searchTerm && suggestions.length === 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Quick Add</h3>
              <div className="grid grid-cols-2 gap-2">
                {['BATF', 'IRF4', 'PDCD1', 'TET2', 'GZMB', 'IFNG'].map(gene => {
                  const selectedTypeOption = typeOptions.find(opt => opt.value === selectedType);
                  return (
                    <Button
                      key={gene}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAddModule(gene)}
                      className={`justify-start hover:bg-opacity-20 ${selectedTypeOption?.outlineClassName.split(' ').filter(c => c.startsWith('hover:bg-[') || c.startsWith('hover:text-[')).join(' ')}`}
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      {gene}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : suggestions.length > 0 && (
            <>
               <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Search Results</h3>
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <Card 
                    key={suggestion.symbol} 
                    className="p-3 hover:bg-muted/50 cursor-pointer transition-all duration-200 hover:shadow-md border border-gray-200 dark:border-gray-700"
                    onClick={() => handleAddModule(suggestion)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-bold text-gray-900 dark:text-white">{suggestion.symbol}</h4>
                          <Badge 
                            variant="secondary" 
                            className="text-xs font-medium px-2 py-0.5"
                            style={{
                              backgroundColor: selectedType === 'overexpression' ? 'hsl(66,70%,47%)' : 
                                            selectedType === 'knockout' ? 'hsl(13,95%,59%)' :
                                            selectedType === 'knockdown' ? 'hsl(32,75%,49%)' : 'hsl(220,35%,65%)',
                              color: selectedType === 'knockout' || selectedType === 'knockdown' ? 'white' : 'hsl(0 0% 98%)'
                            }}
                          >
                            {selectedType.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {suggestion.description || suggestion.name || "Human gene"}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Module Count */}
        <div className="text-sm text-muted-foreground text-center">
          {constructModules.length}/5 modules in construct
        </div>
      </div>
    </Card>
  )
} 