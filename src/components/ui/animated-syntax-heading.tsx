import React from "react"

interface AnimatedSyntaxHeadingProps {
  className?: string
  storageKey?: string // retained for backward compatibility; not used for gating
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

export function AnimatedSyntaxHeading({ className }: AnimatedSyntaxHeadingProps) {
  const [displayOrder, setDisplayOrder] = React.useState<number[]>([0, 1, 2, 3, 4, 5])
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  const containerRef = React.useRef<HTMLHeadingElement | null>(null)
  const lastStartRef = React.useRef<number>(0)
  const COOLDOWN_MS = 6000

  // Refs for FLIP animation
  const itemRefs = React.useRef<Map<string, HTMLSpanElement>>(new Map())
  const prevRectsRef = React.useRef<Map<string, DOMRect>>(new Map())
  const setItemRef = React.useCallback((id: string, el: HTMLSpanElement | null) => {
    const map = itemRefs.current
    if (el) map.set(id, el)
    else map.delete(id)
  }, [])

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const now = Date.now()
          if (!isAnimating && now - lastStartRef.current > COOLDOWN_MS) {
            lastStartRef.current = now
            setVisible(true)
          }
        }
      },
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [isAnimating])

  React.useEffect(() => {
    if (!visible || isAnimating) return
    setIsAnimating(true)

    // Shuffle multiple times over ~1.8 seconds
    const shuffleInterval = setInterval(() => {
      setDisplayOrder(shuffle([0, 1, 2, 3, 4, 5]))
    }, 200)

    // After 1.8s, snap to final order
    const snapTimeout = setTimeout(() => {
      clearInterval(shuffleInterval)
      setDisplayOrder([0, 1, 2, 3, 4, 5])
      setIsAnimating(false)
      setVisible(false) // allow re-trigger on next intersection
    }, 1800)

    return () => {
      clearInterval(shuffleInterval)
      clearTimeout(snapTimeout)
    }
  }, [visible, isAnimating])

  // Listen for external triggers to replay the shuffle animation
  React.useEffect(() => {
    const onShuffle = () => {
      if (isAnimating) return
      lastStartRef.current = Date.now()
      setVisible(true)
    }
    window.addEventListener('syntax:shuffle', onShuffle)
    return () => window.removeEventListener('syntax:shuffle', onShuffle)
  }, [isAnimating])

  // FLIP: animate position changes of letter chips
  React.useLayoutEffect(() => {
    const ids = LETTERS
    const newRects = new Map<string, DOMRect>()
    for (const id of ids) {
      const el = itemRefs.current.get(id)
      if (el) newRects.set(id, el.getBoundingClientRect())
    }

    const prevRects = prevRectsRef.current
    newRects.forEach((newRect, id) => {
      const prevRect = prevRects.get(id)
      if (!prevRect) return
      const dx = prevRect.left - newRect.left
      const dy = prevRect.top - newRect.top
      if (dx !== 0 || dy !== 0) {
        const el = itemRefs.current.get(id)
        if (!el) return
        el.style.transform = `translate(${dx}px, ${dy}px)`
        el.style.transition = "transform 0s"
        requestAnimationFrame(() => {
          el.style.transform = ""
          el.style.transition = "transform 500ms ease"
        })
      }
    })

    prevRectsRef.current = newRects
  }, [displayOrder])

  return (
    <h2 ref={containerRef} className={className} aria-label="2. Syntax">
      <span className="inline-block mr-2">2.</span>
      <span className="inline-flex gap-0.5">
        {displayOrder.map((letterIndex) => {
          const id = LETTERS[letterIndex]
          return (
            <span
              key={id}
              ref={(el) => setItemRef(id, el)}
              className="inline-block"
              style={{ willChange: 'transform' }}
            >
              <span
                className={`inline-block px-2 py-1 rounded border font-bold text-sm shadow-sm transition-transform duration-500 ease-in-out ${
                  MODULE_COLORS[letterIndex % MODULE_COLORS.length]
                } ${isAnimating ? "scale-105 rotate-2" : "scale-100 rotate-0"}`}
                style={{
                  textShadow: "0 0 0.5px #000, 0 0 1.5px #000"
                }}
              >
                {LETTERS[letterIndex]}
              </span>
            </span>
          )
        })}
      </span>
    </h2>
  )
}

export default AnimatedSyntaxHeading

