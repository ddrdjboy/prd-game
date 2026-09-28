import type { PlayerState } from './types'

/** 已登记的肖像 id；加图时只追加，勿复用旧 id */
export const PORTRAIT_CATALOG = ['g01', 'g02', 'g03', 'g04', 'g05'] as const

export type PortraitId = (typeof PORTRAIT_CATALOG)[number]

const CATALOG_SET = new Set<string>(PORTRAIT_CATALOG)

export function portraitUrl(id: string | undefined | null): string | null {
  if (!id || !CATALOG_SET.has(id)) return null
  return `/portraits/${id}.png`
}

export function usedPortraitIds(players: PlayerState[]): Set<string> {
  const used = new Set<string>()
  for (const p of players) {
    for (const r of p.relations) {
      if (r.portraitId) used.add(r.portraitId)
    }
  }
  return used
}

/** 从未占用的目录 id 中抽取；池空返回 undefined（UI 走 placeholder） */
export function pickPortraitId(used: Set<string>, rng: () => number): string | undefined {
  const free = PORTRAIT_CATALOG.filter((id) => !used.has(id))
  if (!free.length) return undefined
  return free[Math.floor(rng() * free.length)]
}
