import { LIABILITY_INTEREST_RATE, MAINTENANCE_PER_RELATION, MARRIAGE_EXTRA_EXPENSE } from './config'
import { rollSeasonFactor, shopTypeById } from './shopCatalog'
import { SKILL_BONUS_CAP, skillById } from './skills'
import type { FinanceSnapshot, PlayerState, Relation, Shop } from './types'

export function relationMultiplier(score: number): number {
  return 0.5 + score / 200
}

export interface ShopBreakdown {
  gross: number
  cost: number
  net: number
  factor: number
  staffScore: number
}

export function shopStaffMods(
  shop: Shop,
  relations: Relation[],
): { staffScore: number; skillBonus: number; managerBonus: number; hasStaff: boolean } {
  const staff = shop.staffIds
    .map((id) => relations.find((r) => r.id === id))
    .filter((r): r is Relation => Boolean(r) && r.status !== 'broken')
  if (!staff.length) {
    return { staffScore: 0, skillBonus: 0, managerBonus: 0, hasStaff: false }
  }

  const staffScore =
    staff.reduce((sum, r) => sum + relationMultiplier(r.score), 0) / staff.length

  let skillBonus = 0
  for (const r of staff) {
    for (const sid of r.skills) {
      if (!shop.skillTags.includes(sid)) continue
      skillBonus += skillById(sid)?.shopBonus ?? 0
    }
  }
  skillBonus = Math.min(SKILL_BONUS_CAP, skillBonus)

  let managerBonus = 0
  const manager = staff.find((r) => r.id === shop.managerId) ?? staff[0]
  if (manager.skills.includes('manage')) managerBonus += 0.1
  else if (manager.skills.some((s) => shop.skillTags.includes(s))) managerBonus += 0.05

  return { staffScore, skillBonus, managerBonus, hasStaff: true }
}

/** 预期净额（用 lastFactor 或 1，供 UI/AI） */
export function shopBreakdown(
  shop: Shop,
  relations: Relation[],
  factor = shop.lastFactor || 1,
): ShopBreakdown {
  const mods = shopStaffMods(shop, relations)
  if (!mods.hasStaff) {
    return { gross: 0, cost: shop.operatingCost, net: round2(-shop.operatingCost), factor, staffScore: 0 }
  }
  const revenue = shop.baseRevenue || shop.baseCashflow
  const gross = round2(
    revenue * mods.staffScore * (1 + mods.skillBonus + mods.managerBonus) * factor,
  )
  const cost = shop.operatingCost
  return { gross, cost, net: round2(gross - cost), factor, staffScore: mods.staffScore }
}

export function shopCashflow(shop: Shop, relations: Relation[]): number {
  return shopBreakdown(shop, relations).net
}

export function calcPassiveIncome(player: PlayerState): number {
  const fromShops = player.shops.reduce((sum, s) => sum + shopCashflow(s, player.relations), 0)
  const fromInvest = player.investments.reduce((sum, i) => sum + i.cashflow, 0)
  return round2(fromShops + fromInvest)
}

export function calcTotalExpense(player: PlayerState): number {
  const maintenance =
    player.relations.filter((r) => r.status !== 'broken').length * MAINTENANCE_PER_RELATION
  const marriage =
    player.relations.some((r) => r.status === 'married') ? MARRIAGE_EXTRA_EXPENSE : 0
  const interest = player.liabilities * LIABILITY_INTEREST_RATE
  let expense = player.fixedExpense + maintenance + marriage + interest
  if (player.trait === 'expenseResist') expense *= 0.9
  return round2(expense)
}

export function shopBookValue(shop: Shop): number {
  const rev = shop.baseRevenue || shop.baseCashflow
  const cost = shop.operatingCost ?? rev * 0.45
  return round2((rev * 1.5 - cost * 0.5) * (1 + shop.level * 0.3))
}

export function calcFinance(player: PlayerState): FinanceSnapshot {
  const salary = player.track === 'investor' ? round2(player.salary * 0.5) : player.salary
  const passiveIncome = calcPassiveIncome(player)
  const totalExpense = calcTotalExpense(player)
  const totalIncome = round2(salary + passiveIncome)
  const seasonalCashflow = round2(totalIncome - totalExpense)
  const shopValue = player.shops.reduce((s, shop) => s + shopBookValue(shop), 0)
  const investValue = player.investments.reduce((s, i) => s + i.cost, 0)
  const netWorth = round2(player.cash + shopValue + investValue - player.liabilities)
  const freeProgress =
    totalExpense <= 0 ? 1 : Math.min(1, Math.max(0, passiveIncome / totalExpense))
  return {
    salary,
    passiveIncome,
    totalIncome,
    totalExpense,
    seasonalCashflow,
    netWorth,
    freeProgress,
  }
}

export function canPromote(player: PlayerState): boolean {
  const f = calcFinance(player)
  return player.track === 'worker' && f.passiveIncome > f.totalExpense
}

export function isFinanciallyFree(player: PlayerState): boolean {
  const f = calcFinance(player)
  return f.passiveIncome >= f.totalExpense && f.totalExpense > 0
}

/** 发薪时为每店掷行情并返回更新后的 shops + 本季店铺净合计 */
export function rollShopSeason(
  player: PlayerState,
  seasonIndex: number,
  rng: () => number,
): { shops: Shop[]; shopNet: number } {
  let shopNet = 0
  const shops = player.shops.map((shop) => {
    const def = shopTypeById(shop.typeId)
    const vol = def?.volatility ?? 0.1
    const factor = rollSeasonFactor(seasonIndex, vol, rng)
    const next = { ...shop, lastFactor: factor }
    shopNet = round2(shopNet + shopBreakdown(next, player.relations, factor).net)
    return next
  })
  return { shops, shopNet }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
