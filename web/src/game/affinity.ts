/** 统一好感：仇恨反向 -100…0，正向冷淡→亲密各 100，总 [-100, 500] */

export type AffinityStage = 'hate' | 'cold' | 'neutral' | 'friendly' | 'close' | 'intimate'

export const AFFINITY_MIN = -100
export const AFFINITY_MAX = 500
export const AFFINITY_CENTER = 150

export const STAGE_ORDER: AffinityStage[] = [
  'hate',
  'cold',
  'neutral',
  'friendly',
  'close',
  'intimate',
]

export const STAGE_LABEL: Record<AffinityStage, string> = {
  hate: '仇恨',
  cold: '冷淡',
  neutral: '中立',
  friendly: '友善',
  close: '亲近',
  intimate: '亲密',
}

export function clampAffinity(a: number): number {
  return Math.max(AFFINITY_MIN, Math.min(AFFINITY_MAX, Math.round(a)))
}

export function stageFromAffinity(a: number): AffinityStage {
  if (a <= 0) return 'hate'
  if (a <= 100) return 'cold'
  if (a <= 200) return 'neutral'
  if (a <= 300) return 'friendly'
  if (a <= 400) return 'close'
  return 'intimate'
}

export function stageIndex(stage: AffinityStage): number {
  return STAGE_ORDER.indexOf(stage)
}

/** 仇恨返回负数读数；正向返回本阶段 1–100 进度 */
export function displayProgress(a: number): number {
  if (a <= 0) return a
  if (a <= 100) return a
  if (a <= 200) return a - 100
  if (a <= 300) return a - 200
  if (a <= 400) return a - 300
  return a - 400
}

export function stageGte(a: AffinityStage, min: AffinityStage): boolean {
  return stageIndex(a) >= stageIndex(min)
}

function stageMul(stage: AffinityStage): number {
  switch (stage) {
    case 'neutral':
      return 1
    case 'cold':
    case 'friendly':
      return 0.85
    case 'hate':
    case 'close':
      return 0.55
    case 'intimate':
      return 0.35
  }
}

function towardCenter(affinity: number, delta: number): boolean {
  if (delta > 0 && affinity < AFFINITY_CENTER) return true
  if (delta < 0 && affinity > AFFINITY_CENTER) return true
  return false
}

function awayFromCenter(affinity: number, delta: number): boolean {
  if (delta > 0 && affinity >= AFFINITY_CENTER) return true
  if (delta < 0 && affinity <= AFFINITY_CENTER) return true
  return false
}

function progressDamp(affinity: number, delta: number): number {
  const stage = stageFromAffinity(affinity)
  if (stage === 'hate') {
    if (delta >= 0) return 1
    const depth = Math.min(100, Math.max(0, -affinity))
    return 1 - 0.45 * (depth / 100)
  }
  const p = Math.min(100, Math.max(0, displayProgress(affinity)))
  if (delta > 0) return 1 - 0.45 * (p / 100)
  if (delta < 0) return 1 - 0.45 * ((100 - p) / 100)
  return 1
}

/** 同向移动时下一道边界（含终点） */
function nextBoundary(affinity: number, delta: number): number | null {
  if (delta > 0) {
    for (const b of [0, 100, 200, 300, 400, 500]) {
      if (affinity < b) return b
    }
    return null
  }
  if (delta < 0) {
    for (const b of [400, 300, 200, 100, 0, -100]) {
      if (affinity > b) return b
    }
    return null
  }
  return null
}

function mulFor(affinity: number, delta: number): number {
  let mul = 1
  if (towardCenter(affinity, delta)) {
    mul *= 1.1
  } else if (awayFromCenter(affinity, delta)) {
    mul *= stageMul(stageFromAffinity(affinity))
    mul *= progressDamp(affinity, delta)
  }
  return mul
}

/**
 * 应用原始好感增量，返回新 affinity 与实际变化量。
 * 跨阶段时拆步，最多递归数次。
 */
export function applyAffinityDelta(
  affinity: number,
  rawDelta: number,
  depth = 0,
): { affinity: number; applied: number } {
  const start = clampAffinity(affinity)
  if (rawDelta === 0 || depth > 4) return { affinity: start, applied: 0 }

  const mul = mulFor(start, rawDelta)
  let effective = Math.round(rawDelta * mul)
  if (effective === 0) effective = rawDelta > 0 ? 1 : -1

  const boundary = nextBoundary(start, effective)
  if (boundary != null) {
    const dist = boundary - start
    if (
      (effective > 0 && effective > dist) ||
      (effective < 0 && effective < dist)
    ) {
      const toBound = dist === 0 ? (effective > 0 ? 1 : -1) : dist
      const mid = clampAffinity(start + toBound)
      const used = mid - start
      const remainRaw = rawDelta * (1 - used / effective)
      const rest = applyAffinityDelta(mid, remainRaw, depth + 1)
      return { affinity: rest.affinity, applied: used + rest.applied }
    }
  }

  const next = clampAffinity(start + effective)
  return { affinity: next, applied: next - start }
}

/** 初识随机：冷淡 40 / 中立 150 / 友善 240，权重 3:5:2 */
export function rollInitialAffinity(rng: () => number): number {
  const r = rng()
  if (r < 3 / 10) return 40
  if (r < 8 / 10) return 150
  return 240
}

export function migrateScoreToAffinity(
  score: number,
  broken: boolean,
): number {
  if (broken || score <= 10) return -60
  return clampAffinity(Math.round(score * 5))
}
