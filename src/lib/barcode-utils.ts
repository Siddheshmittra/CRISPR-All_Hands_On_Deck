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
export const generateBarcode = (
  length: number = 12,
  existingBarcodes: string[] = []
): string => {
  const nucleotides = ['A', 'C', 'G', 'T'];
  let newBarcode = '';
  let attempts = 0;
  const maxAttempts = 1000;
  
  // Ensure length is within bounds
  const safeLength = Math.max(8, Math.min(24, length));
  
  do {
    // Generate random DNA sequence
    newBarcode = Array(safeLength)
      .fill(0)
      .map(() => nucleotides[Math.floor(Math.random() * nucleotides.length)])
      .join('');
    
    attempts++;
    
    // If we can't find a unique barcode after many attempts, append a number
    if (attempts > maxAttempts) {
      newBarcode = newBarcode.slice(0, -3) + attempts.toString().padStart(3, '0');
      break;
    }
    
  } while (existingBarcodes.includes(newBarcode) && attempts < maxAttempts * 2);
  
  return newBarcode;
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
