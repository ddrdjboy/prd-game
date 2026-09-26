import { shopBookValue } from './finance'
import { initialSkillsForName } from './relationsCatalog'
import {
  inferShopTypeId,
  shopTypeById,
} from './shopCatalog'
import {
  MAX_SKILLS,
  SHOP_SELL_RATIO,
  shopCapacity,
  skillById,
} from './skills'
import type { PlayerState, Relation, Shop, Track } from './types'

export function makeRelation(
  partial: Omit<Relation, 'skills' | 'training'> & Partial<Pick<Relation, 'skills' | 'training'>>,
): Relation {
  return {
    ...partial,
    skills: partial.skills ?? initialSkillsForName(partial.name),
    training: partial.training ?? null,
  }
}

export function relationShopId(player: PlayerState, relationId: string): string | null {
  const shop = player.shops.find((s) => s.staffIds.includes(relationId))
  return shop?.id ?? null
}

export function isRelationBusyTraining(r: Relation): boolean {
  return Boolean(r.training && r.training.turnsLeft > 0)
}

export function canAssignToShop(player: PlayerState, relationId: string): boolean {
  const r = player.relations.find((x) => x.id === relationId)
  if (!r || r.status === 'broken') return false
  if (isRelationBusyTraining(r)) return false
  if (relationShopId(player, relationId)) return false
  return true
}

export function meetsRequiredSkills(rel: Relation, required: string[]): boolean {
  if (!required.length) return true
  return required.every((id) => rel.skills.includes(id))
}

export function eligibleManagers(
  player: PlayerState,
  requiredSkills: string[] = [],
): Relation[] {
  return player.relations
    .filter((r) => canAssignToShop(player, r.id) && meetsRequiredSkills(r, requiredSkills))
    .sort((a, b) => b.score - a.score)
}

export function buildShop(opts: {
  id: string
  name: string
  level?: 1 | 2 | 3
  managerId: string
  typeId?: string
  /** 若传入则覆盖模板营收 */
  baseRevenue?: number
  baseCashflow?: number
  boardTrack?: Track | null
  boardIndex?: number | null
}): Shop {
  const typeId = opts.typeId ?? inferShopTypeId(opts.name)
  const def = shopTypeById(typeId)
  const level = opts.level ?? 1
  let baseRevenue = opts.baseRevenue ?? opts.baseCashflow ?? def?.baseRevenue ?? 0.25
  let operatingCost = def?.operatingCost ?? round2(baseRevenue * 0.45)
  // 若事件给了更高/更低营收，按比例缩放成本
  if (def && (opts.baseRevenue != null || opts.baseCashflow != null)) {
    const scale = baseRevenue / def.baseRevenue
    operatingCost = round2(def.operatingCost * scale)
  }
  // 应用升级树到目标 level
  if (def && level > 1) {
    for (let lv = 1; lv < level; lv++) {
      const step = def.upgrades[lv - 1]
      baseRevenue = round2(baseRevenue + step.revenueDelta)
      operatingCost = round2(operatingCost + step.costDelta)
    }
  }
  return {
    id: opts.id,
    name: opts.name,
    level,
    typeId,
    baseRevenue,
    operatingCost,
    baseCashflow: baseRevenue,
    lastFactor: 1,
    staffIds: [opts.managerId],
    managerId: opts.managerId,
    skillTags: def?.skillTags ?? ['sales', 'service'],
    requiredSkills: def?.requiredSkills ?? [],
    boardTrack: opts.boardTrack ?? null,
    boardIndex: opts.boardIndex ?? null,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function occupationLabel(player: PlayerState, rel: Relation): string {
  if (isRelationBusyTraining(rel)) return '进修中'
  const shop = player.shops.find((s) => s.staffIds.includes(rel.id))
  if (!shop) return '自由人'
  if (shop.managerId === rel.id) return `店长·${shop.name}`
  return `店员·${shop.name}`
}

export function removeStaffFromShops(
  shops: Shop[],
  relationId: string,
  relations: Relation[],
): { shops: Shop[]; closed: Shop[]; managerChanged: string[] } {
  const closed: Shop[] = []
  const managerChanged: string[] = []
  const next: Shop[] = []
  for (const shop of shops) {
    if (!shop.staffIds.includes(relationId)) {
      next.push(shop)
      continue
    }
    const staffIds = shop.staffIds.filter((id) => id !== relationId)
    if (!staffIds.length) {
      closed.push(shop)
      continue
    }
    let managerId = shop.managerId
    if (managerId === relationId) {
      managerId = staffIds
        .map((id) => relations.find((r) => r.id === id))
        .filter((r): r is Relation => Boolean(r))
        .sort((a, b) => b.score - a.score)[0]?.id ?? staffIds[0]
      managerChanged.push(shop.name)
    }
    next.push({ ...shop, staffIds, managerId })
  }
  return { shops: next, closed, managerChanged }
}

export function closeShopPayout(shop: Shop): number {
  return Math.round(shopBookValue(shop) * SHOP_SELL_RATIO * 100) / 100
}

export function canLearnSkill(rel: Relation, skillId: string): string | null {
  const def = skillById(skillId)
  if (!def) return '未知技能'
  if (rel.status === 'broken') return '关系已破裂'
  if (isRelationBusyTraining(rel)) return '正在进修中'
  if (rel.skills.includes(skillId)) return '已掌握该技能'
  if (rel.skills.length >= MAX_SKILLS) return '技能位已满（最多 3 个）'
  return null
}

export function shopHasCapacity(shop: Shop): boolean {
  return shop.staffIds.length < shopCapacity(shop.level)
}
