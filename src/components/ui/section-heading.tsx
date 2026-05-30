import React from "react"
import { cn } from "@/lib/utils"
import { StepBadge } from "@/components/ui/step-badge"

interface SectionHeadingProps {
  /** Optional step number rendered as a badge before the title. */
  n?: number
  children: React.ReactNode
  className?: string
}

/**
 * Roth-style decorative flourish flanking a centered section title.
 * A fading rule that resolves into two small rotated diamonds near the title,
 * echoing the lab site's `title--ornament` treatment.
 */
const Ornament = ({ flip = false }: { flip?: boolean }) => (
  <span
    aria-hidden
    className={cn(
      "hidden flex-1 items-center gap-1.5 sm:flex",
      flip ? "flex-row" : "flex-row-reverse"
    )}
  >
    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
    <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-primary/50" />
    <span className="h-1 w-1 rotate-45 rounded-[1px] bg-accent/60" />
  </span>
)

export function SectionHeading({ n, children, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      <Ornament />
      <div className="flex shrink-0 items-center gap-3">
        {typeof n === "number" && <StepBadge n={n} />}
        {children}
      </div>
      <Ornament flip />
    </div>
  )
}

export default SectionHeading
