/**
 * Agent playtest harness: simulate full runs and report stuck / anomalous states.
 * Run: npx tsx scripts/playtest.ts
 */
import { createGame } from '../src/game/createGame'
import { reduce, autoStep, isCriticalPending } from '../src/game/reduce'
import { calcFinance, isFinanciallyFree } from '../src/game/finance'
import { getEvent } from '../src/game/events'
import type { GameState } from '../src/game/types'

function fingerprint(s: GameState): string {
  return [
    s.phase,
    s.age,
    s.seasonIndex,
    s.turnPlayerIndex,
    s.pendingEvent?.eventId ?? '-',
    s.pendingDecision?.type ?? '-',
    s.pendingLocation?.spaceKind ?? '-',
    s.pendingDate?.step ?? '-',
    s.slotSpin ? 'spin' : '-',
    s.moveAnimation ? 'move' : '-',
    s.players.map((p) => `${p.cash.toFixed(2)}/${p.relations.length}/${p.shops.length}`).join('|'),
  ].join('#')
}

function resolveHumanish(s: GameState): GameState {
  // Prefer accepting affordable choices; otherwise decline
  if (s.pendingEvent) {
    const ev = getEvent(s.pendingEvent.eventId)
    const p = s.players.find((x) => x.id === s.pendingEvent!.playerId)
    if (ev && p) {
      const raise = ev.choices.find((c) => c.id === 'raise')
      const accept = ev.choices.find((c) => c.id === 'accept')
      const decline = ev.choices.find((c) => c.id === 'decline')
      const cost = (id: string) => {
        const ch = ev.choices.find((c) => c.id === id)
        if (!ch) return 999
        let c = 0
        for (const e of ch.effects) {
          if (e.type === 'cash' && e.delta < 0) c += -e.delta
          if (e.type === 'offerShop') c += e.cost
          if (e.type === 'offerInvest') c += e.cost
        }
        return c
      }
      if (raise && p.cash >= cost('raise')) return reduce(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: 'raise' })
      if (accept && p.cash >= cost('accept')) return reduce(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: 'accept' })
      if (decline) return reduce(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: 'decline' })
      return reduce(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: ev.choices[0].id })
    }
  }
  if (s.pendingDecision) {
    const d = s.pendingDecision
    if (d.type === 'promote') return reduce(s, { type: 'PROMOTE_TO_INVESTOR' })
    if (d.type === 'marriage') return reduce(s, { type: 'CONFIRM_MARRIAGE', accept: true })
    if (d.type === 'bigSpend') return reduce(s, { type: 'CONFIRM_BIG_SPEND', accept: true })
    if (d.type === 'poach') return reduce(s, { type: 'CONFIRM_POACH', accept: false })
    if (d.type === 'bankrupt') return reduce(s, { type: 'RESOLVE_BANKRUPT' })
  }
  if (s.pendingDate) {
    if (s.pendingDate.step === 'pickPartner') {
      const p = s.players.find((x) => x.id === s.pendingDate!.playerId)!
      const r = p.relations.find((x) => x.status !== 'broken')
      if (r) return reduce(s, { type: 'DATE_PICK_PARTNER', relationId: r.id })
      return reduce(s, { type: 'DATE_CANCEL' })
    }
    return reduce(s, { type: 'DATE_CONFIRM_VENUE', venueId: 'park' })
  }
  if (s.pendingLocation) {
    const loc = s.pendingLocation
    const p = s.players.find((x) => x.id === loc.playerId)!
    if (loc.spaceKind === 'vacant') {
      const op = p.relations.find((r) => r.status !== 'broken')
      if (op && p.cash >= 0.8) return reduce(s, { type: 'LOCATION_BUY_VACANT', relationId: op.id })
      return reduce(s, { type: 'LOCATION_SKIP' })
    }
    if (loc.spaceKind === 'shop') return reduce(s, { type: 'LOCATION_SKIP' })
    if (loc.spaceKind === 'office') return reduce(s, { type: 'LOCATION_SKIP' })
    if (loc.spaceKind === 'manage') {
      if (p.shops[0] && p.cash >= 0.2)
        return reduce(s, { type: 'LOCATION_UPGRADE_SHOP', shopId: p.shops[0].id })
      return reduce(s, { type: 'LOCATION_SKIP' })
    }
    if (loc.spaceKind === 'casino') return reduce(s, { type: 'LOCATION_SKIP' })
    if (loc.spaceKind === 'park') return reduce(s, { type: 'LOCATION_PARK_REST' })
    if (loc.spaceKind === 'invest') {
      if (p.cash >= 0.8) return reduce(s, { type: 'LOCATION_BUY_INVEST', offerId: 'bond' })
      return reduce(s, { type: 'LOCATION_SKIP' })
    }
    return reduce(s, { type: 'LOCATION_SKIP' })
  }
  if (s.slotSpin) return reduce(s, { type: 'FINISH_SLOT' })
  if (s.moveAnimation) return reduce(s, { type: 'FINISH_MOVE' })
  return s
}

