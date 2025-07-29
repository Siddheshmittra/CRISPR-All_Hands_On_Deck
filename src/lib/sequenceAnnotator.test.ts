import { describe, it, expect } from 'vitest'
import { annotateSequence } from './sequenceAnnotator'

describe('annotateSequence', () => {
  it('finds multiple motifs', () => {
    const seq = 'AAAAGATCGGAAGAGCTAAATATATAGAGGGCAGAGGCAGAGGAAGTCTTCAAAAA'
    const result = annotateSequence(seq)
    const labels = result.map(a => a.label)
    expect(labels).toContain('Adaptor')
    expect(labels).toContain('STOP')
    expect(labels).toContain('Triplex')
    expect(labels).toContain('T2A')
    expect(result.length).toBeGreaterThanOrEqual(4)
  })
})
