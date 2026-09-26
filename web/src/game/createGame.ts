import { ACTION_POINTS_PER_SEASON, START_AGE } from './config'
import { pickCareers } from './careers'
import { createRng } from './rng'
import type { AiStyle, GameState, PlayerState } from './types'

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
      name: isHuman ? opts.humanName ?? '你' : `AI-${i}`,
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
    })
  }

  return {
    phase: 'careerPick',
    seatCount,
    age: START_AGE,
    seasonIndex: 0,
    turnPlayerIndex: 0,
    players,
    careerChoices: pickCareers(3, () => rng.next()),
    logs: [{ id: 'log0', text: '新的人生开局：请选择职业。' }],
    pendingEvent: null,
    pendingDecision: null,
    pendingLocation: null,
    deferredLocation: null,
    pendingDate: null,
    slotSpin: null,
    moveAnimation: null,
    autoEnabled: false,
    autoSensitivity: 'standard',
    seed,
    rngState: rng.state(),
    endAge: opts.endAge ?? 45,
    lastDice: null,
    lastReels: null,
  }
}
