import { FlaskConical, Dna } from "lucide-react"

export const Header = () => {
  return (
    <div className="bg-gradient-primary text-primary-foreground p-6 rounded-t-lg">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-8 w-8" />
          <Dna className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">CRISPR-ALL Design Lab</h1>
          <p className="text-sm opacity-90 mt-1">
            A tool to design modular, combinatorial genetic perturbations in primary human T cells.
          </p>
          <p className="text-xs opacity-75">
            (Courtesy of the lab of Dr. Theodore Roth)
          </p>
        </div>
      </div>
    </div>
  )
}