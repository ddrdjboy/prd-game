import type { PlayerState } from './types'

export type TasteLine = {
  label: string
  /** 已格式化的变化文案，如 +0.25 万 */
  delta: string
  tone: 'pos' | 'neg' | 'neutral'
}

function fmt(n: number): string {
  const v = Math.round(n * 100) / 100
  const sign = v > 0 ? '+' : ''
  return `${sign}${v}`
}

function toneOf(n: number): 'pos' | 'neg' | 'neutral' {
  if (n > 1e-9) return 'pos'
  if (n < -1e-9) return 'neg'
  return 'neutral'
}

/** 对比事件结算前后的玩家状态，生成可读的数值变化行 */
export function diffPlayerTaste(before: PlayerState, after: PlayerState): TasteLine[] {
  const lines: TasteLine[] = []

  const cashD = after.cash - before.cash
  if (Math.abs(cashD) > 1e-9) {
    lines.push({ label: '现金', delta: `${fmt(cashD)} 万`, tone: toneOf(cashD) })
  }

  const salD = after.salary - before.salary
  if (Math.abs(salD) > 1e-9) {
    lines.push({ label: '工资', delta: `${fmt(salD)} 万/季`, tone: toneOf(salD) })
  }

  const liabD = after.liabilities - before.liabilities
  if (Math.abs(liabD) > 1e-9) {
    // 负债增加偏负向
    lines.push({
      label: '负债',
      delta: `${fmt(liabD)} 万`,
      tone: liabD > 0 ? 'neg' : 'pos',
    })
  }

  const beforeRel = new Map(before.relations.map((r) => [r.id, r]))
  for (const r of after.relations) {
    const prev = beforeRel.get(r.id)
    if (!prev) {
      lines.push({
        label: `结识「${r.name}」`,
        delta: `好感 ${r.score}`,
        tone: 'pos',
      })
      continue
    }
    const scoreD = r.score - prev.score
    if (Math.abs(scoreD) > 1e-9 || r.status !== prev.status) {
      const statusBit = r.status !== prev.status ? ` · ${statusHint(r.status)}` : ''
      lines.push({
        label: `「${r.name}」`,
        delta: `${fmt(scoreD)} 好感${statusBit}`,
        tone: toneOf(scoreD),
      })
    }
  }
  for (const r of before.relations) {
    if (!after.relations.some((x) => x.id === r.id)) {
      lines.push({ label: `失去「${r.name}」`, delta: '关系离开', tone: 'neg' })
    }
  }

  const beforeShops = new Map(before.shops.map((s) => [s.id, s]))
  for (const s of after.shops) {
    const prev = beforeShops.get(s.id)
    if (!prev) {
      lines.push({
        label: `开店「${s.name}」`,
        delta: `现金流 +${s.baseCashflow}`,
        tone: 'pos',
      })
      continue
    }
    if (s.level !== prev.level || Math.abs(s.baseRevenue - prev.baseRevenue) > 1e-9 || Math.abs(s.baseCashflow - prev.baseCashflow) > 1e-9) {
      lines.push({
        label: `「${s.name}」升级`,
        delta: `Lv.${prev.level}→${s.level} · 营收 ${fmt((s.baseRevenue || s.baseCashflow) - (prev.baseRevenue || prev.baseCashflow))}`,
        tone: 'pos',
      })
    }
    if (s.managerId !== prev.managerId || s.staffIds.join(',') !== prev.staffIds.join(',')) {
      const mgr =
        after.relations.find((r) => r.id === s.managerId)?.name ?? '店长'
      lines.push({
        label: `「${s.name}」编制`,
        delta: `店长 ${mgr} · ${s.staffIds.length} 人`,
        tone: 'neutral',
      })
    }
  }

  const beforeInv = new Set(before.investments.map((i) => i.id))
  for (const inv of after.investments) {
    if (!beforeInv.has(inv.id)) {
      lines.push({
        label: `购入「${inv.name}」`,
        delta: `现金流 +${inv.cashflow}`,
        tone: 'pos',
      })
    } else {
      const prev = before.investments.find((i) => i.id === inv.id)!
      const cfD = inv.cashflow - prev.cashflow
      const costD = inv.cost - prev.cost
      if (Math.abs(cfD) > 1e-9 || Math.abs(costD) > 1e-9) {
        lines.push({
          label: `「${inv.name}」市值`,
          delta: costD !== 0 ? `${fmt(costD)} 万` : `现金流 ${fmt(cfD)}`,
          tone: toneOf(costD !== 0 ? costD : cfD),
        })
      }
    }
  }
  for (const inv of before.investments) {
    if (!after.investments.some((x) => x.id === inv.id)) {
      lines.push({ label: `卖出/失去「${inv.name}」`, delta: '投资离开', tone: 'neg' })
    }
  }

  return lines
}

function statusHint(status: string): string {
  switch (status) {
    case 'broken':
      return '破裂'
    case 'partner':
      return '升为合伙人'
    case 'stable':
      return '变稳定'
    case 'married':
      return '已婚'
    default:
      return status
  }
}
