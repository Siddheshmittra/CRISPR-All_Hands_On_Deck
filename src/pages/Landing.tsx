import React from "react"
import { ChevronDown } from "lucide-react"
// Theme toggle floats globally; no local toggle here
import Index from "./Index"

const NUCLEOTIDES = ["A", "C", "G", "T"]

function useNucleotideScramble(target: string, speedMs: number = 30) {
  const [display, setDisplay] = React.useState<string>("")
  const frameRef = React.useRef<number | null>(null)
  const startTimeRef = React.useRef<number | null>(null)
  const targetRef = React.useRef<string>(target)

  React.useEffect(() => {
    targetRef.current = target
    // Kick off a new animation whenever target changes
    cancelAnimationFrame(frameRef.current || 0)
    startTimeRef.current = null

    const animate = (ts: number) => {
      if (startTimeRef.current == null) startTimeRef.current = ts
      const elapsed = ts - startTimeRef.current
      // Determine how many characters should be locked-in based on elapsed time
      const lockCount = Math.min(
        targetRef.current.length,
        Math.floor(elapsed / speedMs)
      )
      const locked = targetRef.current.slice(0, lockCount)
      const remainingCount = targetRef.current.length - lockCount

      // For the remaining characters, show random nucleotides to simulate scramble
      const scrambled = Array.from({ length: Math.max(remainingCount, 0) }, () =>
        NUCLEOTIDES[Math.floor(Math.random() * NUCLEOTIDES.length)]
      ).join("")

      setDisplay(locked + scrambled)

      if (lockCount < targetRef.current.length) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        // Ensure final exact target text
        setDisplay(targetRef.current)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, speedMs])

  return display
}

const Landing = () => {
  const title = "CRISPR-All Studio!"
  const display = useNucleotideScramble(title, 45)
  const designRef = React.useRef<HTMLDivElement | null>(null)

  return (
    <div className="bg-background">
      <div className="min-h-screen grid place-items-center px-4 sm:px-6 lg:px-8 relative bg-background dark:bg-card">
        {/* Theme toggle removed here (now global floating) */}

        <div className="text-center">
          <div className="text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight">
            <span className="font-mono select-none">
              {(() => {
                const full = title
                const idxPrefixEnd = "CRISPR-All ".length
                const idxStudioStart = full.indexOf("Studio")
                const paletteByIndex = new Map<number, string>()

                const studioPalette = [
                  "text-[hsl(66,70%,47%)] dark:text-[hsl(66,70%,58%)] italic", // Overexpression green
                  "text-[hsl(13,95%,59%)] dark:text-[hsl(13,95%,66%)] italic", // Knockout coral
                  "text-[hsl(32,75%,49%)] dark:text-[hsl(32,75%,56%)] italic", // Knockdown amber
                  "text-[hsl(201,62%,55%)] dark:text-[hsl(201,62%,65%)] italic", // Knock-in teal
                  "text-[hsl(66,70%,52%)] dark:text-[hsl(66,70%,62%)] italic", // Bright overexpression accent
                  "text-[hsl(32,75%,57%)] dark:text-[hsl(32,75%,65%)] italic" // Bright knockdown accent
                ]

                if (idxStudioStart >= 0) {
                  studioPalette.forEach((cls, offset) => {
                    paletteByIndex.set(idxStudioStart + offset, cls)
                  })
                }

                const idxBang = full.indexOf("!", idxStudioStart >= 0 ? idxStudioStart : 0)
                if (idxBang >= 0) {
                  paletteByIndex.set(idxBang, "text-[hsl(210,55%,55%)] dark:text-[hsl(210,55%,65%)] italic")
                }

                const result: JSX.Element[] = []
                for (let i = 0; i < display.length; i++) {
                  let cls = "text-foreground"
                  if (paletteByIndex.has(i)) cls = paletteByIndex.get(i)!
                  else if (i < idxPrefixEnd) cls = "text-foreground"
                  result.push(
                    <span key={i} className={cls}>
                      {display[i]}
                    </span>
                  )
                }
                return result
              })()}
            </span>
          </div>
        </div>

        <button
          onClick={() => designRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-8 inline-flex flex-col items-center text-muted-foreground hover:text-foreground transition"
        >
          <ChevronDown className="h-6 w-6 animate-bounce" />
        </button>
      </div>

      <div ref={designRef} id="design-start">
        <Index />
      </div>
    </div>
  )
}

export default Landing
