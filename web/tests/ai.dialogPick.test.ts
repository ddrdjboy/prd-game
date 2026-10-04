import { describe, expect, it } from 'vitest'
import { previewAutoDialogPick } from '../src/game/ai'
import { createGame } from '../src/game/createGame'
import { pickEventChoice, EVENTS } from '../src/game/events'
import { reduce } from '../src/game/reduce'
import type { GameState } from '../src/game/types'

describe('previewAutoDialogPick', () => {
  it('returns null for human pending event when not full-auto', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const human = g.players[0]
    const event = EVENTS.find((e) => e.id === 'biz2')!
    const pendingEvent = {
      playerId: human.id,
      eventId: event.id,
      title: event.title,
      text: event.text,
      kind: event.kind,
      landIndex: 0,
      landTrack: 'worker' as const,
    }
    expect(previewAutoDialogPick({ ...g, pendingEvent, autoEnabled: false })).toBeNull()
    expect(
      previewAutoDialogPick({
        ...g,
        pendingEvent,
        autoEnabled: true,
        autoChoiceMode: 'manual',
      }),
    ).toBeNull()
  })

  it('previews human event choice in full auto', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const human = g.players[0]
    const event = EVENTS.find((e) => e.id === 'biz2')!
    const pendingEvent = {
      playerId: human.id,
      eventId: event.id,
      title: event.title,
      text: event.text,
      kind: event.kind,
      landIndex: 0,
      landTrack: 'worker' as const,
    }
    const state = {
      ...g,
      pendingEvent,
      autoEnabled: true,
      autoChoiceMode: 'auto' as const,
      players: g.players.map((p) => (p.id === human.id ? { ...p, cash: 2 } : p)),
    } satisfies GameState
    const expected = pickEventChoice(event, state.players[0])
    expect(previewAutoDialogPick(state)).toBe(`event:${expected}`)
  })

  it('mirrors pickEventChoice for AI events', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const ai = g.players[1]
    const event = EVENTS.find((e) => e.id === 'biz2')!
    const pendingEvent = {
      playerId: ai.id,
      eventId: event.id,
      title: event.title,
      text: event.text,
      kind: event.kind,
      landIndex: 0,
      landTrack: 'worker' as const,
    }
    const state = {
      ...g,
      pendingEvent,
      players: g.players.map((p) => (p.id === ai.id ? { ...p, cash: 2 } : p)),
    } satisfies GameState
    const expected = pickEventChoice(event, state.players[1])
    expect(previewAutoDialogPick(state)).toBe(`event:${expected}`)
  })

  it('previews AI decision buttons the same way autoStep resolves them', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const ai = g.players[1]
    expect(
      previewAutoDialogPick({
        ...g,
        pendingDecision: { type: 'enterFreeLife', playerId: ai.id },
      }),
    ).toBe('decision:enterFreeLife')
    expect(
      previewAutoDialogPick({
        ...g,
        pendingDecision: {
          type: 'bigSpend',
          playerId: ai.id,
          investmentId: 'x',
          cost: 1,
          cashflow: 0.1,
          name: 'x',
        },
        players: g.players.map((p) =>
          p.id === ai.id ? { ...p, aiStyle: 'aggressive' } : p,
        ),
      }),
    ).toBe('decision:bigSpend-accept')
    expect(
      previewAutoDialogPick({
        ...g,
        pendingDecision: {
          type: 'poach',
          playerId: ai.id,
          fromPlayerId: g.players[0].id,
          relationId: 'r1',
        },
      }),
    ).toBe('decision:poach-keep')
  })

  it('previews each visit step button key (pay / talk / gift / leave)', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const ai = g.players[1]
    const baseVisit = {
      playerId: ai.id,
      ownerId: g.players[0].id,
      shopId: 'shop-1',
      entryFee: 0.1,
      tipFee: 0.05,
      paid: false,
      rapport: 0,
      staffId: null as string | null,
      lastReels: null,
      lastPoachOk: null as boolean | null,
    }
    expect(
      previewAutoDialogPick({
        ...g,
        pendingVisitShop: { ...baseVisit, step: 'pay' as const },
        players: g.players.map((p) => (p.id === ai.id ? { ...p, cash: 2 } : p)),
      }),
    ).toBe('visit:pay')
    expect(
      previewAutoDialogPick({
        ...g,
        pendingVisitShop: { ...baseVisit, step: 'talkManager' as const, paid: true },
      }),
    ).toBe('visit:talk')
    expect(
      previewAutoDialogPick({
        ...g,
        pendingVisitShop: {
          ...baseVisit,
          step: 'gift' as const,
          paid: true,
          staffId: 'r1',
        },
      }),
    ).toBe('visit:skip-gift')
    expect(
      previewAutoDialogPick({
        ...g,
        pendingVisitShop: {
          ...baseVisit,
          step: 'poach' as const,
          paid: true,
          staffId: 'r1',
          lastPoachOk: false,
        },
      }),
    ).toBe('visit:leave')
  })
})

describe('auto pick flash timing', () => {
  it('press + after equals AUTO_SPEED_MS for each speed', async () => {
    const { AUTO_PICK_AFTER_MS, AUTO_PICK_PRESS_MS, AUTO_SPEED_MS } = await import(
      '../src/game/config'
    )
    for (const speed of ['fast', 'medium', 'slow'] as const) {
      expect(AUTO_PICK_PRESS_MS[speed] + AUTO_PICK_AFTER_MS[speed]).toBe(AUTO_SPEED_MS[speed])
    }
  })
})
