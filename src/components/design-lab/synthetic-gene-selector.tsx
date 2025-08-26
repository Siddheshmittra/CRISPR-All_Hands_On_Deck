import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, X, Check, ChevronDown } from "lucide-react"
import { searchSyntheticGenes, getSyntheticGenesByCategory, syntheticGenes } from "@/lib/synthetic-genes"
import { SyntheticGene } from "@/lib/types"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// 2A self-cleaving peptide sequences
const TWO_A_SEQUENCES = {
  P2A: 'ATNFSLLKQAGDVEENPGP',
  T2A: 'EGRGSLLTCGDVEENPGP',
  E2A: 'QCTNYALLKLAGDVESNPGP',
  F2A: 'VKQTLNFDLLKLAGDVESNPGP'
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
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [sequenceName, setSequenceName] = useState("")
  const [add2ASequence, setAdd2ASequence] = useState(true)
  const [twoAType] = useState<keyof typeof TWO_A_SEQUENCES>('T2A')

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "fluorescent", label: "Fluorescent Proteins" },
    { value: "reporter", label: "Reporter Genes" }
  ]

  const allGenes = searchSyntheticGenes(searchTerm).filter(g => g.category !== 'custom' && g.category !== 'placeholder')
  const filteredGenes = selectedCategory === "all" 
    ? allGenes
    : getSyntheticGenesByCategory(selectedCategory).filter(gene => 
        gene.category !== 'custom' &&
        gene.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gene.description.toLowerCase().includes(searchTerm.toLowerCase())
      )

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

  // Clicking a gene populates the editor fields; final add still uses the custom submit

  const handleGeneSelect = (gene: SyntheticGene) => {
    setSequenceName(gene.name)
    setCustomSequence(gene.sequence)
  }

  // No separate confirmation dialog now; the main form handles submission

  return (
    <>
      <Card className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Select Synthetic Gene for Knock-in</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
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

        {/* Name */}
        <div>
          <Label className="font-semibold">Name</Label>
          <Input placeholder="e.g. GFP" value={sequenceName} onChange={(e) => setSequenceName(e.target.value)} />
        </div>

        {/* Custom Sequence Input */}
        <div className="border rounded-lg p-4">
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
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search synthetic genes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gene List */}
        <div className="max-h-96 overflow-y-auto space-y-2">
          {filteredGenes.map(gene => (
            <Card key={gene.id} className="p-4 hover:bg-muted/50 cursor-pointer" onClick={() => handleGeneSelect(gene)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{gene.name}</h4>
                    <Badge variant="secondary" className="text-xs">{gene.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{gene.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {gene.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Card>
    </>
  )
} 