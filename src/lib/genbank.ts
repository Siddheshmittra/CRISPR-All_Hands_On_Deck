import { AnnotatedSegment } from './types'

export interface GenbankFeature {
  start: number
  end: number
  type: string
  name: string
  qualifiers?: Record<string, string>
}

export function generateGenbank(
  constructName: string,
  segments: AnnotatedSegment[],
  details: { predictedFunction: string }
): string {
  const sequence = segments.map(s => s.sequence).join('').toUpperCase()
  const locusLine = `LOCUS       ${constructName.padEnd(16)}${String(sequence.length).padStart(11)} bp    DNA`
  const definitionText = details?.predictedFunction || 'Synthetic construct';
  const definitionLine = `DEFINITION  ${definitionText}`

  let featuresSection = 'FEATURES             Location/Qualifiers\n'
  let pos = 1
  for (const seg of segments) {
    const start = pos
    const end = pos + seg.sequence.length - 1
    // Label format: ModuleName [PERTURBATION]
    // Avoid duplicating type; if seg.name already contains a bracketed type, don't append again.
    let label = seg.name;
    const hasTypeInName = /\[[^\]]+\]$/.test(label || '');
    if (seg.type === 'module' && seg.action && !hasTypeInName) {
      label = `${seg.name} [${seg.action}]`;
    }
    featuresSection += `     misc_feature    ${start}..${end}\n                     /label="${label}"\n`
    pos = end + 1
  }

  let origin = 'ORIGIN\n'
  for (let i = 0; i < sequence.length; i += 60) {
    const chunk = sequence.slice(i, i + 60).toLowerCase()
    const spaced = chunk.match(/.{1,10}/g)?.join(' ') ?? ''
    const lineNum = String(i + 1).padStart(9)
    origin += `${lineNum} ${spaced}\n`
  }
  origin += '//'

  return [locusLine, definitionLine, featuresSection, origin].join('\n')
}
