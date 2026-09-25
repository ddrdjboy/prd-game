import { describe, it, expect } from 'vitest'
import { kindFromSlotDigit, resolveSlotEvent } from '../src/game/slotEvents'

describe('slotEvents', () => {
  it('maps second digit to event kinds', () => {
    expect(kindFromSlotDigit(1, 'worker')).toBe('opportunity')
    expect(kindFromSlotDigit(3, 'worker')).toBe('doodad')
    expect(kindFromSlotDigit(6, 'worker')).toBe('career')
    expect(kindFromSlotDigit(0, 'investor')).toBe('cashflowDay')
  })

  it('picks concrete event from third digit', () => {
    const a = resolveSlotEvent([3, 1, 0], 'worker')
    const b = resolveSlotEvent([3, 1, 1], 'worker')
    expect(a.event.kind).toBe('opportunity')
    expect(b.event.kind).toBe('opportunity')
    expect(a.kindLabel).toBe('机会')
    // different third digit usually different card (unless pool wraps identically)
    expect(a.event.id).not.toBe(b.event.id)
  })

  it('adds combo bonus for 777', () => {
    const r = resolveSlotEvent([7, 7, 7], 'worker')
    expect(r.comboLabel).toContain('777')
    expect(r.extraEffects.some((e) => e.type === 'cash')).toBe(true)
  })
})
