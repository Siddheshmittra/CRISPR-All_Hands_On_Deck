import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SectionHeading } from "@/components/ui/section-heading"

interface DesignModeProps {
  cassetteMode: "single" | "multi"
  onCassetteModeChange: (mode: "single" | "multi") => void
  inputMode: "manual" | "natural"
  onInputModeChange: (mode: "manual" | "natural") => void
}

export const DesignMode = ({ cassetteMode, onCassetteModeChange, inputMode, onInputModeChange }: DesignModeProps) => {
  return (
    <Card className="p-6 border border-border shadow-sm">
      <SectionHeading className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Mode Selector</h2>
      </SectionHeading>
      <div className="flex flex-col gap-4">
        <div>
          <span className="block text-sm font-semibold mb-2 text-center">Construct Mode</span>
          <div className="flex gap-3">
            <Button
              variant={cassetteMode === "single" ? "default" : "outline"}
              onClick={() => onCassetteModeChange("single")}
              className="flex-1 rounded-full"
            >
              Single Construct
            </Button>
            <Button
              variant={cassetteMode === "multi" ? "default" : "outline"}
              onClick={() => onCassetteModeChange("multi")}
              className="flex-1 rounded-full"
            >
              Multi-Construct
            </Button>
          </div>
        </div>
        <div>
          <span className="block text-sm font-semibold mb-2 text-center">Input Mode</span>
          <div className="flex gap-3">
            <Button
              variant={inputMode === "manual" ? "default" : "outline"}
              onClick={() => onInputModeChange("manual")}
              className="flex-1 rounded-full"
            >
              Manual
            </Button>
            <Button
              variant={inputMode === "natural" ? "default" : "outline"}
              onClick={() => onInputModeChange("natural")}
              className="flex-1 rounded-full"
            >
              Natural Language
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}