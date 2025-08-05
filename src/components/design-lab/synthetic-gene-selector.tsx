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
import { CodingFrameDialog } from "./coding-frame-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// 2A self-cleaving peptide sequences
const TWO_A_SEQUENCES = {
  P2A: 'ATNFSLLKQAGDVEENPGP',
  T2A: 'EGRGSLLTCGDVEENPGP',
  E2A: 'QCTNYALLKLAGDVESNPGP',
  F2A: 'VKQTLNFDLLKLAGDVESNPGP'
}

interface SyntheticGeneSelectorProps {
  onGeneSelect: (gene: SyntheticGene, options?: { add2ASequence?: boolean, twoAType?: keyof typeof TWO_A_SEQUENCES }) => void
  onCustomSequence: (sequence: string, options: { endsCodingFrame: boolean, add2ASequence?: boolean, twoAType?: keyof typeof TWO_A_SEQUENCES }) => void
  onClose: () => void
}

export const SyntheticGeneSelector = ({ onGeneSelect, onCustomSequence, onClose }: SyntheticGeneSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [customSequence, setCustomSequence] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [showCodingFrameDialog, setShowCodingFrameDialog] = useState(false)
  const [pendingSequence, setPendingSequence] = useState("")
  const [pendingGene, setPendingGene] = useState<string | null>(null)
  const [add2ASequence, setAdd2ASequence] = useState(false)
  const [twoAType, setTwoAType] = useState<keyof typeof TWO_A_SEQUENCES>('P2A')
  const [show2AMenu, setShow2AMenu] = useState(false)

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "fluorescent", label: "Fluorescent Proteins" },
    { value: "reporter", label: "Reporter Genes" },
    { value: "custom", label: "Custom Sequences" }
  ]

  const filteredGenes = selectedCategory === "all" 
    ? searchSyntheticGenes(searchTerm)
    : getSyntheticGenesByCategory(selectedCategory).filter(gene => 
        gene.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gene.description.toLowerCase().includes(searchTerm.toLowerCase())
      )

  const handleCustomSequenceSubmit = () => {
    const sequence = customSequence.trim()
    if (sequence) {
      setPendingSequence(sequence)
      setPendingGene("Custom Sequence")
      setShowCodingFrameDialog(true)
    }
  }

  const handle2ASelection = (type: keyof typeof TWO_A_SEQUENCES) => {
    setTwoAType(type)
    setShow2AMenu(false)
  }

  const handleGeneSelect = (gene: SyntheticGene) => {
    setPendingGene(gene.name)
    setPendingSequence(gene.sequence)
    setShowCodingFrameDialog(true)
  }

  const handleCodingFrameConfirm = (endsCodingFrame: boolean) => {
    if (pendingSequence) {
      const options = {
        endsCodingFrame,
        add2ASequence: !endsCodingFrame && add2ASequence,
        twoAType: !endsCodingFrame && add2ASequence ? twoAType : undefined
      }
      
      if (pendingGene === "Custom Sequence") {
        onCustomSequence(pendingSequence, options)
      } else {
        onGeneSelect({
          ...syntheticGenes.find(g => g.name === pendingGene)!,
          sequence: pendingSequence
        }, {
          add2ASequence: options.add2ASequence,
          twoAType: options.twoAType
        })
      }
      
      setPendingSequence("")
      setPendingGene(null)
      onClose()
    }
  }

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

        {/* Custom Sequence Input */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="font-semibold">Custom Synthetic Sequence</Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Popover open={show2AMenu} onOpenChange={setShow2AMenu}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant={add2ASequence ? "default" : "outline"} 
                      size="sm"
                      className={cn("h-8 px-2 text-xs", add2ASequence ? "bg-primary/90" : "")}
                      onClick={(e) => {
                        e.stopPropagation()
                        setShow2AMenu(!show2AMenu)
                      }}
                    >
                      {add2ASequence ? (
                        <span className="flex items-center">
                          {twoAType}
                          <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                        </span>
                      ) : (
                        <span>Add 2A</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="end">
                    <div className="space-y-1">
                      <div 
                        className="flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer"
                        onClick={() => {
                          setAdd2ASequence(true)
                          setTwoAType('P2A')
                          setShow2AMenu(false)
                        }}
                      >
                        <span>P2A</span>
                        {add2ASequence && twoAType === 'P2A' && <Check className="h-4 w-4" />}
                      </div>
                      <div 
                        className="flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer"
                        onClick={() => {
                          setAdd2ASequence(true)
                          setTwoAType('T2A')
                          setShow2AMenu(false)
                        }}
                      >
                        <span>T2A</span>
                        {add2ASequence && twoAType === 'T2A' && <Check className="h-4 w-4" />}
                      </div>
                      <div 
                        className="flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer"
                        onClick={() => {
                          setAdd2ASequence(true)
                          setTwoAType('E2A')
                          setShow2AMenu(false)
                        }}
                      >
                        <span>E2A</span>
                        {add2ASequence && twoAType === 'E2A' && <Check className="h-4 w-4" />}
                      </div>
                      <div 
                        className="flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer"
                        onClick={() => {
                          setAdd2ASequence(true)
                          setTwoAType('F2A')
                          setShow2AMenu(false)
                        }}
                      >
                        <span>F2A</span>
                        {add2ASequence && twoAType === 'F2A' && <Check className="h-4 w-4" />}
                      </div>
                      <div 
                        className="flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer"
                        onClick={() => {
                          setAdd2ASequence(false)
                          setShow2AMenu(false)
                        }}
                      >
                        <span className="text-muted-foreground">None</span>
                        {!add2ASequence && <Check className="h-4 w-4" />}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomInput(!showCustomInput)}
              >
                {showCustomInput ? "Hide" : "Add Custom"}
              </Button>
            </div>
          </div>
          {showCustomInput && (
            <div className="space-y-2">
              <Textarea
                placeholder="Enter your custom synthetic gene sequence (DNA)..."
                value={customSequence}
                onChange={(e) => setCustomSequence(e.target.value)}
                className="h-32 font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button onClick={handleCustomSequenceSubmit} disabled={!customSequence.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Sequence
                </Button>
              </div>
            </div>
          )}
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
    
    <CodingFrameDialog
      open={showCodingFrameDialog}
      onOpenChange={setShowCodingFrameDialog}
      onConfirm={handleCodingFrameConfirm}
      geneName={pendingGene || ""}
    />
    </>
  )
} 