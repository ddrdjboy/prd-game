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
  return ringCoord(index, spacesPerSide, spacesPerSide)
}

/** 顺时针把格序号映射到 cols×rows 长方形环的外圈，index 0 在左上角 */
export function ringCoord(index: number, cols: number, rows: number): { row: number; col: number } {
  const top = cols - 1
  const right = rows - 1
  const perimeter = 2 * (top + right)
  const i = ((index % perimeter) + perimeter) % perimeter
  if (i < top) return { row: 0, col: i }
  if (i < top + right) return { row: i - top, col: cols - 1 }
  if (i < 2 * top + right) return { row: rows - 1, col: cols - 1 - (i - top - right) }
  return { row: rows - 1 - (i - 2 * top - right), col: 0 }
}

export type RingShape = { cols: number; rows: number }

/** 周长与 SPACES_PER_SIDE 正方形环相同的候选形状；中心至少留 4 列 */
export const RING_SHAPES: RingShape[] = Array.from({ length: SPACES_PER_SIDE - 5 }, (_, k) => {
  const cols = SPACES_PER_SIDE - k
  return { cols, rows: 2 * SPACES_PER_SIDE - cols }
})

const MAX_CELL_STRETCH = 1.3

export type RingFit = RingShape & { width: number; height: number; cellW: number; cellH: number }

/** 为容器选单格最接近正方形的环形状，并给出不超过容器、单格长宽比不超过 1.3 的尺寸 */
export function fitRing(width: number, height: number, shapes: RingShape[] = RING_SHAPES): RingFit {
  let best = shapes[0]
  let bestScore = Infinity
  for (const s of shapes) {
    const score = Math.abs(Math.log(width / s.cols / (height / s.rows)))
    if (score < bestScore - 1e-9) {
      best = s
      bestScore = score
    }
  }
  let cellW = width / best.cols
  let cellH = height / best.rows
  if (cellW > cellH * MAX_CELL_STRETCH) cellW = cellH * MAX_CELL_STRETCH
  if (cellH > cellW * MAX_CELL_STRETCH) cellH = cellW * MAX_CELL_STRETCH
  return {
    ...best,
    cellW,
    cellH,
    width: cellW * best.cols,
    height: cellH * best.rows,
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
