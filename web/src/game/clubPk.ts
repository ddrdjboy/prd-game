import {
  CLUB_CRIT_CHANCE,
  CLUB_MAX_ROUNDS,
  CLUB_MAX_TEAM,
  CLUB_REWARD_ASSET,
  CLUB_REWARD_CASH,
  CLUB_REWARD_PASSIVE,
} from './config'
import { stageFromAffinity, type AffinityStage } from './affinity'
import { CHARACTERS, type CharacterDef } from './portraits'
import { round2 } from './finance'
import type { Investment, PlayerState, Relation } from './types'

export type ClubFighter = {
  id: string
  name: string
  portraitId?: string
  /** 现金 = 血量 */
  hp: number
  maxHp: number
  /** 被动收入 = 攻击 */
  atk: number
  /** 资产 = 出手顺位 */
  spd: number
  side: 'player' | 'cpu'
  /** 班底不可挖 */
  recruitable: boolean
  /** 倒下顺序，越小越早倒；存活为 null */
  downOrder: number | null
}

export type ClubHitLog = {
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  damage: number
  crit: boolean
  targetHpAfter: number
  ko: boolean
}

export type ClubBattleResult = {
  fighters: ClubFighter[]
  log: ClubHitLog[]
  winner: 'player' | 'cpu'
  rounds: number
}

const STAGE_MUL: Record<AffinityStage, number> = {
  hate: 0.4,
  cold: 0.6,
  neutral: 1,
  friendly: 1.3,
  close: 1.6,
  intimate: 2,
}

function skillWeights(skills: string[]): { hp: number; atk: number; spd: number } {
  let hp = 1
  let atk = 1
  let spd = 1
  for (const s of skills) {
    if (s === 'creative' || s === 'cook' || s === 'retail') hp += 0.45
    if (s === 'service' || s === 'sales') atk += 0.45
    if (s === 'manage') spd += 0.55
  }
  return { hp, atk, spd }
}

/** 战斗三项：底数 × 技能权重 × 好感阶 */
export function fighterStats(
  skills: string[],
  affinity: number,
): { hp: number; atk: number; spd: number } {
  const stage = stageFromAffinity(affinity)
  const mul = STAGE_MUL[stage]
  const w = skillWeights(skills)
  const base = 10
  return {
    hp: Math.max(1, Math.round(base * w.hp * mul * 10) / 10),
    atk: Math.max(1, Math.round(base * 0.35 * w.atk * mul * 10) / 10),
    spd: Math.max(1, Math.round(base * 0.4 * w.spd * mul * 10) / 10),
  }
}

export function relationToFighter(r: Relation, _index = 0): ClubFighter {
  const stats = fighterStats(r.skills, r.affinity)
  return {
    id: r.id,
    name: r.name,
    portraitId: r.portraitId,
    hp: stats.hp,
    maxHp: stats.hp,
    atk: stats.atk,
    spd: stats.spd,
    side: 'player',
    recruitable: true,
    downOrder: null,
  }
}

export function characterToCpuFighter(
  c: CharacterDef,
  index: number,
  recruitable: boolean,
): ClubFighter {
  const stats = fighterStats(c.skills, 250) // 友善中段
  return {
    id: `cpu-${c.portraitId}-${index}`,
    name: c.name,
    portraitId: c.portraitId,
    hp: stats.hp,
    maxHp: stats.hp,
    atk: stats.atk,
    spd: stats.spd,
    side: 'cpu',
    recruitable,
    downOrder: null,
  }
}

export function eligibleClubRelations(player: PlayerState): Relation[] {
  return player.relations.filter((r) => stageFromAffinity(r.affinity) !== 'hate')
}

export function buildCpuTeam(
  player: PlayerState,
  rng: () => number,
  size = CLUB_MAX_TEAM,
): ClubFighter[] {
  const met = new Set(player.relations.map((r) => r.name))
  const unmet = CHARACTERS.filter((c) => !met.has(c.name))
  const team: ClubFighter[] = []
  const pool = [...unmet]
  while (team.length < size && pool.length) {
    const i = Math.floor(rng() * pool.length)
    const [c] = pool.splice(i, 1)
    team.push(characterToCpuFighter(c, team.length, true))
  }
  // 班底补满
  let filler = 0
  while (team.length < size) {
    const c = CHARACTERS[filler % CHARACTERS.length]
    team.push(
      characterToCpuFighter(
        { ...c, name: `${c.name}·班底`, portraitId: c.portraitId },
        team.length,
        false,
      ),
    )
    filler++
  }
  return team
}

function alive(side: 'player' | 'cpu', fighters: ClubFighter[]): ClubFighter[] {
  return fighters.filter((f) => f.side === side && f.hp > 0)
}

function pickTarget(attacker: ClubFighter, fighters: ClubFighter[]): ClubFighter | null {
  const foes = alive(attacker.side === 'player' ? 'cpu' : 'player', fighters)
  if (!foes.length) return null
  return [...foes].sort((a, b) => a.hp - b.hp || a.spd - b.spd)[0] ?? null
}

