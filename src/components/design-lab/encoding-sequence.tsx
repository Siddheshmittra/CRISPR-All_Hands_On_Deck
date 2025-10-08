import React from "react"
import { ConstructItem } from "@/hooks/use-construct-manager"
import { Module } from "@/lib/types"
import { cn } from "@/lib/utils"

type ModuleType = Module["type"]

const MODULE_TYPE_META: Record<ModuleType, { abbreviation: string }> = {
  overexpression: { abbreviation: "OE" },
  knockdown: { abbreviation: "KD" },
  knockout: { abbreviation: "KO" },
  knockin: { abbreviation: "KI" },
  synthetic: { abbreviation: "SYN" },
  hardcoded: { abbreviation: "CONST" }
}

const FALLBACK_MODULE_META = { abbreviation: "MOD" }

interface EncodingSequenceProps {
  items: ConstructItem[]
  className?: string
}

export function EncodingSequence({ items, className }: EncodingSequenceProps) {
  if (!items?.length) return null

  return (
    <div className={cn("font-mono text-sm text-foreground", className)}>
      {items.map((item, index) => {
        const key = `${item.id}-${index}`
        const isLast = index === items.length - 1
        
        let displayText = ""
        if (item.type === "linker") {
          displayText = item.name
        } else {
          const module = item as Module
          const name = module.name || module.gene_id || module.id || "Unnamed"
          const meta = MODULE_TYPE_META[module.type] ?? FALLBACK_MODULE_META
          displayText = `${name} ${meta.abbreviation}`
        }

        return (
          <span key={key}>
            {displayText}
            {!isLast && " → "}
          </span>
        )
      })}
    </div>
  )
}


export default EncodingSequence
