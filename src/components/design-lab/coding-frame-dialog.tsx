import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface CodingFrameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (endsCodingFrame: boolean) => void
  geneName: string
}

export function CodingFrameDialog({ open, onOpenChange, onConfirm, geneName }: CodingFrameDialogProps) {
  const [endsCodingFrame, setEndsCodingFrame] = useState<boolean>(true)

  const handleConfirm = () => {
    onConfirm(endsCodingFrame)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sequence Information</DialogTitle>
          <DialogDescription>
            Does the sequence for <span className="font-semibold">{geneName}</span> end a coding frame?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <RadioGroup 
            value={endsCodingFrame ? "yes" : "no"} 
            onValueChange={(value) => setEndsCodingFrame(value === "yes")}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="coding-frame-yes" />
              <Label htmlFor="coding-frame-yes">Yes - This is a complete coding sequence</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="coding-frame-no" />
              <Label htmlFor="coding-frame-no">No - This is a partial sequence</Label>
            </div>
          </RadioGroup>
          
          <div className="mt-4 text-sm text-muted-foreground">
            {endsCodingFrame 
              ? "A stop codon will be added if not present." 
              : "A 2A self-cleaving peptide sequence will be added to enable polycistronic expression."}
            }
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
