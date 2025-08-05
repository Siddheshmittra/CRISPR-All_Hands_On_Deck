import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { Module } from "@/lib/types"
import { Trash2 } from "lucide-react"

const moduleButtonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border border-border hover:bg-muted shadow-module",
        selected: "bg-accent text-accent-foreground shadow-elevated scale-105",
        overexpression: "bg-overexpression text-overexpression-foreground border-overexpression/30 hover:bg-overexpression/80 shadow-sm",
        knockout: "bg-knockout text-knockout-foreground border-knockout/30 hover:bg-knockout/80 shadow-sm",
        knockdown: "bg-knockdown text-knockdown-foreground border-knockdown/30 hover:bg-knockdown/80 shadow-sm",
        knockin: "bg-knockin text-knockin-foreground border-knockin/30 hover:bg-knockin/80 shadow-sm",
        synthetic: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
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
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof moduleButtonVariants> {
  module?: Module
  isSelected?: boolean
  moduleType?: "overexpression" | "knockout" | "knockdown" | "knockin" | "synthetic"
  onRemove?: () => void
  showRemoveButton?: boolean
}

const ModuleButton = React.forwardRef<HTMLDivElement, ModuleButtonProps>(
  ({ className, variant, size, isSelected, moduleType, module, onRemove, showRemoveButton, children, ...props }, ref) => {
    // Debug log to see what we're working with
    if (module) {
      console.log('ModuleButton module:', JSON.stringify(module, null, 2));
    }
    
    const effectiveModuleType = moduleType || module?.type;
    const buttonVariant = isSelected 
      ? "selected" 
      : effectiveModuleType 
        ? effectiveModuleType 
        : variant;

    // Calculate display name with fallbacks
    const displayName = React.useMemo(() => {
      if (children) return children;
      if (module?.name) return module.name;
      if (module?.gene_id) return module.gene_id;
      if (module?.id) return module.id;
      if (module?.type) return module.type.charAt(0).toUpperCase() + module.type.slice(1);
      return 'Module';
    }, [module, children]);

    return (
      <div
        className={cn(moduleButtonVariants({ variant: buttonVariant, size, className }), "relative group")}
        ref={ref}
        tabIndex={0}
        role="button"
        title={JSON.stringify(module, null, 2)}
        {...props}
      >
        <span className="truncate">
          {displayName}
        </span>
        {showRemoveButton && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs hover:bg-destructive/80"
          >
            <Trash2 className="h-2 w-2" />
          </button>
        )}
      </div>
    )
  }
)
ModuleButton.displayName = "ModuleButton"

export { ModuleButton, moduleButtonVariants }