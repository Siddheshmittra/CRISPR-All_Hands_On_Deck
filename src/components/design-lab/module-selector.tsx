import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ModuleButton } from "@/components/ui/module-button"
import { Search, Plus } from "lucide-react"

interface Module {
  id: string
  name: string
  type: "overexpression" | "knockout" | "knockdown"
  description?: string
}

interface ModuleSelectorProps {
  selectedModules: Module[]
  onModuleSelect: (module: Module) => void
  onModuleDeselect: (moduleId: string) => void
}

const predefinedModules: Module[] = [
  { id: "BATF", name: "BATF", type: "overexpression" },
  { id: "IRF4", name: "IRF4", type: "overexpression" },
  { id: "c-Jun", name: "c-Jun", type: "overexpression" },
  { id: "IL-21", name: "IL-21", type: "overexpression" },
  { id: "dnFD-1", name: "dnFD-1", type: "knockout" },
  { id: "BCL6", name: "BCL6", type: "knockout" },
  { id: "KO-PDCD1", name: "KO-PDCD1", type: "knockout" },
  { id: "KO-CTLA4", name: "KO-CTLA4", type: "knockout" },
  { id: "KO-LAG3", name: "KO-LAG3", type: "knockout" },
  { id: "KO-TGK", name: "KO-TGK", type: "knockout" },
  { id: "KO-TET2", name: "KO-TET2", type: "knockout" },
  { id: "KD-SOcs1", name: "KD-SOcs1", type: "knockdown" },
  { id: "KD-CRLS", name: "KD-CRLS", type: "knockdown" },
  { id: "KD-NFKBIA", name: "KD-NFKBIA", type: "knockdown" },
  { id: "KD-TGFBR1", name: "KD-TGFBR1", type: "knockdown" },
  { id: "KU-IL2RA", name: "KU-IL2RA", type: "overexpression" },
  { id: "KU-TBXAS1", name: "KU-TBXAS1", type: "overexpression" },
  { id: "KU-IFNG", name: "KU-IFNG", type: "overexpression" },
  { id: "KU-GZMB", name: "KU-GZMB", type: "overexpression" }
]

export const ModuleSelector = ({ selectedModules, onModuleSelect, onModuleDeselect }: ModuleSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredModules = predefinedModules.filter(module =>
    module.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const isSelected = (moduleId: string) => 
    selectedModules.some(m => m.id === moduleId)

  const handleModuleClick = (module: Module) => {
    if (isSelected(module.id)) {
      onModuleDeselect(module.id)
    } else {
      onModuleSelect(module)
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">2. Select Modules</h2>
      
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search or enter gene symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="secondary" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Sorted by NCBI GeneBank
      </p>

      <div className="flex flex-wrap gap-2">
        {filteredModules.map((module) => (
          <ModuleButton
            key={module.id}
            moduleType={module.type}
            isSelected={isSelected(module.id)}
            onClick={() => handleModuleClick(module)}
          >
            {module.name}
          </ModuleButton>
        ))}
      </div>
    </Card>
  )
}