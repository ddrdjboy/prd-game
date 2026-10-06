import {
  CLUB_REWARD_CASH,
  CLUB_MAX_TEAM,
} from './config'
import {
  applyClubRewards,
  buildCpuTeam,
  eligibleClubRelations,
  pickLossRecruit,
  recruitableFromCpu,
  relationToFighter,
  runClubBattle,
} from './clubPk'
import {
  canShowFriendHome,
  closeFreeMonth,
  enterFreeLife,
  isFreeLife,
  placeLabel,
} from './freeLife'
import { applyFreeLifeChoice, pickFreeLifeScene, pickFriendHomeScene } from './freeLifeScenes'
import { round2 } from './finance'
import { characterByName, characterByPortraitId } from './portraits'
import { initialSkillsForName } from './relationsCatalog'
import { createRng } from './rng'
import type { FreeLifePlaceId, GameState, Relation } from './types'

function pushLog(state: GameState, text: string): GameState {
  return {
    ...state,
    logs: [...state.logs, { id: `log${state.logs.length}`, text }].slice(-80),
  }
}

function updatePlayer(
  state: GameState,
  playerId: string,
  fn: (p: GameState['players'][0]) => GameState['players'][0],
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? fn(p) : p)),
  }
}

export function confirmEnterFreeLife(state: GameState): GameState {
  if (state.pendingDecision?.type !== 'enterFreeLife') return state
  return enterFreeLife({ ...state, pendingDecision: null, deferredLocation: null })
}

export function skipEnterFreeLife(state: GameState): GameState {
  if (state.pendingDecision?.type !== 'enterFreeLife') return state
  return pushLog(
    { ...state, pendingDecision: null },
    '你选择继续留在打工人圈一段时间。',
  )
}

export function freeVisit(state: GameState, placeId: FreeLifePlaceId): GameState {
  if (!isFreeLife(state) || state.pendingFreeScene || state.pendingClub) return state
  const human = state.players.find((p) => p.isHuman)
  if (!human || human.actionPoints <= 0) return state

  const rng = createRng(state.rngState)
  let s = updatePlayer(state, human.id, (p) => ({
    ...p,
    actionPoints: p.actionPoints - 1,
  }))

  if (placeId === 'club') {
    const cpuTeam = buildCpuTeam(human, () => rng.next(), CLUB_MAX_TEAM)
    s = {
      ...s,
      rngState: rng.state(),
      pendingClub: { step: 'pickTeam', playerId: human.id, cpuTeam },
    }
    return pushLog(s, `${human.name} 走进会所，准备组队。`)
  }

  const scene = pickFreeLifeScene(placeId, human, s.questFlags ?? [], () => rng.next())
  s = {
    ...s,
    rngState: rng.state(),
    pendingFreeScene: { playerId: human.id, scene },
  }
  return pushLog(s, `${human.name} 前往「${placeLabel(placeId)}」——${scene.title}`)
}

export function freeVisitFriend(state: GameState, relationId: string): GameState {
  if (!isFreeLife(state) || state.pendingFreeScene || state.pendingClub) return state
  const human = state.players.find((p) => p.isHuman)
  if (!human || human.actionPoints <= 0) return state
  const rel = human.relations.find((r) => r.id === relationId)
  if (!rel || !canShowFriendHome(rel)) return state

  const rng = createRng(state.rngState)
  let s = updatePlayer(state, human.id, (p) => ({
    ...p,
    actionPoints: p.actionPoints - 1,
  }))
  const scene = pickFriendHomeScene(rel, human, () => rng.next())
  s = {
    ...s,
    rngState: rng.state(),
    pendingFreeScene: { playerId: human.id, scene },
  }
  return pushLog(s, `${human.name} 去「${rel.name}的家」做客——${scene.title}`)
}

export function freeSceneChoice(state: GameState, choiceId: string): GameState {
  const pending = state.pendingFreeScene
  if (!pending) return state
  const player = state.players.find((p) => p.id === pending.playerId)
  if (!player) return { ...state, pendingFreeScene: null }

  const rng = createRng(state.rngState)
  const applied = applyFreeLifeChoice(
    player,
    pending.scene,
    choiceId,
    state.questFlags ?? [],
    () => rng.next(),
  )
  let s: GameState = {
    ...state,
    pendingFreeScene: null,
    questFlags: applied.quests,
    rngState: rng.state(),
    players: state.players.map((p) => (p.id === player.id ? applied.player : p)),
  }
  for (const line of applied.logs) {
    s = pushLog(s, line)
  }
  const choice = pending.scene.choices.find((c) => c.id === choiceId)
  s = pushLog(s, `选择「${choice?.label ?? choiceId}」`)
  return s
}

export function freeCloseMonth(state: GameState): GameState {
  if (!isFreeLife(state)) return state
  if (state.pendingFreeScene || state.pendingClub) return state
  const rng = createRng(state.rngState)
  const s = closeFreeMonth(state, () => rng.next())
  return { ...s, rngState: rng.state() }
}

