import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { Module } from "@/lib/types"
import { Trash2, Loader2 } from "lucide-react"

const moduleButtonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border border-border hover:bg-muted shadow-module",
        selected: "bg-accent text-accent-foreground shadow-elevated scale-105",
        overexpression: "bg-overexpression/90 text-overexpression-foreground border-overexpression/30 hover:bg-overexpression hover:shadow-overexpression/20 hover:shadow-md transition-all duration-200 shadow-sm",
        knockout: "bg-knockout/90 text-knockout-foreground border-knockout/30 hover:bg-knockout hover:shadow-knockout/20 hover:shadow-md transition-all duration-200 shadow-sm",
        knockdown: "bg-knockdown/90 text-knockdown-foreground border-knockdown/30 hover:bg-knockdown hover:shadow-knockdown/20 hover:shadow-md transition-all duration-200 shadow-sm",
        knockin: "bg-knockin/90 text-knockin-foreground border-knockin/30 hover:bg-knockin hover:shadow-knockin/20 hover:shadow-md transition-all duration-200 shadow-sm",
        synthetic: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
        hardcoded: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
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
  moduleType?: Module['type']
  onRemove?: () => void
  showRemoveButton?: boolean
}

const ModuleButton = React.forwardRef<HTMLDivElement, ModuleButtonProps>(
  ({ className, variant, size, isSelected, moduleType, module, onRemove, showRemoveButton, children, ...props }, ref) => {
    const isLoading = module?.isEnriching;
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
        className={cn(
          moduleButtonVariants({ variant: buttonVariant, size, className }), 
          "relative group",
          isLoading ? "opacity-75" : ""
        )}
        ref={ref}
        tabIndex={isLoading ? -1 : 0}
        role="button"
        aria-busy={isLoading}
        title={isLoading ? "Loading sequence..." : JSON.stringify(module, null, 2)}
        {...props}
      >
        <div className="flex items-center gap-2">
          {isLoading && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          <span className="truncate">
            {displayName}
          </span>
        </div>
        {!isLoading && showRemoveButton && onRemove && (
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