// This could be expanded to fetch from HGNC API
// For now, we'll use a static list of common gene symbols
const COMMON_GENES = [
  'BATF', 'IRF4', 'TP53', 'MYC', 'EGFR', 'BRCA1', 'BRCA2', 'APOE',
  'TNF', 'IL6', 'IL2', 'IFNG', 'CD19', 'CD20', 'CD3E', 'CD4', 'CD8A'
];

// Sensitive genes that should require confirmation
const SENSITIVE_GENES = [
  'TP53', 'MYC', 'KRAS', 'BRAF', 'PIK3CA', 'PTEN', 'AKT1', 'BCL2', 'MDM2'
];

export function isValidGene(symbol: string): boolean {
  return COMMON_GENES.includes(symbol.toUpperCase());
}

export function isSensitiveGene(symbol: string): boolean {
  return SENSITIVE_GENES.includes(symbol.toUpperCase());
}

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

  for (const edit of edits) {
    const upperTarget = edit.target.toUpperCase();
    if (!isValidGene(upperTarget)) {
      result.invalid.push(upperTarget);
      continue;
    }
    
    if (isSensitiveGene(upperTarget)) {
      result.sensitive.push(upperTarget);
    }
    
    result.valid.push({
      ...edit,
      target: upperTarget
    });
  }

  return result;
}