export function clubConfirmTeam(state: GameState, relationIds: string[]): GameState {
  const pending = state.pendingClub
  if (!pending || pending.step !== 'pickTeam') return state
  const player = state.players.find((p) => p.id === pending.playerId)
  if (!player) return { ...state, pendingClub: null }

  const eligible = new Map(eligibleClubRelations(player).map((r) => [r.id, r]))
  const picked = relationIds
    .map((id) => eligible.get(id))
    .filter((r): r is Relation => !!r)
    .slice(0, CLUB_MAX_TEAM)
  if (!picked.length) return pushLog(state, '至少派出一名朋友。')

  const rng = createRng(state.rngState)
  const playerTeam = picked.map((r, i) => relationToFighter(r, i))
  const result = runClubBattle(playerTeam, pending.cpuTeam, () => rng.next())
  return {
    ...state,
    rngState: rng.state(),
    pendingClub: {
      step: 'battle',
      playerId: pending.playerId,
      playerTeam,
      cpuTeam: pending.cpuTeam,
      result,
    },
  }
}

export function clubFinishBattle(state: GameState): GameState {
  const pending = state.pendingClub
  if (!pending || pending.step !== 'battle') return state
  const player = state.players.find((p) => p.id === pending.playerId)
  if (!player) return { ...state, pendingClub: null }

  const won = pending.result.winner === 'player'
  const rewarded = applyClubRewards(player, won)
  let s = updatePlayer(state, player.id, () => rewarded.player)
  s = pushLog(
    s,
    won
      ? `${player.name} 会所胜出：现金+${CLUB_REWARD_CASH}，被动与资产小涨。`
      : `${player.name} 会所落败：现金与被动小跌。`,
  )

  if (won) {
    const candidates = recruitableFromCpu(pending.result.fighters, rewarded.player)
    if (!candidates.length) {
      s = updatePlayer(s, player.id, (p) => ({
        ...p,
        cash: round2(p.cash + 0.1),
      }))
      s = pushLog(s, '对方没有可结识的新人，现金再 +0.1。')
      return { ...s, pendingClub: null }
    }
    return {
      ...s,
      pendingClub: {
        step: 'recruit',
        playerId: player.id,
        won: true,
        candidates,
        lossTargetId: null,
      },
    }
  }

  const loss = pickLossRecruit(pending.result.fighters)
  if (!loss) return { ...s, pendingClub: null }
  s = updatePlayer(s, player.id, (p) => ({
    ...p,
    relations: p.relations.filter((r) => r.id !== loss.id),
  }))
  s = pushLog(s, `「${loss.name}」被对方带走了，之后或许还能再遇见。`)
  return { ...s, pendingClub: null }
}

export function clubRecruit(state: GameState, fighterId: string | null): GameState {
  const pending = state.pendingClub
  if (!pending || pending.step !== 'recruit') return state
  const player = state.players.find((p) => p.id === pending.playerId)
  if (!player) return { ...state, pendingClub: null }

  let s: GameState = { ...state, pendingClub: null }
  if (!fighterId) {
    s = updatePlayer(s, player.id, (p) => ({ ...p, cash: round2(p.cash + 0.1) }))
    return pushLog(s, '你没有挖人，现金 +0.1。')
  }
  const fighter = pending.candidates.find((c) => c.id === fighterId)
  if (!fighter) return s

  const ch =
    characterByPortraitId(fighter.portraitId) ?? characterByName(fighter.name.replace(/·班底$/, ''))
  const name = ch?.name ?? fighter.name.replace(/·班底$/, '')
  if (player.relations.some((r) => r.name === name)) {
    return pushLog(s, `你已经认识「${name}」了。`)
  }
  const rel: Relation = {
    id: `rel-club-${Date.now()}`,
    name,
    affinity: 150,
    locked: false,
    skills: initialSkillsForName(name),
    training: null,
    portraitId: ch?.portraitId ?? fighter.portraitId,
  }
  s = updatePlayer(s, player.id, (p) => ({
    ...p,
    relations: [...p.relations, rel],
  }))
  return pushLog(s, `会所结识「${name}」，好感落在中立。`)
}

export function clubCancel(state: GameState): GameState {
  if (!state.pendingClub) return state
  // 已扣 AP，取消只清 pending（组队阶段可取消）
  if (state.pendingClub.step !== 'pickTeam') return state
  return pushLog({ ...state, pendingClub: null }, '离开会所。')
}

/** 自动推进：自由生活选地点（跳过会所） */
export function autoFreeLifeStep(state: GameState): GameState {
  if (!isFreeLife(state)) return state
  if (state.pendingFreeScene) {
    const scene = state.pendingFreeScene.scene
    const choice = scene.choices[0]
    return choice ? freeSceneChoice(state, choice.id) : { ...state, pendingFreeScene: null }
  }
  if (state.pendingClub) {
    // 自动模式跳过会所：取消或快速结束
    if (state.pendingClub.step === 'pickTeam') return clubCancel(state)
    if (state.pendingClub.step === 'battle') return clubFinishBattle(state)
    if (state.pendingClub.step === 'recruit') return clubRecruit(state, null)
  }

  const human = state.players.find((p) => p.isHuman)
  if (!human) return state
  if (human.actionPoints <= 0) return freeCloseMonth(state)

  const quest = (state.questFlags ?? [])[0]
  if (quest) return freeVisit(state, quest.placeId)

  const unmetPlaces: FreeLifePlaceId[] = [
    'cafe',
    'riverside',
    'gallery',
    'market',
    'office',
    'home',
    'bookstore',
    'greenPark',
    'skyBar',
  ]
  for (const placeId of unmetPlaces) {
    // prefer places; skip club
    return freeVisit(state, placeId)
  }
  return freeCloseMonth(state)
}
