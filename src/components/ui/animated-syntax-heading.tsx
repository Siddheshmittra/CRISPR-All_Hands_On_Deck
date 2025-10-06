import React from "react"

interface AnimatedSyntaxHeadingProps {
  className?: string
}

const LETTERS = ["S", "y", "n", "t", "a", "x"]
const MODULE_COLORS = [
  "bg-[hsl(66,70%,85%)] text-[hsl(66,70%,25%)] border-[hsl(66,70%,60%)]", // OE - lime-ish
  "bg-[hsl(13,95%,85%)] text-[hsl(13,95%,25%)] border-[hsl(13,95%,60%)]",  // KO - red-orange
  "bg-[hsl(32,75%,85%)] text-[hsl(32,75%,25%)] border-[hsl(32,75%,60%)]",  // KD - orange
  "bg-[hsl(220,35%,85%)] text-[hsl(220,35%,25%)] border-[hsl(220,35%,60%)]", // KI - blue-ish
]

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function AnimatedSyntaxHeading({ className }: AnimatedSyntaxHeadingProps) {
  const [displayOrder, setDisplayOrder] = React.useState<number[]>([0, 1, 2, 3, 4, 5])
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  const containerRef = React.useRef<HTMLHeadingElement | null>(null)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
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
  }, [])

  React.useEffect(() => {
    if (!visible) return
    setIsAnimating(true)

    // Shuffle multiple times over ~1.2 seconds
    const shuffleInterval = setInterval(() => {
      setDisplayOrder(shuffle([0, 1, 2, 3, 4, 5]))
    }, 80)

    // After 1.2s, snap to final order
    const snapTimeout = setTimeout(() => {
      clearInterval(shuffleInterval)
      setDisplayOrder([0, 1, 2, 3, 4, 5])
      setIsAnimating(false)
    }, 1200)

    return () => {
      clearInterval(shuffleInterval)
      clearTimeout(snapTimeout)
    }
  }, [visible])

  return (
    <h2 ref={containerRef} className={className} aria-label="2. Syntax">
      <span className="inline-block mr-2">2.</span>
      <span className="inline-flex gap-1">
        {displayOrder.map((letterIndex, posIndex) => (
          <span
            key={posIndex}
            className={`inline-block px-2 py-1 rounded border font-bold text-sm transition-all duration-300 ${
              MODULE_COLORS[letterIndex % MODULE_COLORS.length]
            } ${isAnimating ? "scale-110" : "scale-100"}`}
            style={{
              transitionProperty: "transform, opacity",
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

