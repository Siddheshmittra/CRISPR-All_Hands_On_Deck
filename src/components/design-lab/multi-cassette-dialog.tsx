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
import { UnifiedGeneSearch } from "./unified-gene-search"

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
  
  // Gene search functionality - simplified with unified component
  const [selectedModules, setSelectedModules] = useState<Module[]>([])

  const totalPerturbations =
    (Number(overexpressionCount) || 0) +
    (Number(knockoutCount) || 0) +
    (Number(knockdownCount) || 0)
  const maxPerturbations = 5
  const overLimit = totalPerturbations > maxPerturbations

  // Unified gene search handlers
  const handleAddModule = (module: Module) => {
    setSelectedModules(prev => [...prev, module])
  }

  const handleRemoveModule = (moduleId: string) => {
    setSelectedModules(prev => prev.filter(m => m.id !== moduleId))
  }

  const handleClearAllModules = () => {
    setSelectedModules([])
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
            {/* Unified Gene Search Component */}
            <UnifiedGeneSearch
              onModuleAdd={handleAddModule}
              selectedModules={selectedModules}
              onModuleRemove={handleRemoveModule}
              onClearAll={handleClearAllModules}
              showTypeButtons={true}
              showSelectedModules={true}
            />

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
