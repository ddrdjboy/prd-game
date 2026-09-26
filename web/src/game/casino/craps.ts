export type DiceLine = 'pass' | 'dontPass'

export interface DiceRound {
  phase: 'betting' | 'comeOut' | 'point' | 'settled'
  line: DiceLine | null
  /** Field 附加注，0 表示不下 */
  fieldStake: number
  stake: number
  point: number | null
  lastDice: [number, number] | null
  lastTotal: number | null
  payoutDelta: number
  message: string
  /** point 阶段累计输赢（line）；field 在 come-out 已结 */
  lineSettled: boolean
}

export function emptyDice(): DiceRound {
  return {
    phase: 'betting',
    line: null,
    fieldStake: 0,
    stake: 0,
    point: null,
    lastDice: null,
    lastTotal: null,
    payoutDelta: 0,
    message: '选择 Pass / Don\'t Pass，可选 Field',
    lineSettled: false,
  }
}

export function roll2d6(rng: () => number): [number, number] {
  const a = 1 + Math.floor(rng() * 6)
  const b = 1 + Math.floor(rng() * 6)
  return [a, b]
}

function fieldPayout(total: number, stake: number): number {
  if (stake <= 0) return 0
  if (total === 2 || total === 12) return round2(stake * 2)
  if ([3, 4, 9, 10, 11].includes(total)) return stake
  return round2(-stake)
}

/** Come-out 一掷：结算 Field，并可能结束 line 或立 point */
export function comeOutRoll(
  round: DiceRound,
  dice: [number, number],
): DiceRound {
  const total = dice[0] + dice[1]
  const fieldDelta = fieldPayout(total, round.fieldStake)
  const line = round.line!
  const stake = round.stake

  if (line === 'pass') {
    if (total === 7 || total === 11) {
      return settled(round, dice, total, round2(stake + fieldDelta), `Pass 通杀点 ${total} 赢；Field ${fmtField(fieldDelta)}`)
    }
    if (total === 2 || total === 3 || total === 12) {
      return settled(round, dice, total, round2(-stake + fieldDelta), `Pass Craps ${total} 输；Field ${fmtField(fieldDelta)}`)
    }
    return {
      ...round,
      phase: 'point',
      point: total,
      lastDice: dice,
      lastTotal: total,
      payoutDelta: fieldDelta,
      message: `Point ${total}。Field ${fmtField(fieldDelta)}。继续掷至 ${total} 或 7`,
      lineSettled: false,
    }
  }

  // don't pass
  if (total === 2 || total === 3) {
    return settled(round, dice, total, round2(stake + fieldDelta), `Don't Pass 通杀点 ${total} 赢；Field ${fmtField(fieldDelta)}`)
  }
  if (total === 7 || total === 11) {
    return settled(round, dice, total, round2(-stake + fieldDelta), `Don't Pass 通杀点 ${total} 输；Field ${fmtField(fieldDelta)}`)
  }
  if (total === 12) {
    return settled(round, dice, total, fieldDelta, `Don't Pass 12 推注；Field ${fmtField(fieldDelta)}`)
  }
  return {
    ...round,
    phase: 'point',
    point: total,
    lastDice: dice,
    lastTotal: total,
    payoutDelta: fieldDelta,
    message: `Point ${total}（Don't Pass）。Field ${fmtField(fieldDelta)}。掷 7 赢、${total} 输`,
    lineSettled: false,
  }
}

export function pointRoll(round: DiceRound, dice: [number, number]): DiceRound {
  const total = dice[0] + dice[1]
  const point = round.point!
  const stake = round.stake
  const prior = round.payoutDelta // field already in

  if (round.line === 'pass') {
    if (total === point) {
      return settled(round, dice, total, round2(prior + stake), `Pass 打中 point ${point}！`)
    }
    if (total === 7) {
      return settled(round, dice, total, round2(prior - stake), `Pass 七点出局`)
    }
    return {
      ...round,
      lastDice: dice,
      lastTotal: total,
      message: `掷出 ${total}，point 仍为 ${point}`,
    }
  }

  // don't pass
  if (total === 7) {
    return settled(round, dice, total, round2(prior + stake), `Don't Pass 七点赢`)
  }
  if (total === point) {
    return settled(round, dice, total, round2(prior - stake), `Don't Pass point ${point} 输`)
  }
  return {
    ...round,
    lastDice: dice,
    lastTotal: total,
    message: `掷出 ${total}，point 仍为 ${point}`,
  }
}

function settled(
  round: DiceRound,
  dice: [number, number],
  total: number,
  payoutDelta: number,
  message: string,
): DiceRound {
  return {
    ...round,
    phase: 'settled',
    lastDice: dice,
    lastTotal: total,
    payoutDelta,
    message,
    lineSettled: true,
  }
}

function fmtField(d: number): string {
  if (d === 0) return '无'
  return d > 0 ? `+${d}` : `${d}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
