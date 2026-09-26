import { useEffect, useState } from 'react'
import { SPACES_PER_SIDE } from '../../game/config'
import { buildTrack, squareCoord } from '../../game/board'
import { shopTypeById } from '../../game/shopCatalog'
import { findShopAt, occupiedShopLabel } from '../../game/visitShop'
import type { BoardSpace, PlayerState, SlotSpin, Track } from '../../game/types'
import { SlotMachine } from './SlotMachine'
import './Board.css'

type Props = {
  players: PlayerState[]
  highlightPlayerId?: string | null
  forcedTrack?: Track | null
  slotSpin?: SlotSpin | null
  lastReels?: [number, number, number] | null
  comboLabel?: string | null
  comboFlash?: boolean
}

function spaceDisplayLabel(
  space: BoardSpace,
  track: Track,
  players: PlayerState[],
): string {
  if (space.kind !== 'vacant') return space.label
  const owned = findShopAt(players, track, space.index)
  if (!owned) return space.label
  const owner = players.find((p) => p.id === owned.ownerId)
  const typeLabel = shopTypeById(owned.shop.typeId)?.label
  return occupiedShopLabel(owner?.name ?? '玩家', owned.shop, typeLabel)
}

function SquareRing({
  track,
  spaces,
  players,
  highlightPlayerId,
  visible,
}: {
  track: Track
  spaces: BoardSpace[]
  players: PlayerState[]
  highlightPlayerId?: string | null
  visible: boolean
}) {
  const n = SPACES_PER_SIDE
  const cells: { space: BoardSpace | null; row: number; col: number }[] = []
  const byCoord = new Map<string, BoardSpace>()
  for (const space of spaces) {
    const { row, col } = squareCoord(space.index, n)
    byCoord.set(`${row},${col}`, space)
  }

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const isEdge = row === 0 || row === n - 1 || col === 0 || col === n - 1
      cells.push({
        row,
        col,
        space: isEdge ? byCoord.get(`${row},${col}`) ?? null : null,
      })
    }
  }

  return (
    <div
      className={`square-board track-${track}${visible ? ' is-visible' : ' is-hidden'}`}
      aria-hidden={!visible}
    >
      <div className="square-center-hole" />
      <div
        className="square-grid"
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}
      >
        {cells.map(({ space, row, col }) => {
          if (!space) {
            return <div key={`${row}-${col}`} className="square-empty" />
          }
          const here = players.filter((p) => p.track === track && p.position === space.index)
          const isCorner = (row === 0 || row === n - 1) && (col === 0 || col === n - 1)
          const owned = space.kind === 'vacant' && findShopAt(players, track, space.index)
          const label = spaceDisplayLabel(space, track, players)
          return (
            <div
              key={`${track}-${space.index}`}
              className={`square-cell kind-${space.kind}${owned ? ' kind-owned-shop' : ''}${
                isCorner ? ' corner' : ''
              }${here.some((p) => p.id === highlightPlayerId) ? ' active' : ''}`}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              title={label}
            >
              <span className="cell-label">{label}</span>
              <div className="tokens">
                {here.map((p) => (
                  <i
                    key={p.id}
                    className={`token ${p.isHuman ? 'human' : 'ai'}${
                      p.id === highlightPlayerId ? ' bounce' : ''
                    }`}
                    title={p.name}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Board({
  players,
  highlightPlayerId,
  forcedTrack = null,
  slotSpin = null,
  lastReels = null,
  comboLabel = null,
  comboFlash = false,
}: Props) {
  const [viewTrack, setViewTrack] = useState<Track>('worker')
  const worker = buildTrack('worker')
  const investor = buildTrack('investor')

  useEffect(() => {
    if (forcedTrack) setViewTrack(forcedTrack)
  }, [forcedTrack])

  const active = forcedTrack ?? viewTrack
  const locked = Boolean(forcedTrack)
  const spinning = Boolean(slotSpin) && !comboFlash

  return (
    <div className="board panel">
      <div className="board-switch" role="tablist" aria-label="切换地图">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'worker'}
          className={active === 'worker' ? 'active' : ''}
          disabled={locked && forcedTrack !== 'worker'}
          onClick={() => setViewTrack('worker')}
        >
          打工人圈
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'investor'}
          className={active === 'investor' ? 'active' : ''}
          disabled={locked && forcedTrack !== 'investor'}
          onClick={() => setViewTrack('investor')}
        >
          投资人圈
        </button>
        {locked && <span className="switch-hint">行走中 · 已锁定当前圈</span>}
      </div>

      <div className="board-fill">
        <div className="board-stack">
          <SquareRing
            track="worker"
            spaces={worker}
            players={players}
            highlightPlayerId={highlightPlayerId}
            visible={active === 'worker'}
          />
          <SquareRing
            track="investor"
            spaces={investor}
            players={players}
            highlightPlayerId={highlightPlayerId}
            visible={active === 'investor'}
          />
          <div className="slot-overlay">
            <SlotMachine
              spin={slotSpin}
              lastReels={lastReels}
              trackLabel={active === 'worker' ? '打工人圈' : '投资人圈'}
              spinning={spinning}
              comboLabel={comboLabel}
              comboFlash={comboFlash}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
