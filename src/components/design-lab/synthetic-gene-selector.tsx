import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, X, ChevronDown } from "lucide-react"
import { searchSyntheticGenes, syntheticGeneCategories, syntheticGenes } from "@/lib/synthetic-genes"
import { SyntheticGene } from "@/lib/types"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// 2A self-cleaving peptide sequences
const TWO_A_SEQUENCES = {
  P2A: 'ATNFSLLKQAGDVEENPGP',
  T2A: 'EGRGSLLTCGDVEENPGP',
  E2A: 'QCTNYALLKLAGDVESNPGP',
  F2A: 'VKQTLNFDLLKLAGDVESNPGP'
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  'synthetic-gene': 'bg-knockin/80 text-knockin-foreground border-knockin/40 dark:bg-knockin/40 dark:text-knockin-foreground dark:border-knockin/40',
  'car-specificity-domain': 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-100 dark:border-fuchsia-400/40',
  'car-signalling-domain': 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-400/40',
  reporter: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-400/40',
}

interface SyntheticGeneSelectorProps {
  onGeneSelect: (gene: SyntheticGene, options?: { add2ASequence?: boolean, twoAType?: keyof typeof TWO_A_SEQUENCES }) => void
  onCustomSequence: (sequence: string, name: string, options: { endsCodingFrame: boolean, add2ASequence?: boolean, twoAType?: keyof typeof TWO_A_SEQUENCES }) => void
  onClose: () => void
}

