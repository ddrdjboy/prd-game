import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildTrack } from '../src/game/board'
import { CAREERS } from '../src/game/careers'
import { DATE_VENUES } from '../src/game/dating'
import { PORTRAIT_CATALOG, portraitUrl } from '../src/game/portraits'
import type { EventKind } from '../src/game/types'
import { ALL_ART, EVENT_ART, careerArt, spaceArt, venueArt } from '../src/ui/art'

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
})
