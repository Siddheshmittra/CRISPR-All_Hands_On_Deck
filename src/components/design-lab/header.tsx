import React from "react"
import RothDark from "@/lib/Rothlabdark.png"
// ThemeToggle is globally floating; don't render in header

const NUCLEOTIDES = ["A", "C", "G", "T"]

function useNucleotideScramble(target: string, speedMs: number = 30, start: boolean = false) {
  const [display, setDisplay] = React.useState<string>(target)
  const frameRef = React.useRef<number | null>(null)
  const startTimeRef = React.useRef<number | null>(null)
  const targetRef = React.useRef<string>(target)

  React.useEffect(() => { targetRef.current = target }, [target])

  React.useEffect(() => {
    if (!start) return () => {}
    cancelAnimationFrame(frameRef.current || 0)
    startTimeRef.current = null

    const animate = (ts: number) => {
      if (startTimeRef.current == null) startTimeRef.current = ts
      const elapsed = ts - startTimeRef.current
      const lockCount = Math.min(targetRef.current.length, Math.floor(elapsed / speedMs))
      const locked = targetRef.current.slice(0, lockCount)
      const remainingCount = targetRef.current.length - lockCount
      const scrambled = Array.from({ length: Math.max(remainingCount, 0) }, () =>
        NUCLEOTIDES[Math.floor(Math.random() * NUCLEOTIDES.length)]
      ).join("")
      setDisplay(locked + scrambled)
      if (lockCount < targetRef.current.length) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(targetRef.current)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [start, speedMs])

  return display
}

export const Header = () => {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)
  const [stuck, setStuck] = React.useState(false)
  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      // When the sentinel scrolls out of view, the header has reached the top and is sticky
      setStuck(!entry.isIntersecting)
    }, { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const title = "CRISPR-All Hands On Deck!"
  const display = useNucleotideScramble(title, 45, stuck)

  return (
    <>
      {/* Sentinel used to detect when header becomes sticky */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div className="w-full sticky top-0 z-50" ref={containerRef}>
      {/* Top bar with logo */}
      <div className="bg-card w-full py-6 px-8 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              {/* Light logo */}
              <img
                src="/images/Roth.png"
                alt="Roth Lab Logo"
                width={260}
                className="object-contain block dark:hidden"
              />
              {/* Dark logo */}
              <img
                src={RothDark}
                alt="Roth Lab Logo (Dark)"
                width={260}
                className="object-contain hidden dark:block"
              />
            </div>
            <div className="flex items-center gap-4">
              {stuck && (
                <div className="text-right">
                  <div className="text-3xl font-bold text-foreground font-mono select-none">
                    {(() => {
                      const full = title
                      const idxPrefixEnd = "CRISPR-All ".length
                      const idxHandsStart = full.indexOf("Hands")
                      const idxHandsEnd = idxHandsStart + "Hands".length
                      const idxOnStart = full.indexOf("On", idxHandsEnd)
                      const idxOnEnd = idxOnStart + "On".length
                      const idxDeckStart = full.indexOf("Deck", idxOnEnd)
                      const idxDeckEnd = idxDeckStart + "Deck".length
                      const idxBang = full.indexOf("!", idxDeckEnd)

                      const chars: JSX.Element[] = []
                      for (let i = 0; i < display.length; i++) {
                        let cls = "text-foreground"
                        if (i >= idxHandsStart && i < idxHandsEnd) cls = "text-[hsl(66,70%,47%)] dark:text-[hsl(66,70%,55%)] italic"
                        else if (i >= idxOnStart && i < idxOnEnd) cls = "text-[hsl(13,95%,59%)] dark:text-[hsl(13,95%,65%)] italic"
                        else if (i >= idxDeckStart && i < idxDeckEnd) cls = "text-[hsl(32,75%,49%)] dark:text-[hsl(32,75%,55%)] italic"
                        else if (i === idxBang) cls = "text-[hsl(220,35%,65%)] dark:text-[hsl(220,35%,70%)] italic"
                        else if (i < idxPrefixEnd) cls = "text-foreground"
                        chars.push(<span key={i} className={cls}>{display[i]}</span>)
                      }
                      return chars
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}