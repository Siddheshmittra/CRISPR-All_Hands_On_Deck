import { cn } from "@/lib/utils"

interface StepBadgeProps {
  n: number
  className?: string
}

export function StepBadge({ n, className }: StepBadgeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm",
        className
      )}
    >
      {n}
    </span>
  )
}

export default StepBadge
