import React from "react"
import { ConstructItem } from "@/hooks/use-construct-manager"
import { Module } from "@/lib/types"
import { cn } from "@/lib/utils"

type ModuleType = Module["type"]

const MODULE_TYPE_META: Record<ModuleType, { abbreviation: string; color: string }> = {
  overexpression: { abbreviation: "OE", color: "text-overexpression" },
  knockdown: { abbreviation: "KD", color: "text-knockdown" },
  knockout: { abbreviation: "KO", color: "text-knockout" },
  knockin: { abbreviation: "KI", color: "text-knockin" },
  synthetic: { abbreviation: "SYN", color: "text-knockin" },
  hardcoded: { abbreviation: "CONST", color: "text-muted-foreground" }
}

const FALLBACK_MODULE_META = { abbreviation: "MOD", color: "text-muted-foreground" }

interface EncodingSequenceProps {
  items: ConstructItem[]
  className?: string
}

export function EncodingSequence({ items, className }: EncodingSequenceProps) {
  if (!items?.length) return null

  return (
    <div className={cn("font-mono text-sm", className)}>
      {items.map((item, index) => {
        const key = `${item.id}-${index}`
        const isLast = index === items.length - 1
        
        let displayText = ""
        let colorClass = "text-foreground"
        
        if (item.type === "linker") {
          displayText = item.name
          colorClass = "text-muted-foreground"
        } else {
          const module = item as Module
          const name = module.name || module.gene_id || module.id || "Unnamed"
          const meta = MODULE_TYPE_META[module.type] ?? FALLBACK_MODULE_META
          displayText = `${name} ${meta.abbreviation}`
          colorClass = meta.color
        }

        return (
          <span key={key}>
            <span className={colorClass}>{displayText}</span>
            {!isLast && " → "}
          </span>
        )
      })}
    </div>
  )
}


export default EncodingSequence
