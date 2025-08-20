// Lazy loader and helpers for working with the Roth lab barcode pool

// Recursively traverse a JSON object and collect strings that look like DNA barcodes.
// This is resilient to varied schemas: it prefers values under keys containing "barcode"
// and also collects any sufficiently long A/C/G/T strings elsewhere.
function collectFromNode(node: any, acc: Set<string>, keyHint?: string) {
  if (node == null) return;
  const t = typeof node;
  if (t === 'string') {
    const raw = node.trim();
    const s = raw.toUpperCase();
    const cleaned = s.replace(/[^ACGTN]/g, '');
    const keyHasBarcode = (keyHint || '').toLowerCase().includes('barcode');
    // If under a barcode-related key, accept N as well and shorter length
    if (keyHasBarcode && cleaned.length >= 8) {
      acc.add(cleaned.replace(/N/g, 'N'));
      return;
    }
    // Otherwise accept strong DNA-like strings length >= 12 (A/C/G/T only)
    if (/^[ACGT]{12,}$/.test(s)) {
      acc.add(s);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) collectFromNode(v, acc, keyHint);
    return;
  }
  if (t === 'object') {
    for (const k of Object.keys(node)) {
      collectFromNode((node as any)[k], acc, k);
    }
  }
}

let cachedPool: string[] | null = null;
let cachedGeneralPool: Array<{ index: number; sequence: string }> | null = null;

export async function loadBarcodePool(): Promise<string[]> {
  // Legacy loader (Roth internal JSON). File may not exist; return empty pool.
  if (cachedPool) return cachedPool;
  cachedPool = [];
  return cachedPool;
}

export function pickNextAvailable(pool: string[], used: Set<string>): string | undefined {
  const candidates = pool.filter(b => !used.has(b));
  if (candidates.length === 0) return undefined;
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}

// Load the general barcodes pool (array with index + sequence)
export async function loadGeneralBarcodePool(): Promise<Array<{ index: number; sequence: string }>> {
  if (cachedGeneralPool) return cachedGeneralPool;
  try {
    const mod = await import('@/lib/General Barcodes.json');
    const root = (mod as any).default ?? mod;
    const out: Array<{ index: number; sequence: string }> = [];

    const pushIfValid = (obj: any, fallbackIndex: number) => {
      if (!obj || typeof obj !== 'object') return;
      let seq: string | undefined;
      let idx: number | undefined;
      for (const k of Object.keys(obj)) {
        const v = (obj as any)[k];
        if (typeof v === 'string') {
          const s = v.trim().toUpperCase();
          // Prefer barcode-like keys
          if (!seq && /barcode/i.test(k) && /^[ACGT]{8,}$/.test(s)) seq = s;
          // Else accept any strong DNA string
          if (!seq && /^[ACGT]{12,}$/.test(s)) seq = s;
          if (idx == null && /number|index/i.test(k)) {
            const n = Number(s.replace(/[^0-9]/g, ''));
            if (!Number.isNaN(n)) idx = n;
          }
        } else if (typeof v === 'number') {
          if (idx == null && /number|index/i.test(k)) idx = v;
        }
      }
      if (seq) out.push({ index: idx ?? fallbackIndex, sequence: seq });
    };

    if (Array.isArray(root)) {
      root.forEach((row: any, i: number) => pushIfValid(row, i + 1));
    } else if (root && typeof root === 'object') {
      // Fallback: traverse object values that look like rows
      let i = 0;
      for (const k of Object.keys(root)) pushIfValid((root as any)[k], ++i);
    }

    // Deduplicate by sequence while keeping first index
    const seen = new Set<string>();
    cachedGeneralPool = out.filter(({ sequence }) => {
      if (seen.has(sequence)) return false;
      seen.add(sequence);
      return true;
    });
    return cachedGeneralPool;
  } catch (err) {
    console.error('Failed to load General Barcodes.json', err);
    cachedGeneralPool = [];
    return cachedGeneralPool;
  }
}


