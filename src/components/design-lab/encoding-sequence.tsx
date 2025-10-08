import React from "react"
import { ConstructItem } from "@/hooks/use-construct-manager"
import { Module } from "@/lib/types"
import { cn } from "@/lib/utils"

type ModuleType = Module["type"]

interface ModuleStyle {
  abbreviation: string
  bg: string
  border: string
  dot: string
  badge: string
}

const MODULE_TYPE_META: Record<ModuleType, ModuleStyle> = {
  overexpression: {
    abbreviation: "OE",
    bg: "bg-overexpression/15 dark:bg-overexpression/20",
    border: "border-overexpression/40 dark:border-overexpression/50",
    dot: "bg-overexpression",
    badge: "text-overexpression"
  },
  knockdown: {
    abbreviation: "KD",
    bg: "bg-knockdown/15 dark:bg-knockdown/25",
    border: "border-knockdown/40 dark:border-knockdown/50",
    dot: "bg-knockdown",
    badge: "text-knockdown"
  },
  knockout: {
    abbreviation: "KO",
    bg: "bg-knockout/15 dark:bg-knockout/20",
    border: "border-knockout/40 dark:border-knockout/50",
    dot: "bg-knockout",
    badge: "text-knockout"
  },
  knockin: {
    abbreviation: "KI",
    bg: "bg-knockin/15 dark:bg-knockin/25",
    border: "border-knockin/40 dark:border-knockin/50",
    dot: "bg-knockin",
    badge: "text-knockin"
  },
  synthetic: {
    abbreviation: "SYN",
    bg: "bg-knockin/15 dark:bg-knockin/25",
    border: "border-knockin/40 dark:border-knockin/50",
    dot: "bg-knockin",
    badge: "text-knockin"
  },
  hardcoded: {
    abbreviation: "CONST",
    bg: "bg-muted/25 dark:bg-muted/20",
    border: "border-muted/50 dark:border-muted/40",
    dot: "bg-muted-foreground",
    badge: "text-muted-foreground"
  }
}

const FALLBACK_MODULE_META: ModuleStyle = {
  abbreviation: "MOD",
  bg: "bg-muted/20 dark:bg-muted/15",
  border: "border-muted/50 dark:border-muted/40",
  dot: "bg-muted-foreground",
  badge: "text-muted-foreground"
}

const LINKER_CLASSES = "inline-flex items-center px-3 py-1 text-[0.7rem] font-mono uppercase tracking-wide rounded-md border border-dashed border-muted-foreground/50 bg-muted/30 text-muted-foreground"

interface EncodingSequenceProps {
  items: ConstructItem[]
  className?: string
}

export function EncodingSequence({ items, className }: EncodingSequenceProps) {
  if (!items?.length) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {items.map((item, index) => {
        const key = `${item.id}-${index}`
        const isLast = index === items.length - 1
        const chip =
          item.type === "linker" ? (
            <span className={LINKER_CLASSES}>{item.name}</span>
          ) : (
            <ModulePill module={item as Module} />
          )

        return (
          <div key={key} className="flex items-center gap-3">
            {chip}
            {!isLast && <span className="font-mono text-lg text-muted-foreground">→</span>}
          </div>
        )
      })}
    </div>
  )
}

function ModulePill({ module }: { module: Module }) {
  const meta = MODULE_TYPE_META[module.type] ?? FALLBACK_MODULE_META
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1 font-mono text-sm text-foreground shadow-sm",
        meta.bg,
        meta.border
      )}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
      <span className="font-semibold tracking-tight">
        {module.name || module.gene_id || module.id || "Unnamed"}
      </span>
      <span className={cn("text-[0.65rem] font-semibold uppercase tracking-wide", meta.badge)}>
        {meta.abbreviation}
      </span>
    </span>
  )
}

export default EncodingSequence
