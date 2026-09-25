import { LIABILITY_INTEREST_RATE, MAINTENANCE_PER_RELATION, MARRIAGE_EXTRA_EXPENSE } from './config'
import type { FinanceSnapshot, PlayerState, Relation, Shop } from './types'

export function relationMultiplier(score: number): number {
  return 0.5 + score / 200
}

export function shopCashflow(shop: Shop, relations: Relation[]): number {
  const op = relations.find((r) => r.id === shop.operatorRelationId)
  if (!op || op.status === 'broken') return 0
  return shop.baseCashflow * relationMultiplier(op.score)
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
  return shop.baseCashflow * (2 + shop.level)
}

export function calcFinance(player: PlayerState): FinanceSnapshot {
  const salary = player.track === 'investor' ? round2(player.salary * 0.5) : player.salary
  const passiveIncome = calcPassiveIncome(player)
  const totalExpense = calcTotalExpense(player)
  const totalIncome = round2(salary + passiveIncome)
  const seasonalCashflow = round2(totalIncome - totalExpense)
  const assets =
    player.cash +
    player.shops.reduce((s, shop) => s + shopBookValue(shop), 0) +
    player.investments.reduce((s, i) => s + i.cost, 0)
  const netWorth = round2(assets - player.liabilities)
  const freeProgress = totalExpense <= 0 ? 2 : passiveIncome / totalExpense
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
  if (player.track === 'investor') return false
  const f = calcFinance(player)
  return f.passiveIncome > f.totalExpense
}

export function isFinanciallyFree(player: PlayerState): boolean {
  const f = calcFinance(player)
  return f.passiveIncome > f.totalExpense
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
