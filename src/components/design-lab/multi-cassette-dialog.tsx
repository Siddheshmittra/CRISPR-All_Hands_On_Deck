import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, ArrowRight, X, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { searchEnsembl, enrichModuleWithSequence } from "@/lib/ensembl"
import { Module } from "@/lib/types"

interface MultiCassetteSetupProps {
  cassetteCount: number
  setCassetteCount: (n: number) => void
  overexpressionCount: number
  setOverexpressionCount: (n: number) => void
  knockoutCount: number
  setKnockoutCount: (n: number) => void
  knockdownCount: number
  setKnockdownCount: (n: number) => void
  showGoButton?: boolean
  onAddCassettes?: (cassettes: Module[][]) => void
  folders: any[]
  customModules: Module[]
}

export const MultiCassetteSetup = ({
  cassetteCount,
  setCassetteCount,
  overexpressionCount,
  setOverexpressionCount,
  knockoutCount,
  setKnockoutCount,
  knockdownCount,
  setKnockdownCount,
  showGoButton = false,
  onAddCassettes,
  folders,
  customModules
}: MultiCassetteSetupProps) => {
  const [mode, setMode] = useState<'manual' | 'search'>('manual')
  const [selectedLibrary, setSelectedLibrary] = useState<string>('total-library')
  
  // Gene search functionality
  const [searchTerm, setSearchTerm] = useState("")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedModules, setSelectedModules] = useState<Module[]>([])
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  const totalPerturbations =
    (Number(overexpressionCount) || 0) +
    (Number(knockoutCount) || 0) +
    (Number(knockdownCount) || 0)
  const maxPerturbations = 5
  const overLimit = totalPerturbations > maxPerturbations

  const typeOptions = [
    { value: 'overexpression', label: 'OE', icon: '↑' },
    { value: 'knockout', label: 'KO', icon: '✖' },
    { value: 'knockdown', label: 'KD', icon: '↓' },
    { value: 'knockin', label: 'KI*', icon: '→' },
  ]

  // Gene search functionality
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const results = await searchEnsembl(query)
      setSuggestions(results.slice(0, 5))
    } catch (error) {
      console.error('Search error:', error)
      setSuggestions([])
      toast.error('Failed to search genes')
    } finally {
      setLoading(false)
    }
  }

  const debouncedSearch = (query: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }
    searchTimeout.current = setTimeout(() => {
      handleSearch(query)
    }, 300)
  }

  useEffect(() => {
    if (searchTerm) {
      debouncedSearch(searchTerm)
    } else {
      setSuggestions([])
    }
  }, [searchTerm])

  const handleAddModule = async (geneData: any, moduleType: 'overexpression' | 'knockout' | 'knockdown' | 'knockin') => {
    try {
      const module: Module = {
        id: `${geneData.symbol}-${Date.now()}`,
        name: geneData.symbol,
        type: moduleType,
        description: geneData.description,
        sequence: '' // Will be enriched
      }

      console.log('handleAddModule: Created new module:', module);

      try {
        const enrichedModule = await enrichModuleWithSequence(module);
        console.log('handleAddModule: Enriched module:', enrichedModule);
        if (!enrichedModule.sequence) {
          throw new Error('Enrichment completed but sequence is missing.');
        }
        setSelectedModules(prev => [...prev, enrichedModule]);
        setSearchTerm('')
        setSuggestions([])
        toast.success(`Added ${module.name} as ${moduleType}`)
      } catch (error) {
        console.error('handleAddModule: Failed to enrich module with sequence:', error);
        toast.error(`Failed to add module: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } catch (error) {
      console.error('handleAddModule: Unexpected error:', error);
      toast.error(`Failed to add module: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRemoveModule = (moduleId: string) => {
    setSelectedModules(prev => prev.filter(m => m.id !== moduleId))
  }

  // Helper for input: allow empty, clamp, no leading zeros
  function handleCountChange(setter: (n: number) => void, value: string) {
    if (value === "") {
      setter(0)
      return
    }
    const sanitized = value.replace(/^0+(?!$)/, "")
    let n = parseInt(sanitized, 10)
    if (isNaN(n) || n < 0) n = 0
    if (n > maxPerturbations) n = maxPerturbations
    setter(n)
  }

  function handleSearchGenerate() {
    if (!onAddCassettes || selectedModules.length === 0) {
      toast.error('Please add some modules first')
      return
    }

    const cassettes: Module[][] = []
    for (let i = 0; i < cassetteCount; i++) {
      const cassette: Module[] = []
      // Use selected modules to create cassettes
      const shuffledModules = [...selectedModules].sort(() => Math.random() - 0.5)
      const modulesToUse = shuffledModules.slice(0, Math.min(totalPerturbations, selectedModules.length))
      cassette.push(...modulesToUse)
      cassettes.push(cassette)
    }
    onAddCassettes(cassettes)
    toast.success(`Generated ${cassetteCount} cassettes`)
  }

  function handleManualGenerate() {
    if (!onAddCassettes) return

    const library = folders.find(f => f.id === selectedLibrary)
    if (!library) {
      toast.error('No library selected')
      return
    }

    const libraryModules = customModules.filter(m => library.modules.includes(m.id))
    if (libraryModules.length === 0) {
      toast.error('Selected library is empty')
      return
    }

    const cassettes: Module[][] = []
    for (let i = 0; i < cassetteCount; i++) {
      const cassette: Module[] = []
      for (let j = 0; j < totalPerturbations; j++) {
        if (libraryModules.length > 0) {
          const randomModule = libraryModules[Math.floor(Math.random() * libraryModules.length)]
          cassette.push(randomModule)
        }
      }
      cassettes.push(cassette)
    }
    onAddCassettes(cassettes)
    toast.success(`Generated ${cassetteCount} cassettes from library`)
  }



  return (
    <Card className="p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4">Multi-Cassette Setup</h3>
      
      {/* Mode Selection */}
      <div className="flex gap-2 mb-6">
        <Button 
          variant={mode === 'manual' ? 'default' : 'outline'} 
          onClick={() => setMode('manual')}
          size="sm"
        >
          Manual Library
        </Button>
        <Button 
          variant={mode === 'search' ? 'default' : 'outline'} 
          onClick={() => setMode('search')}
          size="sm"
        >
          <Search className="w-4 h-4 mr-1" />
          Gene Search
        </Button>
      </div>

      {/* Manual Library Mode - Primary */}
      {mode === 'manual' && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1 text-sm font-medium">Number of Cassettes</label>
              <Input
                type="number"
                min={1}
                value={cassetteCount}
                onChange={e => setCassetteCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Library to use</label>
              <select
                value={selectedLibrary}
                onChange={e => setSelectedLibrary(e.target.value)}
                className="h-9 px-2 w-full rounded-md border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-2 font-medium">Perturbations per Cassette</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-xs font-semibold">Overexpression</label>
              <Input
                type="number"
                min={0}
                max={maxPerturbations}
                value={overexpressionCount === 0 ? "" : overexpressionCount}
                onChange={e => handleCountChange(setOverexpressionCount, e.target.value)}
                disabled={overLimit && overexpressionCount === 0}
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold">Knockout</label>
              <Input
                type="number"
                min={0}
                max={maxPerturbations}
                value={knockoutCount === 0 ? "" : knockoutCount}
                onChange={e => handleCountChange(setKnockoutCount, e.target.value)}
                disabled={overLimit && knockoutCount === 0}
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold">Knockdown</label>
              <Input
                type="number"
                min={0}
                max={maxPerturbations}
                value={knockdownCount === 0 ? "" : knockdownCount}
                onChange={e => handleCountChange(setKnockdownCount, e.target.value)}
                disabled={overLimit && knockdownCount === 0}
              />
            </div>
          </div>
          <div className={`mt-2 text-sm ${overLimit ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
            Total perturbations: {totalPerturbations} / {maxPerturbations}
            {overLimit && <span> &mdash; Maximum is {maxPerturbations} per cassette</span>}
          </div>
          <Button className="mt-4 w-full" onClick={handleManualGenerate}>Generate from Library</Button>
        </>
      )}

      {/* Gene Search Mode */}
      {mode === 'search' && (
        <>
          <div className="space-y-4">
            {/* Search Interface */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search for genes (e.g., TP53, BRCA1, MYC)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              )}
            </div>

            {/* Search Suggestions with Perturbation Buttons */}
            {suggestions.length > 0 && (
              <div className="border rounded-md bg-card">
                <div className="p-2 text-sm font-medium border-b bg-muted/50">Search Results - Click perturbation type to add</div>
                <div className="max-h-48 overflow-y-auto">
                  {suggestions.map((gene, index) => (
                    <div key={index} className="p-3 border-b last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium">{gene.symbol}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {gene.description || 'No description available'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {typeOptions.map(option => (
                          <Button
                            key={option.value}
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddModule(gene, option.value as any)}
                            className="text-xs px-2 py-1"
                          >
                            <span className="mr-1">{option.icon}</span>
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Modules */}
            {selectedModules.length > 0 && (
              <div className="border rounded-md bg-card">
                <div className="p-2 text-sm font-medium border-b bg-muted/50 flex items-center justify-between">
                  <span>Selected Modules ({selectedModules.length})</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setSelectedModules([])}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-2 space-y-2 max-h-32 overflow-y-auto">
                  {selectedModules.map((module) => (
                    <div key={module.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {typeOptions.find(t => t.value === module.type)?.icon} {typeOptions.find(t => t.value === module.type)?.label}
                        </Badge>
                        <span className="font-medium text-sm">{module.name}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveModule(module.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cassette Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">Number of Cassettes</label>
                <Input
                  type="number"
                  min={1}
                  value={cassetteCount}
                  onChange={e => setCassetteCount(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Modules per Cassette</label>
                <Input
                  type="number"
                  min={1}
                  max={selectedModules.length}
                  value={Math.min(selectedModules.length, 5)}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleSearchGenerate}
              disabled={selectedModules.length === 0}
            >
              Generate {cassetteCount} Cassettes from Selected Modules
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