function turnOrder(fighters: ClubFighter[]): ClubFighter[] {
  return [...fighters]
    .filter((f) => f.hp > 0)
    .sort((a, b) => {
      if (b.spd !== a.spd) return b.spd - a.spd
      if (a.side !== b.side) return a.side === 'player' ? -1 : 1
      return 0
    })
}

export function runClubBattle(
  playerTeam: ClubFighter[],
  cpuTeam: ClubFighter[],
  rng: () => number,
): ClubBattleResult {
  let fighters = [...playerTeam, ...cpuTeam].map((f) => ({ ...f }))
  const log: ClubHitLog[] = []
  let downSeq = 0
  let rounds = 0

  while (rounds < CLUB_MAX_ROUNDS) {
    if (!alive('player', fighters).length || !alive('cpu', fighters).length) break
    rounds++
    const order = turnOrder(fighters)
    for (const actor of order) {
      const live = fighters.find((f) => f.id === actor.id)
      if (!live || live.hp <= 0) continue
      const target = pickTarget(live, fighters)
      if (!target) break
      const roll = rng() * live.atk
      let damage = round2(live.atk + roll)
      const crit = rng() < CLUB_CRIT_CHANCE
      if (crit) damage = round2(damage * 2)
      fighters = fighters.map((f) => {
        if (f.id !== target.id) return f
        const hp = round2(Math.max(0, f.hp - damage))
        const ko = hp <= 0 && f.hp > 0
        return {
          ...f,
          hp,
          downOrder: ko ? downSeq++ : f.downOrder,
        }
      })
      const after = fighters.find((f) => f.id === target.id)!
      log.push({
        actorId: live.id,
        actorName: live.name,
        targetId: target.id,
        targetName: target.name,
        damage,
        crit,
        targetHpAfter: after.hp,
        ko: after.hp <= 0,
      })
      if (!alive('player', fighters).length || !alive('cpu', fighters).length) break
    }
  }

  const pHp = alive('player', fighters).reduce((s, f) => s + f.hp, 0)
  const cHp = alive('cpu', fighters).reduce((s, f) => s + f.hp, 0)
  let winner: 'player' | 'cpu'
  if (!alive('player', fighters).length) winner = 'cpu'
  else if (!alive('cpu', fighters).length) winner = 'player'
  else winner = pHp >= cHp ? 'player' : 'cpu'

  return { fighters, log, winner, rounds }
}

export function applyClubRewards(
  player: PlayerState,
  won: boolean,
): { player: PlayerState; assetGain: number } {
  const sign = won ? 1 : -1
  const cashDelta = CLUB_REWARD_CASH * sign
  const passiveDelta = CLUB_REWARD_PASSIVE * sign
  const assetDelta = CLUB_REWARD_ASSET * sign

  let cash = round2(Math.max(0, player.cash + cashDelta))
  let investments = [...player.investments]
  let assetGain = 0

  if (assetDelta > 0) {
    const inv: Investment = {
      id: `club-asset-${Date.now()}`,
      name: '会所战利品',
      cost: assetDelta,
      cashflow: 0,
    }
    investments = [...investments, inv]
    assetGain = assetDelta
  } else if (assetDelta < 0) {
    // 从投资本金里扣，扣到 0
    let remain = -assetDelta
    investments = investments
      .map((i) => {
        if (remain <= 0) return i
        const cut = Math.min(i.cost, remain)
        remain = round2(remain - cut)
        return { ...i, cost: round2(i.cost - cut) }
      })
      .filter((i) => i.cost > 0.001)
    assetGain = assetDelta
  }

  // 被动收入：加/减一笔 cashflow 投资；败方从现有 cashflow 投资扣
  if (passiveDelta > 0) {
    investments = [
      ...investments,
      {
        id: `club-cf-${Date.now()}`,
        name: '会所分红',
        cost: 0,
        cashflow: passiveDelta,
      },
    ]
  } else if (passiveDelta < 0) {
    let remain = -passiveDelta
    investments = investments.map((i) => {
      if (remain <= 0 || i.cashflow <= 0) return i
      const cut = Math.min(i.cashflow, remain)
      remain = round2(remain - cut)
      return { ...i, cashflow: round2(i.cashflow - cut) }
    })
  }

  return { player: { ...player, cash, investments }, assetGain }
}

export function pickLossRecruit(fighters: ClubFighter[]): ClubFighter | null {
  const team = fighters.filter((f) => f.side === 'player')
  if (!team.length) return null
  return [...team].sort((a, b) => {
    const aDown = a.downOrder ?? 999
    const bDown = b.downOrder ?? 999
    if (aDown !== bDown) return aDown - bDown
    return a.hp - b.hp
  })[0] ?? null
}

export function recruitableFromCpu(fighters: ClubFighter[], player: PlayerState): ClubFighter[] {
  const met = new Set(player.relations.map((r) => r.name.replace(/·班底$/, '')))
  return fighters.filter(
    (f) =>
      f.side === 'cpu' &&
      f.recruitable &&
      !met.has(f.name.replace(/·班底$/, '')) &&
      !f.name.includes('·班底'),
  )
}

export { CLUB_MAX_TEAM }
