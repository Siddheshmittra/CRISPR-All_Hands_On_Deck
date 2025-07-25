import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Module {
  id: string;
  name: string;
  type: "overexpression" | "knockout" | "knockdown";
  description?: string;
  sequence?: string;
}

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
  const [mode, setMode] = useState<'manual' | 'suggest'>('manual')
  const [prompt, setPrompt] = useState("")
  const [suggested, setSuggested] = useState<string[][]>([])
  const [selectedLibrary, setSelectedLibrary] = useState<string>('total-library')

  const totalPerturbations =
    (Number(overexpressionCount) || 0) +
    (Number(knockoutCount) || 0) +
    (Number(knockdownCount) || 0)
  const maxPerturbations = 5
  const overLimit = totalPerturbations > maxPerturbations

  // Helper for input: allow empty, clamp, no leading zeros
  function handleCountChange(setter: (n: number) => void, value: string) {
    if (value === "") {
      setter(0)
      return
    }
    // Remove leading zeros
    const sanitized = value.replace(/^0+(?!$)/, "")
    let n = parseInt(sanitized, 10)
    if (isNaN(n) || n < 0) n = 0
    if (n > maxPerturbations) n = maxPerturbations
    setter(n)
  }

  function handleManualGenerate() {
    if (!onAddCassettes) return

    const library = folders.find(f => f.id === selectedLibrary)
    if (!library) return

    const libraryModules = customModules.filter(m => library.modules.includes(m.id))

    const cassettes: Module[][] = []
    for (let i = 0; i < cassetteCount; i++) {
      const cassette: Module[] = []
      // Simple random selection for now
      for (let j = 0; j < totalPerturbations; j++) {
        if (libraryModules.length > 0) {
          const randomModule = libraryModules[Math.floor(Math.random() * libraryModules.length)]
          cassette.push(randomModule)
        }
      }
      cassettes.push(cassette)
    }
    onAddCassettes(cassettes)
  }

  function handleSuggest() {
    // Demo: generate random cassette suggestions
    const genes = ["CD69", "TP53", "MYC", "EGFR", "BCL2", "KRAS", "GATA3"]
    const cassettes: Module[][] = []
    for (let i = 0; i < cassetteCount; i++) {
      const cassette: Module[] = []
      for (let j = 0; j < 2 + Math.floor(Math.random() * 2); j++) {
        const geneName = genes[Math.floor(Math.random() * genes.length)]
        cassette.push({
          id: `${geneName}-${i}-${j}`,
          name: geneName,
          type: "overexpression",
          sequence: "ATCG"
        })
      }
      cassettes.push(cassette)
    }
    setSuggested(cassettes.map(c => c.map(m => m.name)))
    if (onAddCassettes) {
      onAddCassettes(cassettes)
    }
  }

  return (
    <Card className="p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4">Multi-Cassette Setup</h3>
      <div className="flex gap-4 mb-4">
        <Button variant={mode === 'manual' ? 'default' : 'outline'} onClick={() => setMode('manual')}>Manual</Button>
        <Button variant={mode === 'suggest' ? 'default' : 'outline'} onClick={() => setMode('suggest')}>Suggest (Demo)</Button>
      </div>
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
          <Button className="mt-4" onClick={handleManualGenerate}>Go!</Button>
        </>
      )}
      {mode === 'suggest' && (
        <>
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium">Prompt for cassette design</label>
            <Input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. optimize for knockdown and knockout"
            />
            {showGoButton ? (
              <Button className="mt-2" onClick={handleSuggest}>Go</Button>
            ) : (
              <Button className="mt-2" onClick={handleSuggest}>Suggest Cassettes</Button>
            )}
          </div>
          {suggested.length > 0 && (
            <div className="mt-4">
              <div className="font-semibold mb-2">Suggested Cassettes:</div>
              {suggested.map((cassette, i) => (
                <div key={i} className="mb-2 p-2 bg-muted rounded">
                  <span className="font-mono">Cassette {i + 1}: </span>
                  {cassette.join(' → ')}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