export const SyntheticGeneSelector = ({ onGeneSelect, onCustomSequence, onClose }: SyntheticGeneSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [customSequence, setCustomSequence] = useState("")
  const [sequenceName, setSequenceName] = useState("")
  const [add2ASequence, setAdd2ASequence] = useState(true)
  const [twoAType] = useState<keyof typeof TWO_A_SEQUENCES>('T2A')
  const [activeGeneId, setActiveGeneId] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(syntheticGeneCategories.map(category => [category.id, true]))
  ))
  const [expandedReferences, setExpandedReferences] = useState<Record<string, boolean>>({})

  const categoryOptions = [
    { id: 'all', label: 'All Types' },
    ...syntheticGeneCategories.map(category => ({ id: category.id, label: category.label }))
  ]

  const searchMatches = useMemo(() => searchSyntheticGenes(searchTerm), [searchTerm])

  const groupedGenes = useMemo(() => {
    const categoriesToDisplay = selectedCategory === 'all'
      ? syntheticGeneCategories
      : syntheticGeneCategories.filter(category => category.id === selectedCategory)

    return categoriesToDisplay
      .map(category => ({
        category,
        genes: searchMatches.filter(gene => gene.category === category.id)
      }))
      .filter(group => group.genes.length > 0)
  }, [searchMatches, selectedCategory])

  const totalMatches = groupedGenes.reduce((count, group) => count + group.genes.length, 0)

  const selectedCategoryLabel = categoryOptions.find(option => option.id === selectedCategory)?.label ?? 'All Types'

  const handleCustomSequenceSubmit = () => {
    const sequence = customSequence.trim()
    if (!sequence) return
    const name = sequenceName.trim() || "Custom Synthetic Gene"
    const opts = {
      endsCodingFrame: !add2ASequence,
      add2ASequence: add2ASequence,
      twoAType: add2ASequence ? twoAType : undefined
    }
    onCustomSequence(sequence, name, opts)
  }

  const loadTemplateByName = (name: string) => {
    const gene = syntheticGenes.find(g => g.name.toLowerCase() === name.toLowerCase())
    if (!gene) {
      toast.error(`${name} template not found`)
      return
    }
    setSequenceName(gene.name)
    setCustomSequence(gene.sequence)
    toast.success(`${gene.name} sequence loaded`)
  }

  // Clicking a gene populates the editor fields and highlights it for quick edits

  const handleGeneSelect = (gene: SyntheticGene) => {
    setActiveGeneId(gene.id)
    setSequenceName(gene.name)
    setCustomSequence(gene.sequence)
  }

  const handleAddGeneToConstruct = (gene: SyntheticGene) => {
    handleGeneSelect(gene)
    if (add2ASequence) {
      onGeneSelect(gene, { add2ASequence: true, twoAType })
    } else {
      onGeneSelect(gene, { add2ASequence: false })
    }
  }

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  const toggleReferences = (geneId: string) => {
    setExpandedReferences(prev => ({
      ...prev,
      [geneId]: !prev[geneId],
    }))
  }

  // No separate confirmation dialog now; the main form handles submission

  return (
    <>
      <Card className="p-6 w-full max-w-[90vw] sm:max-w-[820px] max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Select Synthetic Gene for Knock-in</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 flex flex-col h-full">
        {/* YES/NO (2A) toggle */}
        <div className="flex gap-4">
          <RadioGroup value={add2ASequence ? 'yes' : 'no'} onValueChange={(v) => setAdd2ASequence(v === 'yes')} className="flex gap-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="ki-twoa-yes" />
              <Label htmlFor="ki-twoa-yes">Contains end-of-domain (Add 2A)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="ki-twoa-no" />
              <Label htmlFor="ki-twoa-no">Does not contain end-of-domain (No 2A added)</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Name - Styled differently from search */}
        <div className="space-y-2">
          <Label className="text-base font-bold text-foreground">Name</Label>
          <Input 
            placeholder="e.g. GFP" 
            value={sequenceName} 
            onChange={(e) => setSequenceName(e.target.value)}
            className="bg-muted/30 border-2 font-semibold text-base h-11"
          />
        </div>

        {/* Quick Add Common Genes */
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Quick Add</Label>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplateByName("BFP")}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              BFP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplateByName("GFP")}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              GFP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplateByName("mCherry")}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              mCherry
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplateByName("RFP")}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              RFP
            </Button>
          </div>
        </div>

        {/* Custom Sequence Input */}
        <div className="border rounded-lg p-4 bg-card">
          <Label className="font-semibold">Custom Sequence</Label>
          <Textarea
            placeholder="Enter your custom synthetic gene sequence (DNA)..."
            value={customSequence}
            onChange={(e) => setCustomSequence(e.target.value)}
            className="h-32 font-mono text-xs mt-2"
          />
          <div className="flex gap-2 mt-3">
            <Button onClick={handleCustomSequenceSubmit} disabled={!customSequence.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Sequence
            </Button>
          </div>
        </div>

        {/* Search and Category Filter */}
        <div className="flex flex-col gap-3 pt-2 border-t">
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search knock-in library..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalMatches} {totalMatches === 1 ? 'match' : 'matches'}</span>
            <span>Viewing {selectedCategoryLabel}</span>
          </div>
        </div>

        {/* Gene List */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
          {groupedGenes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              <p className="font-medium">No knock-in templates found.</p>
              {searchTerm && (
                <p className="mt-1 text-xs text-muted-foreground/80">Try a different search term or clear the filter.</p>
              )}
            </div>
          ) : (
            groupedGenes.map(group => {
              const geneCount = group.genes.length
              const isCollapsed = collapsedCategories[group.category.id] ?? false

              return (
                <div key={group.category.id} className="rounded-lg border border-muted bg-background/70 shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-t-lg bg-muted/50 px-4 py-3 text-left transition hover:bg-muted/70 dark:bg-muted/40"
                    onClick={() => toggleCategory(group.category.id)}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-background text-xs font-semibold text-primary shadow-inner">
                        {group.category.label.slice(0, 2).toUpperCase()}
                      </span>
                      {group.category.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                        {geneCount} {geneCount === 1 ? 'template' : 'templates'}
                      </Badge>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          isCollapsed ? "-rotate-90" : "rotate-0"
                        )}
                      />
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-3 border-t border-muted/60 px-4 py-4">
                      {group.genes.map(gene => {
                        const references = gene.references ?? []
                        const referencesOpen = expandedReferences[gene.id] ?? false

                        return (
                          <Card
                            key={gene.id}
                            className={cn(
                              "p-4 transition-all border cursor-pointer",
                              activeGeneId === gene.id
                                ? "border-primary/80 shadow-md bg-primary/5 dark:bg-primary/10"
                                : "hover:border-primary/40 hover:shadow-sm"
                            )}
                            onClick={() => handleGeneSelect(gene)}
                          >
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h5 className="text-base font-semibold leading-tight">{gene.name}</h5>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-xs font-semibold capitalize",
                                        TYPE_BADGE_STYLES[gene.category] ?? "bg-muted text-muted-foreground"
                                      )}
                                    >
                                      {gene.knockinTypeLabel || gene.category}
                                    </Badge>
                                    {gene.sequenceLength && (
                                      <Badge variant="outline" className="text-xs">
                                        {gene.sequenceLength.toLocaleString()} bp
                                      </Badge>
                                    )}
                                  </div>
                                  {gene.description && (
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                      {gene.description}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleAddGeneToConstruct(gene)
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              </div>

                              <div className="grid gap-1 text-xs text-muted-foreground">
                                {gene.sequenceDerivation && (
                                  <div>
                                    <span className="font-semibold text-foreground">Derivation:</span> {gene.sequenceDerivation}
                                  </div>
                                )}
                                {gene.notes && (
                                  <div>
                                    <span className="font-semibold text-foreground">Notes:</span> {gene.notes}
                                  </div>
                                )}
                              </div>

                              {gene.sequence && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">Sequence (first 60 bp):</span>
                                  <div className="font-mono mt-1 break-all rounded-md bg-muted/50 px-3 py-2">
                                    {gene.sequence.slice(0, 60)}{gene.sequence.length > 60 ? '…' : ''}
                                  </div>
                                </div>
                              )}

                              {references.length > 0 && (
                                <div className="border-t border-dashed pt-3">
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:bg-muted/60"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      toggleReferences(gene.id)
                                    }}
                                  >
                                    <span className="flex items-center gap-2">
                                      References
                                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                        {references.length}
                                      </Badge>
                                    </span>
                                    <ChevronDown
                                      className={cn(
                                        "h-4 w-4 transition-transform",
                                        referencesOpen ? "rotate-0" : "-rotate-90"
                                      )}
                                    />
                                  </button>
                                  {referencesOpen && (
                                    <div className="mt-2 flex flex-col gap-1">
                                      {references.map((reference, index) => (
                                        <a
                                          key={`${gene.id}-ref-${index}`}
                                          href={reference.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 text-xs text-primary hover:underline"
                                          onClick={(event) => event.stopPropagation()}
                                        >
                                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                            {reference.source === 'patent' ? 'Patent' : 'PubMed'}
                                          </Badge>
                                          <span>{reference.raw}</span>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </Card>
    </>
  )
} 
