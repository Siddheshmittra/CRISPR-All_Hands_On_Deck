import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const moduleButtonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border border-border hover:bg-muted shadow-module",
        selected: "bg-accent text-accent-foreground shadow-elevated scale-105",
        overexpression: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
        knockout: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
        knockdown: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface ModuleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof moduleButtonVariants> {
  isSelected?: boolean
  moduleType?: "overexpression" | "knockout" | "knockdown"
}

const ModuleButton = React.forwardRef<HTMLButtonElement, ModuleButtonProps>(
  ({ className, variant, size, isSelected, moduleType, ...props }, ref) => {
    const buttonVariant = isSelected 
      ? "selected" 
      : moduleType 
        ? moduleType 
        : variant

    return (
      <button
        className={cn(moduleButtonVariants({ variant: buttonVariant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
ModuleButton.displayName = "ModuleButton"

export { ModuleButton, moduleButtonVariants }