import { ACTION_POINTS_PER_MONTH, ACTION_POINTS_PER_SEASON, START_AGE } from './config'
import { pickCareers } from './careers'
import { createRng } from './rng'
import type { AiStyle, GameState, PlayerState, Relation } from './types'

const AI_STYLES: AiStyle[] = ['steady', 'aggressive', 'social']

export function createGame(opts: {
  seatCount: number
  seed?: number
  endAge?: number
  humanName?: string
}): GameState {
  const seed = opts.seed ?? Date.now() % 1_000_000
  const rng = createRng(seed)
  const seatCount = Math.min(4, Math.max(2, opts.seatCount))
  const players: PlayerState[] = []

  for (let i = 0; i < seatCount; i++) {
    const isHuman = i === 0
    players.push({
      id: `p${i}`,
      name: isHuman ? (opts.humanName?.trim() || '阿文') : `AI-${i}`,
      isHuman,
      careerId: null,
      salary: 0,
      fixedExpense: 0,
      cash: 0,
      liabilities: 0,
      track: 'worker',
      position: 0,
      relations: [],
      shops: [],
      investments: [],
      actionPoints: ACTION_POINTS_PER_SEASON,
      aiStyle: isHuman ? null : AI_STYLES[Math.floor(rng.next() * AI_STYLES.length)],
      trait: null,
      poachCooldown: 0,
      maintainedRelationIds: [],
      negativePaydayStreak: 0,
    })
  }

  return {
    phase: 'careerPick',
    seatCount,
    age: START_AGE,
    seasonIndex: 0,
    monthIndex: 0,
    lifeMode: 'worker',
    questFlags: [],
    turnPlayerIndex: 0,
    players,
    careerChoices: pickCareers(3, () => rng.next()),
    logs: [{ id: 'log0', text: '新的人生开局：请选择职业。' }],
    pendingEvent: null,
    pendingDecision: null,
    pendingLocation: null,
    deferredLocation: null,
    pendingDate: null,
    pendingCasino: null,
    pendingVisitShop: null,
    pendingExchange: null,
    pendingFreeScene: null,
    pendingClub: null,
    slotSpin: null,
    moveAnimation: null,
    autoEnabled: false,
    autoChoiceMode: 'auto',
    autoSpeed: 'fast',
    autoSensitivity: 'standard',
    seed,
    rngState: rng.state(),
    endAge: opts.endAge ?? 45,
    lastDice: null,
    lastReels: null,
    turnRolled: false,
    settlementReason: null,
  }
}

/** 调试：`?freeLife=1` 直接进入自由生活（带 3 名好友、已自由财务） */
export function createFreeLifeDebugGame(opts?: {
  seed?: number
  endAge?: number
  humanName?: string
}): GameState {
  const base = createGame({
    seatCount: 2,
    seed: opts?.seed ?? 42,
    endAge: opts?.endAge ?? 45,
    humanName: opts?.humanName,
  })
  const career = pickCareers(1, () => 0.1)[0]
  const relations: Relation[] = [
    {
      id: 'r1',
      name: '蓝铃',
      affinity: 280,
      locked: false,
      skills: ['service'],
      training: null,
      portraitId: 'g01',
    },
    {
      id: 'r2',
      name: '星澜',
      affinity: 320,
      locked: false,
      skills: ['manage', 'creative'],
      training: null,
      portraitId: 'g02',
    },
    {
      id: 'r3',
      name: '茶纪',
      affinity: 210,
      locked: false,
      skills: ['service', 'sales'],
      training: null,
      portraitId: 'g12',
    },
  ]
  const players = base.players.map((p, i) => {
    if (i !== 0) {
      return {
        ...p,
        careerId: 'sales',
        salary: 1,
        fixedExpense: 0.4,
        cash: 3,
        actionPoints: 0,
      }
    }
    return {
      ...p,
      careerId: career.id,
      salary: career.salary,
      fixedExpense: career.fixedExpense,
      cash: 8,
      trait: career.trait,
      relations,
      investments: [{ id: 'i1', name: '基金', cost: 3, cashflow: 1.2 }],
      actionPoints: ACTION_POINTS_PER_MONTH,
    }
  })
  return {
    ...base,
    phase: 'playing',
    age: 30,
    seasonIndex: 0,
    monthIndex: 2,
    lifeMode: 'free',
    questFlags: [],
    careerChoices: [],
    turnRolled: true,
    turnPlayerIndex: 0,
    players,
    pendingFreeScene: null,
    pendingClub: null,
    logs: [{ id: 'log0', text: '调试档：直接进入自由生活（?freeLife=1）。' }],
  }
}
