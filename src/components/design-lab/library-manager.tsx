import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, Plus, Trash2, Library } from "lucide-react"
import { z } from 'zod'
import { toast } from 'sonner'

interface Module {
  id: string
  name: string
  type: "overexpression" | "knockout" | "knockdown"
  description?: string
}

interface LibraryManagerProps {
  customModules: Module[]
  onCustomModulesChange: (modules: Module[]) => void
  constructModules: Module[]
  onConstructModulesChange: (modules: Module[]) => void
}

export const LibraryManager = ({ customModules, onCustomModulesChange, constructModules, onConstructModulesChange }: LibraryManagerProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newModule, setNewModule] = useState({ name: "", type: "overexpression" as const })
  
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
            // Accept either an array of modules or an object with { modules: Module[] }
            const raw = JSON.parse(e.target?.result as string)

            const moduleSchema = z.object({
              id: z.string().min(1).catch(String),
              name: z.string().min(1),
              type: z.enum(["overexpression", "knockout", "knockdown", "knockin", "synthetic"]).catch("overexpression"),
              description: z.string().optional(),
              sequence: z.string().optional(),
              sequenceSource: z.enum(['ensembl_grch38', 'ensembl_grch37', 'shRNA.json', 'gRNA.json']).optional(),
              isSynthetic: z.boolean().optional(),
              syntheticSequence: z.string().optional(),
            })

            const schema = z.union([
              z.array(moduleSchema),
              z.object({ modules: z.array(moduleSchema) })
            ])

            const parsed = schema.parse(raw)
            const modules = Array.isArray(parsed) ? parsed : parsed.modules

            // Normalize names and ensure unique IDs for conflicts
            const existingIds = new Set(customModules.map(m => m.id))
            const normalized = modules.map((m) => {
              const baseId = String(m.id)
              let uniqueId = baseId
              let counter = 1
              while (existingIds.has(uniqueId)) {
                uniqueId = `${baseId}-${counter++}`
              }
              existingIds.add(uniqueId)
              return {
                ...m,
                id: uniqueId,
                name: String(m.name).trim(),
                description: m.description || `Imported module ${m.name}`
              }
            })

            onCustomModulesChange([...customModules, ...normalized])
            toast.success(`Imported ${normalized.length} modules from JSON`)
          } catch (error: any) {
            console.error('Failed to import library:', error)
            toast.error(error?.message || 'Failed to import library JSON')
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
        description: "Custom module"
      }
      onCustomModulesChange([...customModules, module])
      setNewModule({ name: "", type: "overexpression" })
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Library Manager</h2>
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