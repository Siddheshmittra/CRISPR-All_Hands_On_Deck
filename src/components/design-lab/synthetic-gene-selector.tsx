import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, X } from "lucide-react"
import { SyntheticGene, searchSyntheticGenes, getSyntheticGenesByCategory } from "@/lib/synthetic-genes"

interface SyntheticGeneSelectorProps {
  onGeneSelect: (gene: SyntheticGene) => void
  onCustomSequence: (sequence: string) => void
  onClose: () => void
}

export const SyntheticGeneSelector = ({ onGeneSelect, onCustomSequence, onClose }: SyntheticGeneSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [customSequence, setCustomSequence] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)

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
    if (customSequence.trim()) {
      onCustomSequence(customSequence.trim())
      onClose()
    }
  }

  return (
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustomInput(!showCustomInput)}
            >
              {showCustomInput ? "Hide" : "Add Custom"}
            </Button>
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
            <Card key={gene.id} className="p-4 hover:bg-muted/50 cursor-pointer" onClick={() => onGeneSelect(gene)}>
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
  )
} 