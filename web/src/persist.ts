import { migrateScoreToAffinity } from './game/affinity'
import { initialSkillsForName } from './game/relationsCatalog'
import { inferShopTypeId, shopTypeById } from './game/shopCatalog'
import { shopTagsFromName, VACANT_SHOP_TAGS } from './game/skills'
import { inferBoardFromShopId } from './game/visitShop'
import type { GameState, Relation, Shop } from './game/types'

const KEY = 'fi45_save'

type LegacyShop = Partial<Shop> &
  Pick<Shop, 'id' | 'name' | 'level'> & {
    operatorRelationId?: string
    baseCashflow?: number
  }

type LegacyRelation = {
  id: string
  name: string
  kind?: string
  score?: number
  affinity?: number
  status?: string
  locked?: boolean
  skills?: string[]
  training?: Relation['training']
}

function migrateShop(shop: LegacyShop): Shop {
  const typeId = shop.typeId ?? inferShopTypeId(shop.name)
  const def = shopTypeById(typeId)
  const tags =
    shop.skillTags?.length
      ? { skillTags: shop.skillTags, requiredSkills: shop.requiredSkills ?? [] }
      : /空地/.test(shop.name)
        ? VACANT_SHOP_TAGS
        : shopTagsFromName(shop.name)

  const opId = shop.managerId ?? shop.operatorRelationId ?? shop.staffIds?.[0] ?? ''
  const staffIds =
    shop.staffIds?.length ? shop.staffIds : opId ? [opId] : []
  const baseRevenue =
    shop.baseRevenue ?? shop.baseCashflow ?? def?.baseRevenue ?? 0.25
  const operatingCost =
    shop.operatingCost ??
    (def ? Math.round(def.operatingCost * (baseRevenue / def.baseRevenue) * 100) / 100 : round2(baseRevenue * 0.45))
  const inferred = inferBoardFromShopId(shop.id)
  const boardTrack =
    shop.boardTrack !== undefined ? shop.boardTrack : (inferred?.boardTrack ?? null)
  const boardIndex =
    shop.boardIndex !== undefined ? shop.boardIndex : (inferred?.boardIndex ?? null)

  return {
    id: shop.id,
    name: shop.name,
    level: shop.level,
    typeId,
    baseRevenue,
    operatingCost,
    baseCashflow: baseRevenue,
    lastFactor: shop.lastFactor ?? 1,
    staffIds,
    managerId: shop.managerId || opId,
    skillTags: tags.skillTags,
    requiredSkills: shop.requiredSkills ?? tags.requiredSkills,
    boardTrack,
    boardIndex,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function migrateRelation(r: LegacyRelation): Relation {
  const broken = r.status === 'broken'
  const affinity =
    typeof r.affinity === 'number'
      ? r.affinity
      : migrateScoreToAffinity(r.score ?? 40, broken)
  return {
    id: r.id,
    name: r.name,
    affinity,
    locked: Boolean(r.locked) && affinity > 0,
    skills: r.skills?.length ? r.skills : initialSkillsForName(r.name),
    training: r.training ?? null,
  }
}

export function migrateState(state: GameState): GameState {
  return {
    ...state,
    turnRolled: state.turnRolled ?? false,
    pendingCasino: state.pendingCasino ?? null,
    pendingVisitShop: state.pendingVisitShop ?? null,
    pendingExchange: state.pendingExchange ?? null,
    settlementReason: state.settlementReason ?? null,
    players: state.players.map((p) => ({
      ...p,
      poachCooldown: p.poachCooldown ?? 0,
      maintainedRelationIds: p.maintainedRelationIds ?? [],
      negativePaydayStreak: p.negativePaydayStreak ?? 0,
      trait: (p as { trait?: string }).trait === 'networkBoost' ||
      (p as { trait?: string }).trait === 'romanceBoost'
        ? 'relationBoost'
        : p.trait,
      relations: p.relations.map((r) => migrateRelation(r as LegacyRelation)),
      shops: p.shops.map((s) => migrateShop(s as LegacyShop)),
    })),
  }
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return migrateState(JSON.parse(raw) as GameState)
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY)
}
