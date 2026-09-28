import { useEffect, useRef, useState } from 'react'

export type FlashTone = 'up' | 'down' | null

const COUNT_UP_MS = 900
const FLASH_MS = 700

export function countUpValue(target: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  if (p === 1) return target
  const eased = 1 - Math.pow(1 - p, 3)
  return Math.round(target * eased * 100) / 100
}

export function flashTone(prev: number | undefined, next: number): FlashTone {
  if (prev === undefined || prev === next) return null
  return next > prev ? 'up' : 'down'
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

export function useCountUp(target: number, durationMs = COUNT_UP_MS): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0))

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(target)
      return
    }
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = (now - start) / durationMs
      setShown(countUpValue(target, t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return shown
}

/** `key` 需挂到元素上，连续同向变化时靠重新挂载重启动画 */
export function useValueFlash(value: number): { className: string; key: number } {
  const prev = useRef(value)
  const [flash, setFlash] = useState<{ tone: FlashTone; key: number }>({ tone: null, key: 0 })

  useEffect(() => {
    const tone = flashTone(prev.current, value)
    prev.current = value
    if (!tone) return
    setFlash((f) => ({ tone, key: f.key + 1 }))
    const id = window.setTimeout(() => setFlash((f) => ({ tone: null, key: f.key })), FLASH_MS)
    return () => window.clearTimeout(id)
  }, [value])

  return { className: flash.tone ? `flash-${flash.tone}` : '', key: flash.key }
}
