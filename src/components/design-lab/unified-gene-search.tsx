import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, X, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { searchEnsembl } from "@/lib/ensembl"
import { Module } from "@/lib/types"

interface UnifiedGeneSearchProps {
  onModuleAdd: (module: Module) => void
  selectedModules?: Module[]
  onModuleRemove?: (moduleId: string) => void
  onClearAll?: () => void
  placeholder?: string
  showSelectedModules?: boolean
  showTypeButtons?: boolean
  defaultType?: 'overexpression' | 'knockout' | 'knockdown' | 'knockin'
  className?: string
  disabled?: boolean
}

const typeOptions = [
  { value: 'overexpression', label: 'OE', icon: '↑' },
  { value: 'knockout', label: 'KO', icon: '✖' },
  { value: 'knockdown', label: 'KD', icon: '↓' },
  { value: 'knockin', label: 'KI*', icon: '→' },
]

export const UnifiedGeneSearch = ({
  onModuleAdd,
  selectedModules = [],
  onModuleRemove,
  onClearAll,
  placeholder = "Search for genes (e.g., TP53, BRCA1, MYC)...",
  showSelectedModules = true,
  showTypeButtons = true,
  defaultType = 'overexpression',
  className = "",
  disabled = false
}: UnifiedGeneSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState(defaultType)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  // Gene search functionality using Ensembl (consistent with multi-cassette)
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([])
      return
    }

    if (disabled) return;

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
        sequence: '' // Will be enriched later in the pipeline
      }

      onModuleAdd(module)
      setSearchTerm('')
      setSuggestions([])
      toast.success(`Added ${module.name} as ${moduleType}`)
    } catch (error) {
      console.error('Error creating module:', error)
      toast.error(`Failed to add module: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleQuickAdd = (geneData: any) => {
    handleAddModule(geneData, selectedType)
  }

  return (
    <div className={`space-y-2 ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Search Interface */}
      <div className="flex gap-2">
        {!showTypeButtons && (
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value as any)}
            className="h-9 px-2 rounded-md border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            style={{ minWidth: 70 }}
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder={placeholder}
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
        {!showTypeButtons && searchTerm && (
          <Button
            onClick={() => {
              if (suggestions.length > 0) {
                handleQuickAdd(suggestions[0])
              }
            }}
            disabled={suggestions.length === 0 || loading}
            size="sm"
          >
            <span className="mr-1">{typeOptions.find(t => t.value === selectedType)?.icon}</span>
            Add
          </Button>
        )}
      </div>

      {/* Search Suggestions */}
      {suggestions.length > 0 && (
        <div className="border rounded-md bg-card">
          <div className="p-2 text-sm font-medium border-b bg-muted/50">
            {showTypeButtons ? 'Search Results - Click perturbation type to add' : 'Search Results'}
          </div>
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
                {showTypeButtons ? (
                  <div className="flex gap-1">
                    {typeOptions.map(option => {
                      const getButtonClass = () => {
                        switch(option.value) {
                          case 'overexpression': return 'bg-overexpression text-overexpression-foreground border-overexpression/30 hover:bg-overexpression/80';
                          case 'knockout': return 'bg-knockout text-knockout-foreground border-knockout/30 hover:bg-knockout/80';
                          case 'knockdown': return 'bg-knockdown text-knockdown-foreground border-knockdown/30 hover:bg-knockdown/80';
                          case 'knockin': return 'bg-knockin text-knockin-foreground border-knockin/30 hover:bg-knockin/80';
                          default: return 'bg-card text-card-foreground border-border hover:bg-muted';
                        }
                      };
                      return (
                        <Button
                          key={option.value}
                          size="sm"
                          onClick={() => handleAddModule(gene, option.value as any)}
                          className={`text-xs px-2 py-1 ${getButtonClass()}`}
                        >
                          <span className="mr-1">{option.icon}</span>
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAdd(gene)}
                    className="text-xs px-2 py-1"
                  >
                    <span className="mr-1">{typeOptions.find(t => t.value === selectedType)?.icon}</span>
                    Add as {typeOptions.find(t => t.value === selectedType)?.label}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Modules */}
      {showSelectedModules && selectedModules.length > 0 && (
        <div className="border rounded-md bg-card">
          <div className="p-2 text-sm font-medium border-b bg-muted/50 flex items-center justify-between">
            <span>Selected Modules ({selectedModules.length})</span>
            {onClearAll && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={onClearAll}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="p-2 space-y-2 max-h-32 overflow-y-auto">
            {selectedModules.map((module) => {
              const typeOption = typeOptions.find(t => t.value === module.type)
              return (
                <div key={module.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {typeOption?.icon || '?'} {typeOption?.label || module.type.toUpperCase()}
                    </Badge>
                    <span className="font-medium text-sm">{module.name}</span>
                  </div>
                  {onModuleRemove && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onModuleRemove(module.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
