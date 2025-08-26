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
let cachedInternalPool: Array<{ index: number; sequence: string }> | null = null;

export async function loadBarcodePool(): Promise<string[]> {
  // Legacy loader (Roth internal JSON). File may not exist; return empty pool.
  if (cachedPool) return cachedPool;
  cachedPool = [];
  return cachedPool;
}

export function pickNextAvailable(pool: string[], used: Set<string>): string | undefined {
  // Deterministic: pick first available in provided order
  for (const b of pool) {
    if (!used.has(b)) return b;
  }
  return undefined;
}

// Load the general barcodes pool (array with index + sequence)
export async function loadGeneralBarcodePool(): Promise<Array<{ index: number; sequence: string }>> {
  if (cachedGeneralPool) return cachedGeneralPool;
  try {
    const mod = await import('@/lib/General Barcodes.json');
    const root = (mod as any).default ?? mod;
    const out: Array<{ index: number; sequence: string }> = [];

    if (Array.isArray(root)) {
      // Expect first row to be headers with keys: "" -> "Barcode Number", "__1" -> "Barcode"
      for (let i = 1; i < root.length; i++) {
        const row = root[i];
        if (!row || typeof row !== 'object') continue;
        const idxRaw = (row as any)[''];
        const seqRaw = (row as any)['__1'];
        const idx = typeof idxRaw === 'number' ? idxRaw : Number(String(idxRaw ?? '').replace(/[^0-9]/g, ''));
        const seq = String(seqRaw ?? '').trim().toUpperCase();
        if (idx && /^[ACGT]{8,}$/.test(seq)) {
          out.push({ index: idx, sequence: seq });
        }
      }
    } else if (root && typeof root === 'object') {
      // Fallback object-of-rows
      for (const k of Object.keys(root)) {
        const row = (root as any)[k];
        if (!row || typeof row !== 'object') continue;
        const idxRaw = (row as any)[''];
        const seqRaw = (row as any)['__1'];
        const idx = typeof idxRaw === 'number' ? idxRaw : Number(String(idxRaw ?? '').replace(/[^0-9]/g, ''));
        const seq = String(seqRaw ?? '').trim().toUpperCase();
        if (idx && /^[ACGT]{8,}$/.test(seq)) {
          out.push({ index: idx, sequence: seq });
        }
      }
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

// Load the internal barcodes pool (array of objects: one numeric (index), one DNA string)
export async function loadInternalBarcodePool(): Promise<Array<{ index: number; sequence: string }>> {
  if (cachedInternalPool) return cachedInternalPool;
  try {
    const mod = await import('@/lib/Internal Barcodes.json');
    const root = (mod as any).default ?? mod;
    const out: Array<{ index: number; sequence: string }> = [];
    if (Array.isArray(root)) {
      for (const row of root) {
        if (!row || typeof row !== 'object') continue;
        let idx: number | undefined;
        let seq: string | undefined;
        for (const k of Object.keys(row)) {
          const v = (row as any)[k];
          if (typeof v === 'number' && idx == null) idx = v;
          if (typeof v === 'string' && !seq) {
            const s = v.trim().toUpperCase();
            if (/^[ACGT]{8,}$/.test(s)) seq = s;
          }
        }
        if (idx != null && seq) out.push({ index: idx, sequence: seq });
      }
    }
    // Dedup by sequence
    const seen = new Set<string>();
    cachedInternalPool = out.filter(({ sequence }) => {
      if (seen.has(sequence)) return false;
      seen.add(sequence);
      return true;
    });
    return cachedInternalPool;
  } catch (err) {
    console.error('Failed to load Internal Barcodes.json', err);
    cachedInternalPool = [];
    return cachedInternalPool;
  }
}


