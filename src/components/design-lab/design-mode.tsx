import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface DesignModeProps {
  mode: "manual" | "natural" | "multi"
  onModeChange: (mode: "manual" | "natural" | "multi") => void
}

export const DesignMode = ({ mode, onModeChange }: DesignModeProps) => {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">1. Design Mode</h2>
      
      <div className="grid grid-cols-3 gap-3">
        <Button
          variant={mode === "manual" ? "default" : "outline"}
          onClick={() => onModeChange("manual")}
          className="flex-1"
        >
          Manual Mode
        </Button>
        
        <Button
          variant={mode === "natural" ? "default" : "outline"}
          onClick={() => onModeChange("natural")}
          className="flex-1"
        >
          Natural Language
        </Button>
        
        <Button
          variant={mode === "multi" ? "default" : "outline"}
          onClick={() => onModeChange("multi")}
          className="flex-1"
        >
          Multi-Cassette
        </Button>
      </div>
    </Card>
  )
}