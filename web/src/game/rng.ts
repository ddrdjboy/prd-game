/** Mulberry32 seeded PRNG */
export function createRng(seed: number): { next: () => number; state: () => number; setState: (s: number) => void } {
  let s = seed >>> 0
  return {
    next() {
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    state: () => s,
    setState: (v: number) => {
      s = v >>> 0
    },
  }
}
