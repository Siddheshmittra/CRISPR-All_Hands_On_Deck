// Lazy loader and helpers for working with the Roth lab barcode pool

// Recursively traverse a JSON object and collect all strings that look like DNA barcodes
function collectDnaStrings(node: any, acc: Set<string>) {
  if (node == null) return;
  const t = typeof node;
  if (t === 'string') {
    const s = node.trim().toUpperCase();
    // Accept sequences comprised solely of A/C/G/T and length >= 10
    if (/^[ACGT]{10,}$/.test(s)) {
      acc.add(s);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) collectDnaStrings(v, acc);
    return;
  }
  if (t === 'object') {
    for (const k of Object.keys(node)) {
      collectDnaStrings((node as any)[k], acc);
    }
  }
}

let cachedPool: string[] | null = null;

export async function loadBarcodePool(): Promise<string[]> {
  if (cachedPool) return cachedPool;
  try {
    const mod = await import('@/lib/actualbarcodes.json');
    const acc = new Set<string>();
    collectDnaStrings((mod as any).default ?? mod, acc);
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