function playSeed(seed: number, endAge = 25): {
  ok: boolean
  age: number
  steps: number
  stuck?: string
  free?: boolean
  issues: string[]
} {
  let s = createGame({ seatCount: 3, seed, endAge })
  s = reduce(s, { type: 'CHOOSE_CAREER', careerId: s.careerChoices[0].id })
  s = { ...s, autoEnabled: true, autoSensitivity: 'standard' }

  const issues: string[] = []
  let lastFp = ''
  let sameCount = 0
  const maxSteps = 8000

  for (let i = 0; i < maxSteps; i++) {
    if (s.phase === 'settlement') {
      const you = s.players[0]
      return {
        ok: true,
        age: s.age,
        steps: i,
        free: isFinanciallyFree(you),
        issues,
      }
    }

    // NaN / invalid cash
    for (const p of s.players) {
      if (!Number.isFinite(p.cash) || !Number.isFinite(p.liabilities)) {
        issues.push(`non-finite money ${p.name} cash=${p.cash}`)
      }
      if (p.cash < -50) issues.push(`deeply negative cash ${p.name}=${p.cash}`)
    }

    const before = fingerprint(s)
    let next: GameState

    const humanPending =
      (s.pendingEvent && s.players.find((p) => p.id === s.pendingEvent!.playerId)?.isHuman) ||
      (s.pendingDecision && s.players.find((p) => p.id === s.pendingDecision!.playerId)?.isHuman) ||
      (s.pendingDate && s.players.find((p) => p.id === s.pendingDate!.playerId)?.isHuman) ||
      (s.pendingLocation && s.players.find((p) => p.id === s.pendingLocation!.playerId)?.isHuman)

    if (humanPending || (s.pendingDecision && isCriticalPending(s))) {
      next = resolveHumanish(s)
      if (next === s || fingerprint(next) === before) {
        // try autoStep anyway
        next = autoStep(s)
      }
    } else {
      next = autoStep(s)
      if (fingerprint(next) === before) {
        next = resolveHumanish(s)
      }
      if (fingerprint(next) === before) {
        // force end turn / roll
        const cur = next.players[next.turnPlayerIndex]
        if (cur.isHuman && !next.pendingEvent && !next.pendingDecision && !next.pendingLocation && !next.pendingDate && !next.slotSpin && !next.moveAnimation) {
          if (cur.actionPoints > 0 && cur.relations.some((r) => r.status !== 'broken') && cur.cash >= 0.05) {
            next = reduce(next, { type: 'SPEND_ACTION', action: 'date' })
            next = resolveHumanish(next)
          } else {
            next = reduce(next, { type: 'ROLL_AND_MOVE' })
            next = resolveHumanish(next)
            if (next.slotSpin) next = reduce(next, { type: 'FINISH_SLOT' })
            if (next.moveAnimation) next = reduce(next, { type: 'FINISH_MOVE' })
            next = resolveHumanish(next)
            if (!next.pendingEvent && !next.pendingDecision && !next.pendingLocation && !next.pendingDate) {
              next = reduce(next, { type: 'END_TURN' })
            }
          }
        }
      }
    }

    const fp = fingerprint(next)
    if (fp === lastFp) sameCount++
    else {
      sameCount = 0
      lastFp = fp
    }
    if (sameCount > 30) {
      return {
        ok: false,
        age: next.age,
        steps: i,
        stuck: fp,
        issues: [...issues, `stuck at ${fp}`],
      }
    }
    s = next
  }

  return { ok: false, age: s.age, steps: maxSteps, stuck: 'maxSteps', issues }
}

const seeds = [1, 7, 42, 99, 123, 777, 2026, 31415, 8888, 555]
const results = seeds.map((seed) => ({ seed, ...playSeed(seed, 24) }))

console.log(JSON.stringify(results, null, 2))

const failed = results.filter((r) => !r.ok || r.issues.length)
console.log('\n--- summary ---')
console.log(`runs=${results.length} ok=${results.filter((r) => r.ok).length} problem=${failed.length}`)
for (const r of failed) {
  console.log(`seed ${r.seed}: ok=${r.ok} age=${r.age} issues=${r.issues.join('; ')} stuck=${r.stuck ?? ''}`)
}

// One deep telemetry dump for seed 42
{
  let s = createGame({ seatCount: 3, seed: 42, endAge: 30 })
  s = reduce(s, { type: 'CHOOSE_CAREER', careerId: s.careerChoices[0].id })
  s = { ...s, autoEnabled: true }
  for (let i = 0; i < 5000 && s.phase !== 'settlement'; i++) {
    const before = fingerprint(s)
    let n = autoStep(s)
    if (fingerprint(n) === before) n = resolveHumanish(s)
    if (fingerprint(n) === before) {
      n = reduce(n, { type: 'ROLL_AND_MOVE' })
      n = resolveHumanish(n)
      if (n.slotSpin) n = reduce(n, { type: 'FINISH_SLOT' })
      if (n.moveAnimation) n = reduce(n, { type: 'FINISH_MOVE' })
      n = resolveHumanish(n)
      if (!n.pendingEvent && !n.pendingDecision && !n.pendingLocation && !n.pendingDate && !n.slotSpin && !n.moveAnimation) {
        n = reduce(n, { type: 'END_TURN' })
      }
    }
    s = n
  }
  const you = s.players[0]
  const fin = calcFinance(you)
  console.log('\n--- seed42 snapshot ---')
  console.log({
    phase: s.phase,
    age: s.age,
    season: s.seasonIndex,
    track: you.track,
    cash: you.cash,
    shops: you.shops.length,
    investments: you.investments.length,
    relations: you.relations.map((r) => `${r.name}:${r.score}:${r.status}`),
    finance: fin,
    free: isFinanciallyFree(you),
    lastLogs: s.logs.slice(-8).map((l) => l.text),
  })
}
