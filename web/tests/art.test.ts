import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildTrack } from '../src/game/board'
import { CAREERS } from '../src/game/careers'
import { DATE_VENUES } from '../src/game/dating'
import { FREE_LIFE_PLACES } from '../src/game/freeLife'
import { PORTRAIT_CATALOG, portraitUrl } from '../src/game/portraits'
import type { EventKind } from '../src/game/types'
import {
  ALL_ART,
  EVENT_ART,
  FREE_LIFE_MAP_TILE_ART,
  careerArt,
  spaceArt,
  venueArt,
} from '../src/ui/art'
import {
  FREE_LIFE_MAP_HOTSPOTS,
  hotspotsForTile,
  hotspotTileMatchesPlace,
} from '../src/ui/freeLifeMapLayout'

const publicFile = (url: string) => resolve(__dirname, '../public', url.replace(/^\//, ''))

const EVENT_KINDS: EventKind[] = [
  'opportunity',
  'market',
  'doodad',
  'relation',
  'business',
  'rest',
  'career',
  'cashflowDay',
  'narrative',
]

describe('scene art', () => {
  it('每种格子都有场景图', () => {
    const kinds = new Set([...buildTrack('worker'), ...buildTrack('investor')].map((s) => s.kind))
    for (const k of kinds) expect(spaceArt(k)).toMatch(/^\/art\//)
  })

  it('每个约会场所与职业都有插画', () => {
    for (const v of DATE_VENUES) expect(venueArt(v.id), v.id).toBeTruthy()
    for (const c of CAREERS) expect(careerArt(c.id), c.id).toBeTruthy()
  })

  it('每个事件大类都有复用图', () => {
    for (const k of EVENT_KINDS) expect(EVENT_ART[k], k).toBeTruthy()
  })

  it('映射到的文件真实存在', () => {
    for (const url of [...ALL_ART, ...Object.values(EVENT_ART)]) {
      expect(existsSync(publicFile(url)), url).toBe(true)
    }
    for (const id of PORTRAIT_CATALOG) {
      expect(existsSync(publicFile(portraitUrl(id)!)), id).toBe(true)
    }
  })

  it('自由生活四区切片存在', () => {
    for (const [tile, url] of Object.entries(FREE_LIFE_MAP_TILE_ART)) {
      expect(url).toMatch(new RegExp(`art/free-life-map-${tile}\\.jpg$`))
      expect(ALL_ART).toContain(url)
      expect(existsSync(publicFile(url)), url).toBe(true)
    }
  })
})

describe('free life park map hotspots', () => {
  it('覆盖全部二十八处地点且区内局部坐标合法', () => {
    expect(FREE_LIFE_PLACES).toHaveLength(28)
    expect(FREE_LIFE_MAP_HOTSPOTS).toHaveLength(28)
    expect(FREE_LIFE_MAP_HOTSPOTS.map((h) => h.id).sort()).toEqual(
      FREE_LIFE_PLACES.map((p) => p.id).sort(),
    )
    for (const h of FREE_LIFE_MAP_HOTSPOTS) {
      expect(hotspotTileMatchesPlace(h), h.id).toBe(true)
      expect(h.left).toBeGreaterThanOrEqual(2)
      expect(h.left).toBeLessThanOrEqual(98)
      expect(h.top).toBeGreaterThanOrEqual(2)
      expect(h.top).toBeLessThanOrEqual(98)
    }
  })

  it('每区七个热点', () => {
    expect(hotspotsForTile('nw')).toHaveLength(7)
    expect(hotspotsForTile('ne')).toHaveLength(7)
    expect(hotspotsForTile('sw')).toHaveLength(7)
    expect(hotspotsForTile('se')).toHaveLength(7)
    expect(hotspotsForTile('sw').some((h) => h.id === 'home')).toBe(true)
    expect(hotspotsForTile('se').some((h) => h.id === 'club')).toBe(true)
  })
})
