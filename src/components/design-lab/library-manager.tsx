import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, Plus, Trash2, Library } from "lucide-react"

interface Module {
  id: string
  name: string
  type: "overexpression" | "knockout" | "knockdown"
  description?: string
  sequence?: string
}

interface LibraryManagerProps {
  customModules: Module[]
  onCustomModulesChange: (modules: Module[]) => void
  constructModules: Module[]
  onConstructModulesChange: (modules: Module[]) => void
}

export const LibraryManager = ({ customModules, onCustomModulesChange, constructModules, onConstructModulesChange }: LibraryManagerProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newModule, setNewModule] = useState({ name: "", type: "overexpression" as const, sequence: "" })
  
  const handleImportLibrary = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const imported = JSON.parse(e.target?.result as string)
            onCustomModulesChange([...customModules, ...imported])
          } catch (error) {
            console.error('Failed to import library:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleExportLibrary = () => {
    const dataStr = JSON.stringify(customModules, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'gene-library.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleCreateModule = () => {
    if (newModule.name.trim()) {
      const module: Module = {
        id: `custom-${Date.now()}`,
        name: newModule.name.trim(),
        type: newModule.type,
        description: "Custom module",
        sequence: newModule.sequence || ""
      }
      onCustomModulesChange([...customModules, module])
      setNewModule({ name: "", type: "overexpression", sequence: "" })
      setIsCreateOpen(false)
    }
  }

  const handleDeleteCustomModule = (moduleId: string) => {
    onCustomModulesChange(customModules.filter(m => m.id !== moduleId))
    // Remove all instances from construct layout
    const baseId = moduleId.split('-')[0]
    onConstructModulesChange(constructModules.filter(m => !m.id.startsWith(baseId)))
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Library Manager</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImportLibrary}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportLibrary}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Module</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Gene Symbol</label>
                  <Input
                    placeholder="e.g., CUSTOM-GENE"
                    value={newModule.name}
                    onChange={(e) => setNewModule({ ...newModule, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Type</label>
                  <select
                    value={newModule.type}
                    onChange={(e) => setNewModule({ ...newModule, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-input rounded-md"
                  >
                    <option value="overexpression">Overexpression</option>
                    <option value="knockout">Knockout</option>
                    <option value="knockdown">Knockdown</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Nucleotide Sequence</label>
                  <Textarea
                    placeholder="e.g., ATGCGT..."
                    value={newModule.sequence}
                    onChange={(e) => setNewModule({ ...newModule, sequence: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>
                <Button onClick={handleCreateModule} className="w-full">
                  Create Module
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        {customModules.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Custom Modules ({customModules.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {customModules.map((module) => (
                <div key={module.id} className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {module.name}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCustomModule(module.id)}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}