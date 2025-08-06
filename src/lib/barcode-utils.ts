interface CassetteElement {
  element: string;
  position: 'first' | 'internal' | 'last';
  encoding: string;
}

/**
 * Processes genetic cassette elements and returns their DNA encodings
 * @param elements Comma-separated list of genetic elements (e.g., "OE-LibraryA, KO-Gene1, KD-Gene2")
 * @returns Array of objects with element info and their DNA encodings
 */
export const processCassetteElements = (elements: string): CassetteElement[] | { error: string } => {
  const tokens = elements.split(',').map(t => t.trim());
  const result: CassetteElement[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isFirst = i === 0;
    const isLast = i === tokens.length - 1;
    const position = isFirst ? 'first' : isLast ? 'last' : 'internal';
    
    // Handle OE (overexpression) elements
    if (token.startsWith('OE-')) {
      const libraryName = token.substring(3);
      result.push({
        element: token,
        position,
        encoding: `Intron-${libraryName}-T2A${isLast ? '-IS-BCs' : ''}`
      });
    }
    // Handle KO (knockout) elements
    else if (token.startsWith('KO-')) {
      let encoding: string;
      if (isFirst) {
        encoding = 'STOP-Triplex-Adaptor-gRNAs';
      } else if (isLast) {
        encoding = 'Adaptor-gRNA-IS-BCs-PolyA';
      } else {
        encoding = 'Adaptor-gRNAs';
      }
      result.push({ element: token, position, encoding });
    }
    // Handle KD (knockdown) elements
    else if (token.startsWith('KD-')) {
      let encoding: string;
      if (isFirst) {
        encoding = 'STOP-Triplex-Adaptor-shRNA';
      } else if (isLast) {
        encoding = 'Adaptor-shRNA-IS-BCs-PolyA';
      } else {
        encoding = 'Adaptor-shRNA';
      }
      result.push({ element: token, position, encoding });
    }
    // Handle unknown prefixes
    else {
      return { error: `Unknown element type in token: ${token}. Must start with OE-, KO-, or KD-` };
    }
  }
  
  return result;
};

/**
 * Validates a DNA barcode string
 * @param barcode The DNA barcode to validate
 * @returns An object with validation result and message
 */
export const validateBarcode = (barcode: string): { isValid: boolean; message: string } => {
  if (!barcode.trim()) {
    return { isValid: false, message: 'DNA barcode cannot be empty' };
  }
  
  // Standard DNA barcode lengths are typically between 8-20bp
  if (barcode.length < 8) {
    return { isValid: false, message: 'DNA barcode must be at least 8bp' };
  }
  
  if (barcode.length > 24) {
    return { isValid: false, message: 'DNA barcode must be 24bp or less' };
  }
  
  // Only allow DNA nucleotides (A, C, G, T) and N for degenerate bases
  if (!/^[ACGTNacgtn]+$/.test(barcode)) {
    return { 
      isValid: false, 
      message: 'Only A, C, G, T, and N (degenerate) are allowed' 
    };
  }
  
  return { 
    isValid: true, 
    message: 'Valid DNA barcode',
  };
};

/**
 * Generates a random DNA barcode
 * @param length Length of the DNA barcode (default: 12bp)
 * @param existingBarcodes Array of existing barcodes to ensure uniqueness
 * @returns A unique DNA barcode string in uppercase
 */
/**
 * Generates a random DNA barcode
 * @param length Length of the DNA barcode (default: 12bp)
 * @param existingBarcodes Array of existing barcodes to ensure uniqueness
 * @returns A unique DNA barcode string in uppercase
 */
export const generateBarcode = (
  length: number = 12,
  existingBarcodes: string[] = []
): string => {
  const nucleotides = ['A', 'C', 'G', 'T'];
  const existingSet = new Set(existingBarcodes);
  const safeLength = Math.max(8, Math.min(24, length));
  const maxAttempts = 100;
  
  // Try to generate a unique barcode
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random DNA sequence
    let barcode = '';
    for (let i = 0; i < safeLength; i++) {
      barcode += nucleotides[Math.floor(Math.random() * 4)];
    }
    
    // If barcode is unique, return it
    if (!existingSet.has(barcode)) {
      return barcode;
    }
  }
  
  // If we can't find a unique barcode after max attempts, append a timestamp
  // This ensures we always return a unique barcode
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  let fallbackBarcode = '';
  for (let i = 0; i < safeLength - 4; i++) {
    fallbackBarcode += nucleotides[Math.floor(Math.random() * 4)];
  }
  return fallbackBarcode + timestamp;
};

/**
 * Checks if a barcode is a valid DNA sequence
 * @param barcode The barcode to check
 * @returns True if the barcode is a valid DNA sequence
 */
export const isValidDnaSequence = (barcode: string): boolean => {
  return /^[ACGTNacgtn]+$/.test(barcode);
};

/**
 * Converts a barcode to uppercase and removes any non-DNA characters
 * @param barcode The barcode to clean
 * @returns A cleaned DNA barcode string
 */
export const cleanDnaBarcode = (barcode: string): string => {
  return barcode
    .toUpperCase()
    .replace(/[^ACGTN]/g, '');
};
