import { FlaskConical, Dna } from "lucide-react"

export const Header = () => {
  return (
    <div className="w-full">
      {/* White top bar with logo */}
      <div className="bg-white w-full py-6 px-8 border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <img 
                src="/images/Roth.png" 
                alt="Roth Lab Logo" 
                width={300}
                className="object-contain"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
              <h1 className="text-2xl font-bold text-gray-900">
  CRISPR-All <span className="italic">Hands On Deck!</span>
</h1>
                <p className="text-sm text-gray-600">
                  Design modular, combinatorial genetic perturbations in primary human T cells.
                </p>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <FlaskConical className="h-8 w-8" />
                <Dna className="h-8 w-8" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}