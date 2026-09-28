import { CHARACTERS, characterByName } from './portraits'

/** 统一名册：与 20 定妆角色一一对应 */
export const RELATION_NAMES = CHARACTERS.map((c) => c.name)

/** @deprecated 兼容旧引用；等同 RELATION_NAMES */
export const NETWORK_NAMES = RELATION_NAMES
/** @deprecated 兼容旧引用；等同 RELATION_NAMES */
export const ROMANCE_NAMES = RELATION_NAMES

/** 人名 → 固定初始技能（0–3），来自角色目录；旧存档人名保留回退 */
const LEGACY_SKILLS_BY_NAME: Record<string, string[]> = {
  阿强: ['sales'],
  小林: ['service'],
  老周: ['manage', 'retail'],
  晓雯: ['service'],
  诗涵: ['creative'],
}

export const INITIAL_SKILLS_BY_NAME: Record<string, string[]> = {
  ...LEGACY_SKILLS_BY_NAME,
  ...Object.fromEntries(CHARACTERS.map((c) => [c.name, [...c.skills]])),
}

export function initialSkillsForName(name: string): string[] {
  const fromCatalog = characterByName(name)?.skills
  const raw = fromCatalog ?? INITIAL_SKILLS_BY_NAME[name]
  if (!raw) return []
  return [...new Set(raw)].slice(0, 3)
}

export function pickName(pool: string[], used: Set<string>, rng: () => number): string {
  const available = pool.filter((n) => !used.has(n))
  const list = available.length ? available : pool
  return list[Math.floor(rng() * list.length)]
}
