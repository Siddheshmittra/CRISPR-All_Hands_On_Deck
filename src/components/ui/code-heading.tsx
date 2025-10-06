import React from "react"

interface CodeHeadingProps {
  text: string
  className?: string
}

export function CodeHeading({ text, className }: CodeHeadingProps) {
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

  // No scramble; use a subtle fade + underline sweep

  return (
    <h2
      ref={containerRef}
      className={`font-mono ${className}`}
      aria-label={text}
    >
      <span className="inline-flex items-center gap-2">
        <span className="text-green-500 font-bold">&gt;</span>
        <span className={`relative inline-block transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-0.5'}`}>
          <span className="bg-gray-900/5 dark:bg-gray-100/5 px-3 py-1 rounded border border-gray-300 dark:border-gray-600">
            {text}
          </span>
          <span className={`absolute left-0 right-0 bottom-0 h-[2px] bg-green-500 origin-left transition-transform duration-700 ${visible ? 'scale-x-100' : 'scale-x-0'}`} />
        </span>
      </span>
    </h2>
  )
}

export default CodeHeading

