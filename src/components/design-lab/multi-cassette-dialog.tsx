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
  const totalPerturbations =
    (Number(overexpressionCount) || 0) +
    (Number(knockoutCount) || 0) +
    (Number(knockdownCount) || 0)
  const maxPerturbations = 5
  const overLimit = totalPerturbations > maxPerturbations

  // Helper for input: allow empty, clamp, no leading zeros
  function handleCountChange(setter: (n: number) => void, value: string) {
    if (value === "") {
      setter(0)
      return
    }
    // Remove leading zeros
    const sanitized = value.replace(/^0+(?!$)/, "")
    let n = parseInt(sanitized, 10)
    if (isNaN(n) || n < 0) n = 0
    if (n > maxPerturbations) n = maxPerturbations
    setter(n)
  }

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
            max={maxPerturbations}
            value={overexpressionCount === 0 ? "" : overexpressionCount}
            onChange={e => handleCountChange(setOverexpressionCount, e.target.value)}
            disabled={overLimit && overexpressionCount === 0}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs font-semibold">Knockout</label>
          <Input
            type="number"
            min={0}
            max={maxPerturbations}
            value={knockoutCount === 0 ? "" : knockoutCount}
            onChange={e => handleCountChange(setKnockoutCount, e.target.value)}
            disabled={overLimit && knockoutCount === 0}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs font-semibold">Knockdown</label>
          <Input
            type="number"
            min={0}
            max={maxPerturbations}
            value={knockdownCount === 0 ? "" : knockdownCount}
            onChange={e => handleCountChange(setKnockdownCount, e.target.value)}
            disabled={overLimit && knockdownCount === 0}
          />
        </div>
      </div>
      <div className={`mt-2 text-sm ${overLimit ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
        Total perturbations: {totalPerturbations} / {maxPerturbations}
        {overLimit && <span> &mdash; Maximum is {maxPerturbations} per cassette</span>}
      </div>
    </Card>
  )
}
