import React from "react"

interface CodeHeadingProps {
  text: string
  className?: string
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/{}[]()".split("")

export function CodeHeading({ text, className }: CodeHeadingProps) {
  const [display, setDisplay] = React.useState<string>(text)
  const [visible, setVisible] = React.useState(false)
  const containerRef = React.useRef<HTMLHeadingElement | null>(null)
  const iterationRef = React.useRef(0)

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

    let iteration = 0
    const maxIterations = text.length

    const interval = setInterval(() => {
      setDisplay(
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " "
            if (index < iteration) {
              return text[index]
            }
            return CHARS[Math.floor(Math.random() * CHARS.length)]
          })
          .join("")
      )

      if (iteration >= maxIterations) {
        clearInterval(interval)
        setDisplay(text)
      }

      iteration += 1 / 3
    }, 40)

    return () => clearInterval(interval)
  }, [visible, text])

  return (
    <h2
      ref={containerRef}
      className={`font-mono ${className}`}
      aria-label={text}
    >
      <span className="inline-flex items-center gap-2">
        <span className="text-green-500 font-bold">&gt;</span>
        <span className="bg-gray-900/5 dark:bg-gray-100/5 px-3 py-1 rounded border border-gray-300 dark:border-gray-600">
          {display}
        </span>
      </span>
    </h2>
  )
}

export default CodeHeading

