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

export async function loadBarcodePool(): Promise<string[]> {
  if (cachedPool) return cachedPool;
  try {
    const mod = await import('@/lib/actualbarcodes.json');
    const acc = new Set<string>();
    collectFromNode((mod as any).default ?? mod, acc);
    cachedPool = Array.from(acc);
    return cachedPool;
  } catch (err) {
    console.error('Failed to load actualbarcodes.json', err);
    cachedPool = [];
    return cachedPool;
  }
}

export function pickNextAvailable(pool: string[], used: Set<string>): string | undefined {
  for (const b of pool) {
    if (!used.has(b)) return b;
  }
  return undefined;
}


