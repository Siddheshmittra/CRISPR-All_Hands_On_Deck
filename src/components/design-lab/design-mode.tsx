import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"

interface DesignModeProps {
  mode: "single" | "multi"
  onModeChange: (mode: "single" | "multi") => void
}

export const DesignMode = ({ mode, onModeChange }: DesignModeProps) => {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">1. Design Mode</h2>
      <RadioGroup value={mode} onValueChange={(value) => onModeChange(value as "single" | "multi")}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="single" id="single" />
          <Label htmlFor="single">Single Cassette</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="multi" id="multi" />
          <Label htmlFor="multi">Multi-Cassette</Label>
        </div>
      </RadioGroup>
    </Card>
  )
}