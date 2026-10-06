import { FREE_LIFE_PLACES } from '../game/freeLife'
import type { FreeLifePlaceId, FreeLifeTile } from '../game/types'

export type MapHotspot = {
  id: FreeLifePlaceId
  tile: FreeLifeTile
  /** 区内局部百分比 0–100 */
  left: number
  top: number
}

function pin(tile: FreeLifeTile, id: FreeLifePlaceId, left: number, top: number): MapHotspot {
  return { id, tile, left, top }
}

/** 28 固定地标：坐标相对所在区大图（0–100） */
export const FREE_LIFE_MAP_HOTSPOTS: MapHotspot[] = [
  // NW 水岸
  pin('nw', 'riverside', 50, 14),
  pin('nw', 'cafe', 22, 32),
  pin('nw', 'pier', 18, 52),
  pin('nw', 'bookstore', 72, 36),
  pin('nw', 'teahouse', 78, 58),
  pin('nw', 'yoga', 40, 70),
  pin('nw', 'flower', 62, 78),
  // NE 文创
  pin('ne', 'gallery', 28, 28),
  pin('ne', 'museum', 72, 22),
  pin('ne', 'studio', 30, 52),
  pin('ne', 'indieCinema', 70, 48),
  pin('ne', 'craftFair', 48, 62),
  pin('ne', 'cityLibrary', 26, 78),
  pin('ne', 'skyBar', 74, 80),
  // SW 生活
  pin('sw', 'home', 22, 72),
  pin('sw', 'market', 55, 38),
  pin('sw', 'gym', 78, 55),
  pin('sw', 'clinic', 30, 48),
  pin('sw', 'grocery', 70, 35),
  pin('sw', 'greenPark', 45, 82),
  pin('sw', 'nightSchool', 78, 78),
  // SE 城东
  pin('se', 'office', 28, 32),
  pin('se', 'privateBank', 72, 28),
  pin('se', 'hotelLobby', 30, 55),
  pin('se', 'bistro', 70, 52),
  pin('se', 'arcade', 45, 68),
  pin('se', 'spa', 72, 78),
  pin('se', 'club', 48, 88),
]

export const FREE_LIFE_MAP_TILES: {
  id: FreeLifeTile
  file: string
  name: string
  blurb: string
}[] = [
  { id: 'nw', file: 'free-life-map-nw', name: '水岸', blurb: '江边、咖啡馆、码头…' },
  { id: 'ne', file: 'free-life-map-ne', name: '文创', blurb: '画廊、影院、书房…' },
  { id: 'sw', file: 'free-life-map-sw', name: '生活', blurb: '我家、市集、梧桐里…' },
  { id: 'se', file: 'free-life-map-se', name: '城东', blurb: '事务所、会所、银行…' },
]

/** 世界图四区热区：相对整图百分比矩形 left/top/width/height */
export type WorldTileHotspot = {
  id: FreeLifeTile
  left: number
  top: number
  width: number
  height: number
}

export const WORLD_TILE_HOTSPOTS: WorldTileHotspot[] = [
  { id: 'nw', left: 0, top: 0, width: 50, height: 50 },
  { id: 'ne', left: 50, top: 0, width: 50, height: 50 },
  { id: 'sw', left: 0, top: 50, width: 50, height: 50 },
  { id: 'se', left: 50, top: 50, width: 50, height: 50 },
]

export function worldHotspotForTile(tile: FreeLifeTile): WorldTileHotspot | undefined {
  return WORLD_TILE_HOTSPOTS.find((h) => h.id === tile)
}

export function hotspotsForTile(tile: FreeLifeTile): MapHotspot[] {
  return FREE_LIFE_MAP_HOTSPOTS.filter((h) => h.tile === tile)
}

export function tileLabel(tile: FreeLifeTile): string {
  return FREE_LIFE_MAP_TILES.find((t) => t.id === tile)?.name ?? tile
}

/** 校验数据与 FREE_LIFE_PLACES 的 tile 一致 */
export function hotspotTileMatchesPlace(h: MapHotspot): boolean {
  return FREE_LIFE_PLACES.find((p) => p.id === h.id)?.tile === h.tile
}
