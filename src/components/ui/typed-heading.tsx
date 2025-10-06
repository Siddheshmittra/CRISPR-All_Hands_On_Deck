import React from "react"

interface TypedHeadingProps {
  text: string
  className?: string
  speedMsPerChar?: number
}

function useTypedText(text: string, speedMsPerChar: number, start: boolean) {
  const [display, setDisplay] = React.useState<string>("")
  const startTimeRef = React.useRef<number | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const textRef = React.useRef(text)

  React.useEffect(() => { textRef.current = text }, [text])

  React.useEffect(() => {
    if (!start) return () => {}
    setDisplay("")
    startTimeRef.current = null
    const animate = (ts: number) => {
      if (startTimeRef.current == null) startTimeRef.current = ts
      const elapsed = ts - startTimeRef.current
      const chars = Math.min(textRef.current.length, Math.floor(elapsed / speedMsPerChar))
      setDisplay(textRef.current.slice(0, chars))
      if (chars < textRef.current.length) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(textRef.current)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [start, speedMsPerChar])

  return display
}

export function TypedHeading({ text, className, speedMsPerChar = 35 }: TypedHeadingProps) {
  const ref = React.useRef<HTMLHeadingElement | null>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        io.disconnect()
      }
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const display = useTypedText(text, speedMsPerChar, visible)

  return (
    <h2 ref={ref} className={className} aria-label={text}>
      {display}
    </h2>
  )
}

export default TypedHeading


