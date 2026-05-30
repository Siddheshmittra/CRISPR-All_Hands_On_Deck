import React from "react"

interface AnimatedSyntaxHeadingProps {
  className?: string
  storageKey?: string // retained for backward compatibility; not used for gating
}

const LETTERS = ["S", "y", "n", "t", "a", "x"]
const MODULE_COLORS = [
  "bg-[hsl(66,70%,70%)] text-white border-[hsl(66,70%,55%)]",
  "bg-[hsl(13,95%,65%)] text-white border-[hsl(13,95%,50%)]",
  "bg-[hsl(32,75%,60%)] text-white border-[hsl(32,75%,45%)]",
  "bg-[hsl(201,62%,65%)] text-white border-[hsl(201,62%,50%)]",
]

type Offset = { x: number; y: number; rotate: number }

const COOLDOWN_MS = 2600
const STAGGER_MS = 140

function generateOffsets(): Offset[] {
  return LETTERS.map(() => {
    const direction = Math.random() > 0.5 ? 1 : -1
    return {
      x: direction * (6 + Math.random() * 14),
      y: -16 - Math.random() * 18,
      rotate: direction * (3 + Math.random() * 6),
    }
  })
}

export function AnimatedSyntaxHeading({ className }: AnimatedSyntaxHeadingProps) {
  const [activeIndex, setActiveIndex] = React.useState<number>(-1)
  const [isAnimating, setIsAnimating] = React.useState(false)
  const containerRef = React.useRef<HTMLHeadingElement | null>(null)
  const lastStartRef = React.useRef<number>(0)
  const timeoutsRef = React.useRef<number[]>([])
  const offsetsRef = React.useRef<Offset[]>(generateOffsets())
  const isAnimatingRef = React.useRef(false)

  const clearTimers = React.useCallback(() => {
    for (const id of timeoutsRef.current) {
      clearTimeout(id)
    }
    timeoutsRef.current = []
  }, [])

  const triggerAnimation = React.useCallback((opts?: { force?: boolean }) => {
    const now = Date.now()
    if (isAnimatingRef.current) return
    if (!opts?.force && now - lastStartRef.current < COOLDOWN_MS) return

    lastStartRef.current = now
    isAnimatingRef.current = true
    setIsAnimating(true)
    offsetsRef.current = generateOffsets()
    clearTimers()

    // Reset immediately to pre-drop positions (no transition)
    setActiveIndex(-1)

    const startId = window.setTimeout(() => {
      LETTERS.forEach((_, idx) => {
        const timeoutId = window.setTimeout(() => {
          setActiveIndex(current => (idx > current ? idx : current))

          if (idx === LETTERS.length - 1) {
            const settleId = window.setTimeout(() => {
              setIsAnimating(false)
              isAnimatingRef.current = false
            }, 420)
            timeoutsRef.current.push(settleId)
          }
        }, idx * STAGGER_MS)

        timeoutsRef.current.push(timeoutId)
      })
    }, 20)

    timeoutsRef.current.push(startId)
  }, [clearTimers])

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        triggerAnimation()
      },
      { threshold: 0.25 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [triggerAnimation])

  React.useEffect(() => {
    const onShuffle = () => triggerAnimation({ force: true })
    window.addEventListener('syntax:shuffle', onShuffle)
    return () => window.removeEventListener('syntax:shuffle', onShuffle)
  }, [triggerAnimation])

  React.useEffect(() => {
    const timer = window.setTimeout(() => triggerAnimation({ force: true }), 400)
    return () => window.clearTimeout(timer)
  }, [triggerAnimation])

  React.useEffect(() => () => clearTimers(), [clearTimers])

  return (
    <h2
      ref={containerRef}
      className={className}
      aria-label="2. Syntax"
      onMouseEnter={() => triggerAnimation()}
    >
      <span className="inline-flex gap-1">
        {LETTERS.map((letter, idx) => {
          const offsets = offsetsRef.current[idx] ?? { x: 0, y: 0, rotate: 0 }
          const isActive = idx <= activeIndex
          const baseTransform = isActive
            ? "translate3d(0, 0, 0) rotate(0deg)"
            : `translate3d(${offsets.x}px, ${offsets.y}px, 0) rotate(${offsets.rotate}deg)`

          return (
            <span
              key={letter}
              className="inline-block"
              style={{
                transform: baseTransform,
                transition: isActive
                  ? "transform 340ms cubic-bezier(0.22, 1, 0.24, 1)"
                  : "transform 0ms linear",
                willChange: "transform",
              }}
            >
              <span
                className={`inline-block px-2 py-1 rounded border font-bold text-sm shadow-sm ${
                  MODULE_COLORS[idx % MODULE_COLORS.length]
                }`}
                style={{
                  animation: isActive ? "syntax-click 360ms ease-out both" : "none",
                  boxShadow: isActive
                    ? "0 8px 0 hsl(218 65% 15% / 0.15)"
                    : "0 4px 0 hsl(218 65% 15% / 0.1)",
                  filter: isActive ? "saturate(1)" : "saturate(0.75)",
                }}
              >
                {letter}
              </span>
            </span>
          )
        })}
      </span>
    </h2>
  )
}

export default AnimatedSyntaxHeading
