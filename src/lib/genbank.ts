export interface AnnotatedSegment {
  name: string;
  sequence: string;
  type: 'module' | 'linker' | 'hardcoded';
}

export interface GenBankInfo {
  locus: string;
  definition: string;
  source: string;
  organism?: string;
  accession?: string;
  version?: string;
}

export function generateGenBank(segments: AnnotatedSegment[], info: GenBankInfo): string {
  const sequence = segments.map(s => s.sequence).join('').toUpperCase();
  const length = sequence.length;

  const locus = `LOCUS       ${info.locus.padEnd(16)}${String(length).padStart(11)} bp    DNA`;
  const definition = `DEFINITION  ${info.definition}`;
  const accession = `ACCESSION   ${info.accession ?? ''}`.trimEnd();
  const version = `VERSION     ${info.version ?? ''}`.trimEnd();
  const source = `SOURCE      ${info.source}`;
  const organism = `  ORGANISM  ${info.organism ?? 'synthetic construct'}`;

  let features = 'FEATURES             Location/Qualifiers\n';
  let pos = 1;
  for (const seg of segments) {
    const start = pos;
    const end = pos + seg.sequence.length - 1;
    features += `     misc_feature    ${start}..${end}\n                     /label="${seg.name}"\n`;
    pos = end + 1;
  }

  let origin = 'ORIGIN\n';
  for (let i = 0; i < sequence.length; i += 60) {
    const chunk = sequence.slice(i, i + 60).toLowerCase();
    const spaced = chunk.match(/.{1,10}/g)?.join(' ') ?? '';
    const lineNum = String(i + 1).padStart(9);
    origin += `${lineNum} ${spaced}\n`;
  }
  origin += '//';

  return [locus, definition, accession, version, source, organism, '', features, origin].join('\n');
}
