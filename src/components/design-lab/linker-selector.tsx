import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { linkerOptions } from '@/hooks/use-linker-options'
import { Label } from '../ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface LinkerSelectorProps {
  selectedLinker: string
  onLinkerChange: (linkerId: string) => void
  autoLink: boolean
  onAutoLinkChange: (autoLink: boolean) => void
}

export const LinkerSelector: React.FC<LinkerSelectorProps> = ({
  selectedLinker,
  onLinkerChange,
  autoLink,
  onAutoLinkChange
}) => {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/40">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="auto-link-checkbox"
          checked={autoLink}
          onChange={(e) => onAutoLinkChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <Label htmlFor="auto-link-checkbox" className="text-sm font-medium">
          Auto-insert linker
        </Label>
      </div>
      {autoLink && (
        <div className="flex items-center gap-2">
          <Label className="text-sm">Linker:</Label>
          <Select value={selectedLinker} onValueChange={onLinkerChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select a linker" />
            </SelectTrigger>
            <SelectContent>
              {linkerOptions.map((option) => (
                <TooltipProvider key={option.id} delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value={option.id}>
                        <span>{option.name}</span>
                      </SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start">
                      <p className="font-semibold">{option.name}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                      <p className="text-xs font-mono mt-2 bg-muted p-1 rounded">
                        {option.sequence}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
} 