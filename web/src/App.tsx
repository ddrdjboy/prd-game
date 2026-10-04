import { useCallback, useEffect, useReducer } from 'react'
import { previewAutoDialogPick } from './game/ai'
import { AUTO_SPEED_MS, getEndAge } from './game/config'
import { createFreeLifeDebugGame, createGame } from './game/createGame'
import { reduce } from './game/reduce'
import type { GameAction, GameState } from './game/types'
import { clearSave, loadGame, saveGame } from './persist'
import { CareerPickScreen } from './ui/screens/CareerPickScreen'
import { HomeScreen } from './ui/screens/HomeScreen'
import { ModalLabScreen } from './ui/screens/ModalLabScreen'
import { PlayScreen } from './ui/screens/PlayScreen'
import { SettlementScreen } from './ui/screens/SettlementScreen'

function queryFlag(name: string): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get(name) === '1'
}

function hasModalLabFlag(): boolean {
  return queryFlag('modalLab')
}

function hasFreeLifeFlag(): boolean {
  return queryFlag('freeLife')
}

function reducer(state: GameState | null, action: GameAction | { type: 'CLEAR' }): GameState | null {
  if (action.type === 'CLEAR') return null
  if (action.type === 'NEW_GAME') {
    return createGame({
      seatCount: action.seatCount,
      seed: action.seed,
      endAge: action.endAge ?? getEndAge(),
      humanName: action.humanName,
    })
  }
  if (action.type === 'LOAD_STATE') return action.state
  if (!state) return state
  return reduce(state, action)
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, () =>
    hasFreeLifeFlag() ? createFreeLifeDebugGame({ endAge: getEndAge() }) : null,
  )
  const saved = loadGame()
  const modalLab = hasModalLabFlag()

  useEffect(() => {
    if (state && state.phase !== 'home') saveGame(state)
  }, [state])

  if (modalLab) {
    return (
      <div className="app-shell fullscreen">
        <ModalLabScreen />
      </div>
    )
  }

  const start = useCallback((seats: number, humanName?: string) => {
    clearSave()
    dispatch({
      type: 'NEW_GAME',
      seatCount: seats,
      endAge: getEndAge(),
      seed: Date.now() % 1_000_000,
      humanName: humanName?.trim() || '阿文',
    })
  }, [])

  // Auto-advance AI turns lightly when not human
  useEffect(() => {
    if (!state || state.phase !== 'playing') return
    // 走格由界面逐格推进，自动步不能把整段路一次走完
    if (state.moveAnimation) return
    // 自动代选事件/约会/决策：由 PlayScreen 闪按后再 AUTO_STEP
    if (previewAutoDialogPick(state)) return
    if (state.slotSpin) {
      const owner = state.players.find((p) => p.id === state.slotSpin!.playerId)
      if (owner?.isHuman && !state.autoEnabled) return
    }
    if (state.pendingLocation) {
      const owner = state.players.find((p) => p.id === state.pendingLocation!.playerId)
      if (owner?.isHuman && (!state.autoEnabled || state.autoChoiceMode === 'manual')) return
    }
    if (state.pendingEvent) {
      const owner = state.players.find((p) => p.id === state.pendingEvent!.playerId)
      if (owner?.isHuman && (!state.autoEnabled || state.autoChoiceMode === 'manual')) return
    }
    if (state.pendingDate) {
      const owner = state.players.find((p) => p.id === state.pendingDate!.playerId)
      if (owner?.isHuman && (!state.autoEnabled || state.autoChoiceMode === 'manual')) return
    }
    if (state.pendingDecision) {
      const owner = state.players.find((p) => p.id === state.pendingDecision!.playerId)
      if (owner?.isHuman && (!state.autoEnabled || state.autoChoiceMode === 'manual')) return
    }
    const current = state.players[state.turnPlayerIndex]
    if (current?.isHuman && !state.autoEnabled) return
    const t = window.setTimeout(() => {
      dispatch({ type: 'AUTO_STEP' })
    }, state.autoEnabled ? AUTO_SPEED_MS[state.autoSpeed] : 280)
    return () => window.clearTimeout(t)
  }, [state])

  if (!state) {
    return (
      <div className="app-shell">
        <HomeScreen
          onStart={start}
          onContinue={
            saved
              ? () => {
                  dispatch({ type: 'LOAD_STATE', state: saved })
                }
              : null
          }
        />
      </div>
    )
  }

  return (
    <div className={`app-shell${state.phase === 'playing' ? ' fullscreen' : ''}`}>
      {state.phase === 'careerPick' && (
        <CareerPickScreen
          choices={state.careerChoices}
          onPick={(id) => dispatch({ type: 'CHOOSE_CAREER', careerId: id })}
        />
      )}
      {state.phase === 'playing' && (
        <PlayScreen state={state} dispatch={(a) => dispatch(a)} />
      )}
      {state.phase === 'settlement' && (
        <SettlementScreen
          state={state}
          onRestart={() => {
            clearSave()
            dispatch({ type: 'CLEAR' })
          }}
        />
      )}
    </div>
  )
}
