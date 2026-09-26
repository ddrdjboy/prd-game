import { describe, it, expect } from 'vitest'
import { hasSeenTutorial, markTutorialSeen, TUTORIAL_STORAGE_KEY } from '../src/ui/tutorial'

describe('tutorial storage helpers', () => {
  it('marks and reads seen flag', () => {
    const mem = new Map<string, string>()
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
    }
    expect(hasSeenTutorial(storage)).toBe(false)
    markTutorialSeen(storage)
    expect(mem.get(TUTORIAL_STORAGE_KEY)).toBe('1')
    expect(hasSeenTutorial(storage)).toBe(true)
  })
})
