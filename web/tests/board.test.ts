import { describe, it, expect } from 'vitest'
import { buildTrack, move, squareCoord } from '../src/game/board'
import { SPACES_PER_SIDE, WORKER_SPACES } from '../src/game/config'

describe('board', () => {
  it('builds square worker track with location spaces', () => {
    const t = buildTrack('worker')
    expect(t.length).toBe(WORKER_SPACES)
    expect(t.length).toBe(4 * (SPACES_PER_SIDE - 1))
    expect(t.some((s) => s.kind === 'payday')).toBe(true)
    expect(t.some((s) => s.kind === 'vacant')).toBe(true)
    expect(t.some((s) => s.kind === 'shop')).toBe(true)
    expect(t.some((s) => s.kind === 'office')).toBe(true)
    expect(t.some((s) => s.kind === 'manage')).toBe(true)
    expect(t.some((s) => s.kind === 'casino')).toBe(true)
  })

  it('wraps around with path', () => {
    const t = buildTrack('worker')
    const { position, path } = move(WORKER_SPACES - 2, 3, t)
    expect(path.length).toBe(3)
    expect(position).toBe(1)
  })

  it('maps indices onto square perimeter', () => {
    const seen = new Set<string>()
    for (let i = 0; i < WORKER_SPACES; i++) {
      const { row, col } = squareCoord(i)
      expect(row === 0 || row === SPACES_PER_SIDE - 1 || col === 0 || col === SPACES_PER_SIDE - 1).toBe(
        true,
      )
      seen.add(`${row},${col}`)
    }
    expect(seen.size).toBe(WORKER_SPACES)
  })
})
