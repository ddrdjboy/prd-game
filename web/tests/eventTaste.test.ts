import { describe, it, expect } from 'vitest'
import { diffPlayerTaste } from '../src/game/eventTaste'
import { buildShop } from '../src/game/shopStaff'
import type { PlayerState, Relation } from '../src/game/types'

function base(over: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p0',
    name: '你',
    isHuman: true,
    careerId: 'dev',
    salary: 1,
    fixedExpense: 0.5,
    cash: 2,
    liabilities: 0,
    track: 'worker',
    position: 0,
    relations: [],
    shops: [],
    investments: [],
    actionPoints: 1,
    aiStyle: null,
    trait: null,
    poachCooldown: 0,
    maintainedRelationIds: [],
    ...over,
  }
}

const rel = (over: Partial<Relation> & Pick<Relation, 'id'>): Relation => ({
  kind: 'network',
  name: '阿强',
  score: 40,
  status: 'stable',
  locked: false,
  skills: [],
  training: null,
  ...over,
})

function shopFixture(over: {
  id: string
  name: string
  level: 1 | 2 | 3
  baseCashflow: number
  managerId: string
  staffIds?: string[]
}) {
  const s = buildShop({
    id: over.id,
    name: over.name,
    level: over.level,
    managerId: over.managerId,
    baseCashflow: over.baseCashflow,
  })
  return {
    ...s,
    staffIds: over.staffIds ?? s.staffIds,
    managerId: over.managerId,
  }
}

describe('diffPlayerTaste', () => {
  it('reports cash and salary deltas', () => {
    const lines = diffPlayerTaste(base(), base({ cash: 2.25, salary: 1.1 }))
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '现金', delta: '+0.25 万', tone: 'pos' }),
        expect.objectContaining({ label: '工资', delta: '+0.1 万/季', tone: 'pos' }),
      ]),
    )
  })

  it('reports new and boosted relations', () => {
    const before = base({ relations: [rel({ id: 'r1', score: 40 })] })
    const after = base({
      relations: [
        rel({ id: 'r1', score: 52 }),
        rel({ id: 'r2', name: '小夏', kind: 'romance', status: 'dating', score: 45 }),
      ],
    })
    const lines = diffPlayerTaste(before, after)
    expect(lines.some((l) => l.label.includes('阿强') && l.delta.includes('+12'))).toBe(true)
    expect(lines.some((l) => l.label.includes('结识') && l.label.includes('小夏'))).toBe(true)
  })

  it('marks liability increase as negative tone', () => {
    const lines = diffPlayerTaste(base(), base({ liabilities: 1 }))
    expect(lines[0]).toMatchObject({ label: '负债', tone: 'neg' })
  })

  it('reports shop upgrade and staff change', () => {
    const before = base({
      shops: [shopFixture({ id: 's1', name: '小店', level: 1, baseCashflow: 0.3, managerId: 'r1' })],
      relations: [rel({ id: 'r1' }), rel({ id: 'r2', name: '阿伟' })],
    })
    const after = base({
      cash: 1.8,
      shops: [
        shopFixture({
          id: 's1',
          name: '小店',
          level: 2,
          baseCashflow: 0.36,
          managerId: 'r2',
          staffIds: ['r2'],
        }),
      ],
      relations: [rel({ id: 'r1' }), rel({ id: 'r2', name: '阿伟' })],
    })
    const lines = diffPlayerTaste(before, after)
    expect(lines.some((l) => l.label.includes('升级'))).toBe(true)
    expect(lines.some((l) => l.label.includes('编制') && l.delta.includes('阿伟'))).toBe(true)
  })

  it('returns empty when nothing changed', () => {
    expect(diffPlayerTaste(base(), base())).toEqual([])
  })
})
