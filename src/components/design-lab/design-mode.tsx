import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface DesignModeProps {
  cassetteMode: "single" | "multi"
  onCassetteModeChange: (mode: "single" | "multi") => void
  inputMode: "manual" | "natural"
  onInputModeChange: (mode: "manual" | "natural") => void
}

export const DesignMode = ({ cassetteMode, onCassetteModeChange, inputMode, onInputModeChange }: DesignModeProps) => {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Mode Selector</h2>
      <div className="flex flex-col gap-4">
        <div>
          <span className="block text-sm font-semibold mb-2">Cassette Mode</span>
          <div className="flex gap-3">
            <Button
              variant={cassetteMode === "single" ? "default" : "outline"}
              onClick={() => onCassetteModeChange("single")}
              className="flex-1"
            >
              Single Cassette
            </Button>
            <Button
              variant={cassetteMode === "multi" ? "default" : "outline"}
              onClick={() => onCassetteModeChange("multi")}
              className="flex-1"
            >
              Multi-Cassette
            </Button>
          </div>
        </div>
        <div>
          <span className="block text-sm font-semibold mb-2">Input Mode</span>
          <div className="flex gap-3">
            <Button
              variant={inputMode === "manual" ? "default" : "outline"}
              onClick={() => onInputModeChange("manual")}
              className="flex-1"
            >
              Manual
            </Button>
            <Button
              variant={inputMode === "natural" ? "default" : "outline"}
              onClick={() => onInputModeChange("natural")}
              className="flex-1"
            >
              Natural Language
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}