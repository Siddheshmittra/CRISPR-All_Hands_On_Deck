import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface MultiCassetteDialogProps {
  open: boolean
  cassetteCount: number
  modulesPerCassette: number
  setCassetteCount: (n: number) => void
  setModulesPerCassette: (n: number) => void
  onClose: () => void
}

export const MultiCassetteDialog = ({
  open,
  cassetteCount,
  modulesPerCassette,
  setCassetteCount,
  setModulesPerCassette,
  onClose
}: MultiCassetteDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Multi-Cassette Setup</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">Number of Cassettes</label>
            <Input
              type="number"
              min={1}
              value={cassetteCount}
              onChange={(e) => setCassetteCount(parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Perturbations per Cassette</label>
            <Input
              type="number"
              min={1}
              value={modulesPerCassette}
              onChange={(e) => setModulesPerCassette(parseInt(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
