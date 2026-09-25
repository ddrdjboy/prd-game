import { EVENTS, eventsForKind, type EventEffect, type GameEvent } from './events'
import type { EventKind, Track } from './types'

/** 第二位数字 → 事件大类 */
export const SLOT_KIND_LABEL: Record<number, string> = {
  0: '休息',
  1: '机会',
  2: '市场',
  3: '消费',
  4: '关系',
  5: '经营',
  6: '职场',
  7: '好运机会',
  8: '市场波动',
  9: '人际关系',
}

export function kindFromSlotDigit(digit: number, track: Track): EventKind {
  const map: EventKind[] = [
    'rest',
    'opportunity',
    'market',
    'doodad',
    'relation',
    'business',
    'career',
    'opportunity',
    'market',
    'relation',
  ]
  let kind = map[digit % 10]
  if (track === 'investor' && kind === 'rest') kind = 'cashflowDay'
  if (track === 'investor' && digit === 7) kind = 'opportunity'
  return kind
}

export interface SlotEventResult {
  event: GameEvent
  kindLabel: string
  comboLabel: string | null
  extraEffects: EventEffect[]
}

export function resolveSlotEvent(
  reels: [number, number, number],
  track: Track,
): SlotEventResult {
  const [a, b, c] = reels
  const kind = kindFromSlotDigit(b, track)
  const pool = eventsForKind(kind)
  const list = pool.length ? pool : eventsForKind('rest')
  const event = list[c % list.length]

  const extraEffects: EventEffect[] = []
  let comboLabel: string | null = null

  if (a === 7 && b === 7 && c === 7) {
    comboLabel = '777 连爆'
    extraEffects.push({ type: 'cash', delta: 0.77 })
  } else if (b === c && b !== 0) {
    comboLabel = `对子 ${b}${c}`
    extraEffects.push({ type: 'cash', delta: 0.15 })
  } else if (a === b && b === c) {
    comboLabel = `三条 ${a}${b}${c}`
    extraEffects.push({ type: 'cash', delta: 0.3 })
  } else if (b === 7 || c === 7) {
    comboLabel = '带 7 小奖'
    extraEffects.push({ type: 'cash', delta: 0.07 })
  }

  if (b === 3 && c >= 7) {
    comboLabel = comboLabel ?? '高消费'
    extraEffects.push({ type: 'cash', delta: -0.2 })
  }

  if (kind === 'relation' && c === 7) {
    const poach = EVENTS.find((e) => e.id === 'rel7')
    if (poach) {
      return {
        event: poach,
        kindLabel: SLOT_KIND_LABEL[b] ?? '关系',
        comboLabel: '挖角警报',
        extraEffects,
      }
    }
  }

  return {
    event,
    kindLabel: SLOT_KIND_LABEL[b] ?? '随机',
    comboLabel,
    extraEffects,
  }
}
