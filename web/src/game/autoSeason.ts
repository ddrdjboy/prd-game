import { autoStep, isCriticalPending, reduce } from './reduce'
import type { GameState } from './types'

/** Advance until season boundary hint, settlement, or human critical decision */
export function runAutoSeason(state: GameState, maxSteps = 80): GameState {
  let s = state
  if (!s.autoEnabled) s = reduce(s, { type: 'SET_AUTO', enabled: true })
  const startAge = s.age
  const startSeason = s.seasonIndex

  for (let i = 0; i < maxSteps; i++) {
    if (s.phase === 'settlement') return s
    if (s.pendingDecision && isCriticalPending(s)) {
      const owner = s.players.find((p) => p.id === s.pendingDecision!.playerId)
      if (owner?.isHuman) return s
    }
    const next = autoStep(s)
    if (next === s) break
    s = next
    // stop after we advanced at least one full season past start (age/season changed from human perspective)
    if (s.age !== startAge || s.seasonIndex !== startSeason) {
      // continue until back to human turn without pending, or critical
      if (s.players[s.turnPlayerIndex]?.isHuman && !s.pendingEvent && !s.pendingDecision) {
        return s
      }
    }
  }
  return s
}

export function runAutoUntilBreak(state: GameState, maxSteps = 400): GameState {
  const originalAuto = state.autoEnabled
  let s = { ...state, autoEnabled: true }
  for (let i = 0; i < maxSteps; i++) {
    if (s.phase === 'settlement') return { ...s, autoEnabled: originalAuto }
    if (s.pendingDecision && isCriticalPending(s)) {
      const owner = s.players.find((p) => p.id === s.pendingDecision!.playerId)
      if (owner?.isHuman) return { ...s, autoEnabled: originalAuto }
    }
    const next = autoStep(s, true)
    if (next === s) break
    s = next
    // 批量推进遇到人类玩家的其它待决弹框也应停下
    if (s.pendingEvent || s.pendingDate || s.pendingLocation || s.pendingDecision) {
      const pid =
        s.pendingEvent?.playerId ??
        s.pendingDate?.playerId ??
        s.pendingLocation?.playerId ??
        s.pendingDecision?.playerId
      const owner = s.players.find((p) => p.id === pid)
      if (owner?.isHuman) return { ...s, autoEnabled: originalAuto }
    }
  }
  return { ...s, autoEnabled: originalAuto }
}
