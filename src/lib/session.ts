import { safeLocalStorage } from "./uuid";
import type { Module, LibrarySyntax } from "./types";
import { z } from "zod";

// Generic debounced persisted storage helper with versioning and validation
export function createSessionStorage<T>({
  storageKey,
  version,
  schema,
  debounceMs = 800,
  migrate,
}: {
  storageKey: string
  version: number
  schema: z.ZodType<T>
  debounceMs?: number
  migrate?: (rawUnknown: unknown) => T | null
}) {
  let timer: number | null = null;
  let lastPayload: T | null = null;

  function readLegacy(key: string): unknown | null {
    try {
      const raw = safeLocalStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function load(): T | null {
    try {
      const raw = safeLocalStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'version' in parsed) {
          const candidate = (parsed as any).data ?? parsed;
          const result = schema.safeParse(candidate);
          if (result.success) {
            lastPayload = result.data;
            return result.data;
          }
        }
      }
    } catch {}

    // Attempt legacy migration if provided
    if (migrate) {
      const legacy = readLegacy('design-lab:session');
      if (legacy != null) {
        try {
          const migrated = migrate(legacy);
          if (migrated) {
            // Persist migrated immediately
            safeLocalStorage.setItem(
              storageKey,
              JSON.stringify({ version, data: migrated })
            );
            // Clear legacy
            safeLocalStorage.removeItem('design-lab:session');
            lastPayload = migrated;
            return migrated;
          }
        } catch {}
      }
    }
    return null;
  }

  function saveNow(value: T) {
    try {
      safeLocalStorage.setItem(
        storageKey,
        JSON.stringify({ version, data: value })
      );
      lastPayload = value;
    } catch {}
  }

  function scheduleSave(value: T) {
    lastPayload = value;
    if (timer != null) {
      window.clearTimeout(timer);
    }
    // Prefer requestIdleCallback if available for less invasiveness
    // but fall back to setTimeout to guarantee execution
    const run = () => saveNow(value);
    // @ts-expect-error: requestIdleCallback may not exist in all environments
    const ric: typeof window.requestIdleCallback | undefined = window.requestIdleCallback;
    if (typeof ric === 'function') {
      // @ts-expect-error: vendor types may differ
      ric(() => run(), { timeout: debounceMs });
    } else {
      timer = window.setTimeout(run, debounceMs);
    }
  }

  function flush() {
    if (lastPayload != null) {
      saveNow(lastPayload);
    }
  }

  function clear() {
    try {
      safeLocalStorage.removeItem(storageKey);
    } catch {}
  }

  return { load, scheduleSave, flush, clear };
}

// Design Lab session schema and instance
const ModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["overexpression", "knockout", "knockdown", "knockin", "synthetic", "hardcoded"]).catch("overexpression"),
  description: z.string().optional(),
  sequence: z.string().optional(),
  gene_id: z.string().optional(),
  ensemblGeneId: z.string().optional(),
  sequenceSource: z.enum(["ensembl_grch38", "ensembl_grch37", "shRNA.json", "gRNA.json"]).optional(),
  isSynthetic: z.boolean().optional(),
  syntheticSequence: z.string().optional(),
  color: z.string().optional(),
});

const FolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  modules: z.array(z.string()),
  open: z.boolean().optional(),
}).passthrough();

const LibrarySyntaxSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["overexpression", "knockout", "knockdown", "knockin"]).catch("overexpression"),
}).strict();

const CassetteSchema = z.object({
  id: z.string(),
  modules: z.array(ModuleSchema),
  barcode: z.string().optional(),
});

export const DesignLabSessionSchema = z.object({
  customModules: z.array(ModuleSchema).default([]),
  folders: z.array(FolderSchema).default([]),
  librarySyntax: z.array(LibrarySyntaxSchema).default([]),
  cassetteBatch: z.array(CassetteSchema).default([]),
  cassetteMode: z.enum(["single", "multi"]).default("single"),
  inputMode: z.enum(["manual", "natural"]).default("manual"),
  barcodeMode: z.enum(["internal", "general"]).default("general"),
});

export interface DesignLabSession {
  customModules: Module[];
  folders: any[];
  librarySyntax: LibrarySyntax[];
  cassetteBatch: Array<{
    id: string;
    modules: Module[];
    barcode?: string;
  }>;
  cassetteMode: 'single' | 'multi';
  inputMode: 'manual' | 'natural';
  barcodeMode: 'internal' | 'general';
}

export const designLabSession = createSessionStorage<DesignLabSession>({
  storageKey: 'design-lab:session:v2',
  version: 2,
  schema: DesignLabSessionSchema,
  debounceMs: 800,
  migrate: (raw) => {
    // Accept old v1 payload shape directly
    try {
      const result = DesignLabSessionSchema.safeParse(raw);
      return result.success ? (result.data as unknown as DesignLabSession) : null;
    } catch {
      return null;
    }
  }
});


