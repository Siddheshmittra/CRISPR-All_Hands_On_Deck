// Sensitive genes that should require confirmation
const SENSITIVE_GENES = [
  'TP53', 'MYC', 'KRAS', 'BRAF', 'PIK3CA', 'PTEN', 'AKT1', 'BCL2', 'MDM2'
];

export function isSensitiveGene(symbol: string): boolean {
  return SENSITIVE_GENES.includes(symbol.toUpperCase());
}

// Common alias → official symbol normalization
const ALIAS_TO_OFFICIAL: Record<string, string> = {
  P53: 'TP53',
  PD1: 'PDCD1',
  'PD-1': 'PDCD1',
  CD45RA: 'PTPRC', // isoform marker; canonical gene symbol
};

export function validateGenes(edits: { target: string }[]): {
  valid: { target: string }[];
  invalid: string[];
  sensitive: string[];
} {
  const result = {
    valid: [] as { target: string }[],
    invalid: [] as string[],
    sensitive: [] as string[]
  };

  const isGeneLike = (value: string): boolean => {
    // Allow standard gene symbols and aliases: letters, numbers, dashes
    // Length >= 2 to avoid single-letter tokens
    return /^[A-Za-z0-9-]{2,}$/.test(value);
  };

  for (const edit of edits) {
    const upperTarget = (edit.target || '').toUpperCase();
    if (!isGeneLike(upperTarget)) {
      result.invalid.push(upperTarget);
      continue;
    }
    const canonical = ALIAS_TO_OFFICIAL[upperTarget] ?? upperTarget;
    
    if (isSensitiveGene(canonical)) {
      result.sensitive.push(canonical);
    }
    
    result.valid.push({
      ...edit,
      target: canonical
    });
  }

  return result;
}
