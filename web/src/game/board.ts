import { INVESTOR_SPACES, SPACES_PER_SIDE, WORKER_SPACES } from './config'
import type { BoardSpace, SpaceKind, Track } from './types'

/** 角格：发薪 / 公园 交替感；边格：空地·商店·事务所·经营 */
const WORKER_CORNERS: SpaceKind[] = ['payday', 'park', 'manage', 'park']
const WORKER_EDGE: SpaceKind[] = [
  'vacant',
  'shop',
  'office',
  'casino',
  'vacant',
  'shop',
  'office',
  'manage',
]

const INVESTOR_CORNERS: SpaceKind[] = ['invest', 'park', 'manage', 'park']
const INVESTOR_EDGE: SpaceKind[] = [
  'vacant',
  'shop',
  'office',
  'casino',
  'invest',
  'shop',
  'office',
  'manage',
]

export const SPACE_LABELS: Record<SpaceKind, string> = {
  payday: '发薪处',
  vacant: '空地',
  shop: '商店',
  office: '私人事务所',
  manage: '经营区',
  park: '公园',
  invest: '投资所',
  casino: '赌场',
}

function buildSquareKinds(corners: SpaceKind[], edge: SpaceKind[], total: number): SpaceKind[] {
  const side = SPACES_PER_SIDE
  const kinds: SpaceKind[] = []
  let edgeIdx = 0
  for (let s = 0; s < 4; s++) {
    kinds.push(corners[s])
    for (let i = 0; i < side - 2; i++) {
      kinds.push(edge[edgeIdx % edge.length])
      edgeIdx++
    }
  }
  while (kinds.length < total) kinds.push(edge[edgeIdx++ % edge.length])
  return kinds.slice(0, total)
}

export function buildTrack(track: Track): BoardSpace[] {
  const len = track === 'worker' ? WORKER_SPACES : INVESTOR_SPACES
  const kinds =
    track === 'worker'
      ? buildSquareKinds(WORKER_CORNERS, WORKER_EDGE, len)
      : buildSquareKinds(INVESTOR_CORNERS, INVESTOR_EDGE, len)
  return kinds.map((kind, index) => ({ index, kind, label: SPACE_LABELS[kind] }))
}

export function squareCoord(index: number, spacesPerSide = SPACES_PER_SIDE): { row: number; col: number } {
  const n = spacesPerSide
  const sideLen = n - 1
  const side = Math.floor(index / sideLen) % 4
  const offset = index % sideLen
  switch (side) {
    case 0:
      return { row: 0, col: offset }
    case 1:
      return { row: offset, col: n - 1 }
    case 2:
      return { row: n - 1, col: n - 1 - offset }
    default:
      return { row: n - 1 - offset, col: 0 }
  }
}

export function movePath(from: number, steps: number, trackLen: number): number[] {
  const path: number[] = []
  let pos = from
  for (let i = 0; i < steps; i++) {
    pos = (pos + 1) % trackLen
    path.push(pos)
  }
  return path
}

export function isPaydaySpace(kind: SpaceKind): boolean {
  return kind === 'payday' || kind === 'invest'
}

export function move(
  from: number,
  steps: number,
  track: BoardSpace[],
): { position: number; passedPayday: boolean; landed: BoardSpace; path: number[] } {
  const path = movePath(from, steps, track.length)
  let passedPayday = false
  for (const pos of path) {
    if (isPaydaySpace(track[pos].kind)) passedPayday = true
  }
  const position = path.length ? path[path.length - 1] : from
  return { position, passedPayday, landed: track[position], path }
}

export function spaceHasLocationAction(kind: SpaceKind): boolean {
  return (
    kind === 'vacant' ||
    kind === 'shop' ||
    kind === 'office' ||
    kind === 'manage' ||
    kind === 'casino' ||
    kind === 'park' ||
    kind === 'invest'
  )
}
