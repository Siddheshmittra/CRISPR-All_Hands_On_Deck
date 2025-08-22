import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface CodingFrameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // onConfirm now reports whether a 2A/multicistronic element should be added
  onConfirm: (addTwoA: boolean) => void
  geneName: string
}

export function CodingFrameDialog({ open, onOpenChange, onConfirm, geneName }: CodingFrameDialogProps) {
  // true => YES: add 2A
  const [addTwoA, setAddTwoA] = useState<boolean>(true)

  const handleConfirm = () => {
    onConfirm(addTwoA)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sequence Information</DialogTitle>
          <DialogDescription>
            For <span className="font-semibold">{geneName}</span>, should we add a multicistronic element?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <RadioGroup 
            value={addTwoA ? "yes" : "no"} 
            onValueChange={(value) => setAddTwoA(value === "yes")}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="coding-frame-yes" />
              <Label htmlFor="coding-frame-yes">Yes - A 2A self-cleaving peptide sequence will be added to enable polycistronic expression.</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="coding-frame-no" />
              <Label htmlFor="coding-frame-no">No - No 2A or other multicistronic element will be added, next element in CRISPR-All Syntax should be another domain that continues this domain's reading frame</Label>
            </div>
          </RadioGroup>
          
          <div className="mt-4 text-sm text-muted-foreground">
            {addTwoA 
              ? "A 2A self-cleaving peptide sequence will be added to enable polycistronic expression." 
              : "No 2A or other multicistronic element will be added. Continue this domain's reading frame in the next element."}
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
