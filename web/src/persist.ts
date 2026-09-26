import type { GameState } from './game/types'

const KEY = 'fi45_save'

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as GameState
    state.players = state.players.map((p) => ({
      ...p,
      poachCooldown: p.poachCooldown ?? 0,
      maintainedRelationIds: p.maintainedRelationIds ?? [],
    }))
    return state
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY)
}
