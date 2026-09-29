import { describe, it, expect } from 'vitest'
import { RING_SHAPES, buildTrack, fitRing, move, ringCoord, squareCoord } from '../src/game/board'
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

  it('ring shapes keep the same perimeter as the square', () => {
    expect(RING_SHAPES[0]).toEqual({ cols: SPACES_PER_SIDE, rows: SPACES_PER_SIDE })
    for (const { cols, rows } of RING_SHAPES) {
      expect(2 * (cols - 1 + rows - 1)).toBe(WORKER_SPACES)
      expect(cols - 2).toBeGreaterThanOrEqual(4)
    }
  })

  it('ringCoord walks each tall ring clockwise along the edge', () => {
    for (const { cols, rows } of RING_SHAPES) {
      const seen = new Set<string>()
      let prev = ringCoord(WORKER_SPACES - 1, cols, rows)
      for (let i = 0; i < WORKER_SPACES; i++) {
        const c = ringCoord(i, cols, rows)
        expect(c.row === 0 || c.row === rows - 1 || c.col === 0 || c.col === cols - 1).toBe(true)
        expect(Math.abs(c.row - prev.row) + Math.abs(c.col - prev.col)).toBe(1)
        seen.add(`${c.row},${c.col}`)
        prev = c
      }
      expect(seen.size).toBe(WORKER_SPACES)
    }
    expect(ringCoord(0, 7, 13)).toEqual({ row: 0, col: 0 })
    expect(ringCoord(6, 7, 13)).toEqual({ row: 0, col: 6 })
    expect(ringCoord(18, 7, 13)).toEqual({ row: 12, col: 6 })
  })

  it('squareCoord matches ringCoord on the square', () => {
    for (let i = 0; i < WORKER_SPACES; i++) {
      expect(squareCoord(i)).toEqual(ringCoord(i, SPACES_PER_SIDE, SPACES_PER_SIDE))
    }
  })

  it('fitRing picks square on wide containers and tall rings on portrait phones', () => {
    expect(fitRing(800, 600)).toMatchObject({ cols: 10, rows: 10 })
    const phone = fitRing(380, 700)
    expect(phone.rows).toBeGreaterThan(phone.cols)
    expect(phone.cellW).toBeGreaterThan(50)
    const small = fitRing(365, 540)
    expect(small.cols).toBeLessThan(10)
    for (const f of [phone, small, fitRing(800, 600), fitRing(300, 1200)]) {
      expect(f.cellW / f.cellH).toBeLessThanOrEqual(1.3 + 1e-9)
      expect(f.cellH / f.cellW).toBeLessThanOrEqual(1.3 + 1e-9)
    }
  })
})
