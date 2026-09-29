// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useValueFlash } from '../src/ui/motion'

describe('useValueFlash', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const setup = (initial: number) =>
    renderHook(({ value }) => useValueFlash(value), { initialProps: { value: initial } })

  it('does not flash on initial render', () => {
    const { result } = setup(10)
    expect(result.current).toEqual({ className: '', key: 0 })
  })

  it('flashes up once and clears after the window', () => {
    const { result, rerender } = setup(10)
    rerender({ value: 12 })
    expect(result.current).toEqual({ className: 'flash-up', key: 1 })
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(result.current).toEqual({ className: '', key: 1 })
  })

  it('ignores changes while a flash is active', () => {
    const { result, rerender } = setup(10)
    rerender({ value: 12 })
    expect(result.current).toEqual({ className: 'flash-up', key: 1 })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    rerender({ value: 8 })
    rerender({ value: 9 })
    expect(result.current).toEqual({ className: 'flash-up', key: 1 })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toEqual({ className: '', key: 1 })
    rerender({ value: 11 })
    expect(result.current).toEqual({ className: 'flash-up', key: 2 })
  })

  it('flashes down on decrease', () => {
    const { result, rerender } = setup(10)
    rerender({ value: 7 })
    expect(result.current).toEqual({ className: 'flash-down', key: 1 })
  })
})
