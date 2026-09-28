import { describe, expect, it } from 'vitest'
import { countUpValue, flashTone } from '../src/ui/motion'

describe('countUpValue', () => {
  it('starts at 0 and ends exactly at target', () => {
    expect(countUpValue(123.45, 0)).toBe(0)
    expect(countUpValue(123.45, 1)).toBe(123.45)
  })

  it('clamps progress outside [0, 1]', () => {
    expect(countUpValue(80, -0.5)).toBe(0)
    expect(countUpValue(80, 2)).toBe(80)
  })

  it('eases out so the midpoint is past half', () => {
    expect(countUpValue(100, 0.5)).toBeGreaterThan(50)
    expect(countUpValue(100, 0.5)).toBeLessThan(100)
  })

  it('handles negative targets', () => {
    expect(countUpValue(-40, 1)).toBe(-40)
    expect(countUpValue(-40, 0.5)).toBeLessThan(-20)
  })
})

describe('flashTone', () => {
  it('returns null on first render or unchanged value', () => {
    expect(flashTone(undefined, 10)).toBeNull()
    expect(flashTone(10, 10)).toBeNull()
  })

  it('returns up / down by direction', () => {
    expect(flashTone(10, 12)).toBe('up')
    expect(flashTone(10, -3)).toBe('down')
  })
})
