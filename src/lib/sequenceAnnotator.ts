export interface Annotation {
  label: string
  start: number
  end: number
  sequence: string
}

const rawPatterns: Record<string, string> = {
  Intron: 'GT[ATGC]{1,30}AG',
  T2A: 'GAGGGCAGAGGCAGAGGAAGTCTTC',
  'Internal Stuffer': 'GCTAGCGGCCGC',
  Barcodes: 'NNNNNN',
  STOP: '(?:TAA|TAG|TGA)',
  Triplex: 'TATATA',
  Adaptor: 'AGATCGGAAGAGC',
  PolyA: 'A{6,}'
}

const patterns: Record<string, RegExp> = Object.fromEntries(
  Object.entries(rawPatterns).map(([label, pattern]) => {
    const regex = new RegExp(
      label === 'Barcodes'
        ? pattern.replace(/N/g, '[ATGC]')
        : pattern,
      'gi'
    )
    return [label, regex]
  })
)

export function annotateSequence(seq: string): Annotation[] {
  const annotations: Annotation[] = []
  const sequence = seq.toUpperCase()
  for (const [label, regex] of Object.entries(patterns)) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(sequence))) {
      annotations.push({
        label,
        start: match.index,
        end: match.index + match[0].length,
        sequence: match[0]
      })
      if (regex.lastIndex === match.index) {
        regex.lastIndex++
      }
    }
    regex.lastIndex = 0
  }
  return annotations.sort((a, b) => a.start - b.start)
}
