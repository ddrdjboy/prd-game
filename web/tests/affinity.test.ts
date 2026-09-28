import { describe, expect, it } from 'vitest'
import {
  AFFINITY_MAX,
  AFFINITY_MIN,
  applyAffinityDelta,
  displayProgress,
  migrateScoreToAffinity,
  rollInitialAffinity,
  stageFromAffinity,
  stageGte,
} from '../src/game/affinity'

describe('stageFromAffinity', () => {
  it('maps bands including reverse hate', () => {
    expect(stageFromAffinity(-100)).toBe('hate')
    expect(stageFromAffinity(0)).toBe('hate')
    expect(stageFromAffinity(1)).toBe('cold')
    expect(stageFromAffinity(100)).toBe('cold')
    expect(stageFromAffinity(101)).toBe('neutral')
    expect(stageFromAffinity(250)).toBe('friendly')
    expect(stageFromAffinity(350)).toBe('close')
    expect(stageFromAffinity(500)).toBe('intimate')
  })

  it('displayProgress shows signed hate', () => {
    expect(displayProgress(-72)).toBe(-72)
    expect(displayProgress(40)).toBe(40)
    expect(displayProgress(150)).toBe(50)
  })
})

describe('applyAffinityDelta', () => {
  it('moves easier near center than near intimate', () => {
    const mid = applyAffinityDelta(150, 20)
    const high = applyAffinityDelta(450, 20)
    expect(mid.applied).toBeGreaterThan(high.applied)
  })

  it('hate recovery moves toward zero without stage damp', () => {
    const r = applyAffinityDelta(-40, 10)
    expect(r.affinity).toBeGreaterThan(-40)
    expect(r.affinity).toBeLessThanOrEqual(0)
  })

  it('harder to deepen hate near -100', () => {
    const shallow = applyAffinityDelta(-10, -20)
    const deep = applyAffinityDelta(-90, -20)
    expect(Math.abs(shallow.applied)).toBeGreaterThan(Math.abs(deep.applied))
  })

  it('clamps to bounds', () => {
    expect(applyAffinityDelta(495, 80).affinity).toBe(AFFINITY_MAX)
    expect(applyAffinityDelta(-95, -80).affinity).toBe(AFFINITY_MIN)
  })

  it('crossing zero enters cold', () => {
    const r = applyAffinityDelta(-3, 20)
    expect(r.affinity).toBeGreaterThan(0)
    expect(stageFromAffinity(r.affinity)).toBe('cold')
  })
})

describe('helpers', () => {
  it('stageGte', () => {
    expect(stageGte('friendly', 'cold')).toBe(true)
    expect(stageGte('cold', 'friendly')).toBe(false)
  })

  it('rollInitialAffinity stays positive mid bands', () => {
    const samples = [0, 0.2, 0.5, 0.9].map((x) => rollInitialAffinity(() => x))
    for (const a of samples) {
      expect(a).toBeGreaterThan(0)
      expect(['cold', 'neutral', 'friendly']).toContain(stageFromAffinity(a))
    }
  })

  it('migrateScoreToAffinity', () => {
    expect(migrateScoreToAffinity(50, false)).toBe(250)
    expect(migrateScoreToAffinity(5, true)).toBe(-60)
  })
})
