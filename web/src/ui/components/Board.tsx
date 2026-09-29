import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { SPACES_PER_SIDE } from '../../game/config'
import { buildTrack, fitRing, ringCoord, type RingFit, type RingShape } from '../../game/board'
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
  onSpaceClick?: (track: Track, space: BoardSpace) => void
  spaceClickEnabled?: boolean
  children?: ReactNode
}

const SQUARE: RingShape = { cols: SPACES_PER_SIDE, rows: SPACES_PER_SIDE }

function useRingFit() {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<RingFit | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width < 1 || height < 1) return
      const next = fitRing(width, height)
      setFit((prev) =>
        prev &&
        prev.cols === next.cols &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next,
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, fit }
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
  shape,
  onSpaceClick,
  spaceClickEnabled = false,
}: {
  track: Track
  spaces: BoardSpace[]
  players: PlayerState[]
  highlightPlayerId?: string | null
  visible: boolean
  shape: RingShape
  onSpaceClick?: (track: Track, space: BoardSpace) => void
  spaceClickEnabled?: boolean
}) {
  const { cols, rows } = shape
  const interactive = Boolean(visible && spaceClickEnabled && onSpaceClick)
  const cells = spaces.map((space) => ({ space, ...ringCoord(space.index, cols, rows) }))

  return (
    <div
      className={`square-board track-${track}${visible ? ' is-visible' : ' is-hidden'}`}
      aria-hidden={!visible}
    >
      <div className="square-center-hole" />
      <div
        className="square-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {cells.map(({ space, row, col }) => {
          const here = players.filter((p) => p.track === track && p.position === space.index)
          const isCorner = (row === 0 || row === rows - 1) && (col === 0 || col === cols - 1)
          const owned = space.kind === 'vacant' ? findShopAt(players, track, space.index) : null
          const ownerSeat =
            owned != null
              ? Math.max(0, players.findIndex((x) => x.id === owned.ownerId))
              : -1
          const label = spaceDisplayLabel(space, track, players)
          return (
            <div
              key={`${track}-${space.index}`}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              className={`square-cell kind-${space.kind}${
                owned ? ` kind-owned-shop owned-seat-${ownerSeat}` : ''
              }${isCorner ? ' corner' : ''}${
                here.some((p) => p.id === highlightPlayerId) ? ' active' : ''
              }${interactive ? ' clickable' : ''}`}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              title={label}
              onClick={
                interactive && onSpaceClick ? () => onSpaceClick(track, space) : undefined
              }
              onKeyDown={
                interactive && onSpaceClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSpaceClick(track, space)
                      }
                    }
                  : undefined
              }
            >
              <span className="cell-label">{label}</span>
              <div className="tokens">
                {here.map((p) => {
                  const seat = Math.max(
                    0,
                    players.findIndex((x) => x.id === p.id),
                  )
                  return (
                    <i
                      key={p.id}
                      className={`token seat-${seat}${
                        p.id === highlightPlayerId ? ' bounce' : ''
                      }`}
                      title={p.name}
                    />
                  )
                })}
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
  onSpaceClick,
  spaceClickEnabled = false,
  children,
}: Props) {
  const [viewTrack, setViewTrack] = useState<Track>('worker')
  const worker = buildTrack('worker')
  const investor = buildTrack('investor')
  const { ref: fillRef, fit } = useRingFit()
  const shape: RingShape = fit ?? SQUARE

  useEffect(() => {
    if (forcedTrack) setViewTrack(forcedTrack)
  }, [forcedTrack])

  const active = forcedTrack ?? viewTrack
  const locked = Boolean(forcedTrack)
  const spinning = Boolean(slotSpin) && !comboFlash

  const stackStyle = {
    '--ring-cols': shape.cols,
    '--ring-rows': shape.rows,
    ...(fit
      ? {
          '--cell-w': `${fit.cellW}px`,
          width: `${fit.width}px`,
          height: `${fit.height}px`,
          aspectRatio: 'auto',
        }
      : null),
  } as CSSProperties

  const boardSwitch = (
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
  )

  return (
    <div className="board panel">
      <div className="board-fill" ref={fillRef}>
        <div className="board-stack" style={stackStyle}>
          <SquareRing
            track="worker"
            spaces={worker}
            players={players}
            highlightPlayerId={highlightPlayerId}
            visible={active === 'worker'}
            shape={shape}
            onSpaceClick={onSpaceClick}
            spaceClickEnabled={spaceClickEnabled}
          />
          <SquareRing
            track="investor"
            spaces={investor}
            players={players}
            highlightPlayerId={highlightPlayerId}
            visible={active === 'investor'}
            shape={shape}
            onSpaceClick={onSpaceClick}
            spaceClickEnabled={spaceClickEnabled}
          />
          <div className="ring-center">
            {boardSwitch}
            <div className="ring-center-slot">
              <SlotMachine
                spin={slotSpin}
                lastReels={lastReels}
                trackLabel={active === 'worker' ? '打工人圈' : '投资人圈'}
                spinning={spinning}
                comboLabel={comboLabel}
                comboFlash={comboFlash}
              />
            </div>
            {children && <div className="ring-center-controls">{children}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
