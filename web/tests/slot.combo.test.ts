import { describe, it, expect } from 'vitest'
import { resolveSlotEvent } from '../src/game/slotEvents'

describe('slot combo labels', () => {
  it('labels 777 / pair / lucky 7', () => {
    expect(resolveSlotEvent([7, 7, 7], 'worker').comboLabel).toBe('777 连爆')
    expect(resolveSlotEvent([3, 5, 5], 'worker').comboLabel).toBe('对子 55')
    expect(resolveSlotEvent([2, 7, 1], 'worker').comboLabel).toBe('带 7 小奖')
  })

  it('applies cash once via extraEffects', () => {
    const r = resolveSlotEvent([7, 7, 7], 'worker')
    const cash = r.extraEffects.filter((e) => e.type === 'cash')
    expect(cash).toHaveLength(1)
    expect(cash[0]).toMatchObject({ type: 'cash', delta: 0.77 })
  })
})
