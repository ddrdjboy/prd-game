import { useCallback, useEffect, useReducer } from 'react'
import { getEndAge } from './game/config'
import { createGame } from './game/createGame'
import { runAutoUntilBreak } from './game/autoSeason'
import { reduce } from './game/reduce'
import type { GameAction, GameState } from './game/types'
import { clearSave, loadGame, saveGame } from './persist'
import { CareerPickScreen } from './ui/screens/CareerPickScreen'
import { HomeScreen } from './ui/screens/HomeScreen'
import { PlayScreen } from './ui/screens/PlayScreen'
import { SettlementScreen } from './ui/screens/SettlementScreen'

function reducer(state: GameState | null, action: GameAction | { type: 'CLEAR' }): GameState | null {
  if (action.type === 'CLEAR') return null
  if (action.type === 'NEW_GAME') {
    return createGame({
      seatCount: action.seatCount,
      seed: action.seed,
      endAge: action.endAge ?? getEndAge(),
    })
  }
  if (action.type === 'LOAD_STATE') return action.state
  if (!state) return state
  return reduce(state, action)
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null)
  const saved = loadGame()

  useEffect(() => {
    if (state && state.phase !== 'home') saveGame(state)
  }, [state])

  const start = useCallback((seats: number) => {
    clearSave()
    dispatch({ type: 'NEW_GAME', seatCount: seats, endAge: getEndAge(), seed: Date.now() % 1_000_000 })
  }, [])

  const onAutoRun = useCallback(() => {
    if (!state) return
    const next = runAutoUntilBreak({ ...state, autoEnabled: true }, 600)
    dispatch({ type: 'LOAD_STATE', state: next })
  }, [state])

  // Auto-advance AI turns lightly when not human
  useEffect(() => {
    if (!state || state.phase !== 'playing') return
    if ((state.moveAnimation || state.slotSpin) && !state.autoEnabled) {
      const pid = state.slotSpin?.playerId ?? state.moveAnimation?.playerId
      const current = state.players.find((p) => p.id === pid)
      if (current?.isHuman) return
    }
    if (state.pendingLocation && !state.autoEnabled) {
      const owner = state.players.find((p) => p.id === state.pendingLocation!.playerId)
      if (owner?.isHuman) return
    }
    const current = state.players[state.turnPlayerIndex]
    if (current?.isHuman && !state.autoEnabled) return
    if (state.pendingDecision && current?.isHuman) return
    const t = window.setTimeout(() => {
      dispatch({ type: 'AUTO_STEP' })
    }, state.autoEnabled ? 40 : 280)
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
        <PlayScreen state={state} dispatch={(a) => dispatch(a)} onAutoRun={onAutoRun} />
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
