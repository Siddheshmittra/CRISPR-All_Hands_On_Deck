import React from "react"

interface AnimatedSyntaxHeadingProps {
  className?: string
  storageKey?: string
}

const LETTERS = ["S", "y", "n", "t", "a", "x"]
const MODULE_COLORS = [
  "bg-[hsl(66,70%,70%)] text-white border-[hsl(66,70%,55%)]", // OE - solid lime
  "bg-[hsl(13,95%,65%)] text-white border-[hsl(13,95%,50%)]",  // KO - solid red-orange
  "bg-[hsl(32,75%,60%)] text-white border-[hsl(32,75%,45%)]",  // KD - solid orange
  "bg-[hsl(220,35%,60%)] text-white border-[hsl(220,35%,45%)]", // KI - solid blue
]

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function AnimatedSyntaxHeading({ className, storageKey }: AnimatedSyntaxHeadingProps) {
  const [displayOrder, setDisplayOrder] = React.useState<number[]>([0, 1, 2, 3, 4, 5])
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  const key = React.useMemo(() => storageKey || 'anim:syntax', [storageKey])
  const [played, setPlayed] = React.useState<boolean>(() => {
    try { return sessionStorage.getItem(key) === '1' } catch { return false }
  })
  const containerRef = React.useRef<HTMLHeadingElement | null>(null)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (played) { setVisible(true); return }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [played])

  React.useEffect(() => {
    if (!visible || played) return
    setIsAnimating(true)

    // Shuffle multiple times over ~1.8 seconds with slower, smoother transitions
    const shuffleInterval = setInterval(() => {
      setDisplayOrder(shuffle([0, 1, 2, 3, 4, 5]))
    }, 200)

    // After 1.8s, snap to final order
    const snapTimeout = setTimeout(() => {
      clearInterval(shuffleInterval)
      setDisplayOrder([0, 1, 2, 3, 4, 5])
      setIsAnimating(false)
    }, 1800)

    return () => {
      clearInterval(shuffleInterval)
      clearTimeout(snapTimeout)
    }
  }, [visible, played])

  React.useEffect(() => {
    if (!played && !isAnimating && visible) {
      try { sessionStorage.setItem(key, '1') } catch {}
      setPlayed(true)
    }
  }, [played, isAnimating, visible, key])

  return (
    <h2 ref={containerRef} className={className} aria-label="2. Syntax">
      <span className="inline-block mr-2">2.</span>
      <span className="inline-flex gap-0.5">
        {displayOrder.map((letterIndex, posIndex) => (
          <span
            key={posIndex}
            className={`inline-block px-2 py-1 rounded border font-bold text-sm shadow-sm transition-all duration-500 ease-in-out ${
              MODULE_COLORS[letterIndex % MODULE_COLORS.length]
            } ${isAnimating ? "scale-105 rotate-2" : "scale-100 rotate-0"}`}
            style={{
              transitionProperty: "transform, opacity",
              textShadow: "0 0 0.5px #000, 0 0 1.5px #000"
            }}
          >
            {LETTERS[letterIndex]}
          </span>
        ))}
      </span>
    </h2>
  )
}

export default AnimatedSyntaxHeading

