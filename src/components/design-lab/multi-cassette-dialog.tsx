import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface MultiCassetteSetupProps {
  cassetteCount: number
  setCassetteCount: (n: number) => void
  overexpressionCount: number
  setOverexpressionCount: (n: number) => void
  knockoutCount: number
  setKnockoutCount: (n: number) => void
  knockdownCount: number
  setKnockdownCount: (n: number) => void
}

export const MultiCassetteSetup = ({
  cassetteCount,
  setCassetteCount,
  overexpressionCount,
  setOverexpressionCount,
  knockoutCount,
  setKnockoutCount,
  knockdownCount,
  setKnockdownCount
}: MultiCassetteSetupProps) => {
  return (
    <Card className="p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4">Multi-Cassette Setup</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block mb-1 text-sm font-medium">Number of Cassettes</label>
          <Input
            type="number"
            min={1}
            value={cassetteCount}
            onChange={e => setCassetteCount(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
      </div>
      <div className="mb-2 font-medium">Perturbations per Cassette</div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block mb-1 text-xs font-semibold">Overexpression</label>
          <Input
            type="number"
            min={0}
            value={overexpressionCount}
            onChange={e => setOverexpressionCount(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs font-semibold">Knockout</label>
          <Input
            type="number"
            min={0}
            value={knockoutCount}
            onChange={e => setKnockoutCount(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs font-semibold">Knockdown</label>
          <Input
            type="number"
            min={0}
            value={knockdownCount}
            onChange={e => setKnockdownCount(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
      </div>
    </Card>
  )
}
