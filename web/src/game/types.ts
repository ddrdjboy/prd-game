import type { SEASONS } from './config'

export type Season = (typeof SEASONS)[number]
export type Track = 'worker' | 'investor'

/** 地图格子（落点互动） */
export type SpaceKind =
  | 'payday' // 发薪
  | 'vacant' // 空地
  | 'shop' // 商店
  | 'office' // 私人事务所
  | 'manage' // 经营区
  | 'park' // 公园
  | 'invest' // 投资所（投资人圈）
  | 'casino' // 赌场

/** 拉霸随机事件分类（与地图格无关） */
export type EventKind =
  | 'opportunity'
  | 'market'
  | 'doodad'
  | 'relation'
  | 'business'
  | 'rest'
  | 'career'
  | 'cashflowDay'
  | 'narrative'

export type RelationKind = 'network' | 'romance'
export type RelationStatus =
  | 'new'
  | 'stable'
  | 'partner'
  | 'dating'
  | 'engaged'
  | 'married'
  | 'broken'

export type AiStyle = 'steady' | 'aggressive' | 'social'
export type GamePhase = 'home' | 'careerPick' | 'playing' | 'settlement'
export type AutoSensitivity = 'low' | 'standard' | 'high'

export type CareerTrait =
  | 'networkBoost'
  | 'romanceBoost'
  | 'investDiscount'
  | 'expenseResist'

export interface Career {
  id: string
  name: string
  salary: number
  fixedExpense: number
  startingCash: number
  trait: CareerTrait
  traitLabel: string
}

export interface BoardSpace {
  index: number
  kind: SpaceKind
  label: string
}

export interface Relation {
  id: string
  kind: RelationKind
  name: string
  score: number
  status: RelationStatus
  locked: boolean
  /** 0–3 个技能 id */
  skills: string[]
  /** 进修中：剩余自己的回合数 */
  training: null | { skillId: string; turnsLeft: number; successChance: number }
}

export interface Shop {
  id: string
  name: string
  level: 1 | 2 | 3
  /** @deprecated 兼容旧逻辑；与 baseRevenue 同步 */
  baseCashflow: number
  /** 模板 id，见 shopCatalog */
  typeId: string
  /** 季营收基准 */
  baseRevenue: number
  /** 季固定经营成本 */
  operatingCost: number
  /** 最近一期行情系数（发薪写入） */
  lastFactor: number
  /** 员工关系 id（含店长），1–9 */
  staffIds: string[]
  /** 店长，须 ∈ staffIds */
  managerId: string
  /** 本店相关技能（加成匹配） */
  skillTags: string[]
  /** 开店时店长须具备（可空） */
  requiredSkills: string[]
  /** 空地开店绑定的棋盘圈；事件店为 null */
  boardTrack: Track | null
  /** 空地开店绑定的格位；事件店为 null */
  boardIndex: number | null
}

export interface Investment {
  id: string
  name: string
  cost: number
  cashflow: number
}

export interface PlayerState {
  id: string
  name: string
  isHuman: boolean
  careerId: string | null
  salary: number
  fixedExpense: number
  cash: number
  liabilities: number
  track: Track
  position: number
  relations: Relation[]
  shops: Shop[]
  investments: Investment[]
  actionPoints: number
  aiStyle: AiStyle | null
  trait: CareerTrait | null
  /** 剩余自己的回合数，>0 时不可挖角 */
  poachCooldown: number
  /** 本回合已维护（约会/公园/事务所升温）的关系，结束回合不衰减 */
  maintainedRelationIds: string[]
}

export interface FinanceSnapshot {
  salary: number
  passiveIncome: number
  totalIncome: number
  totalExpense: number
  seasonalCashflow: number
  netWorth: number
  freeProgress: number
}

export interface LogEntry {
  id: string
  text: string
}

export type PendingDecision =
  | { type: 'promote'; playerId: string }
  | { type: 'marriage'; playerId: string; relationId: string }
  | { type: 'bigSpend'; playerId: string; investmentId: string; cost: number; cashflow: number; name: string }
  | { type: 'poach'; playerId: string; fromPlayerId: string; relationId: string }
  | { type: 'bankrupt'; playerId: string; amount: number }
  | { type: 'eventChoice'; playerId: string; eventId: string }

export interface PendingEvent {
  playerId: string
  eventId: string
  title: string
  text: string
  kind: EventKind
  /** 拉霸来源说明 */
  slotHint?: string
  /** 事件结束后要打开的落点 */
  landIndex: number
  landTrack: Track
}

export interface PendingLocation {
  playerId: string
  spaceKind: SpaceKind
  spaceIndex: number
  track: Track
  label: string
}

export interface PendingDate {
  playerId: string
  step: 'pickPartner' | 'pickVenue'
  relationId?: string
}

export interface ShopItem {
  id: string
  name: string
  cost: number
  desc: string
}

export interface MoveAnimation {
  playerId: string
  track: Track
  path: number[]
  pathIndex: number
  dice: number
  passedPayday: boolean
  finalPosition: number
  reels: [number, number, number]
}

/** 777 拉霸：第一位 = 行走格数 */
export interface SlotSpin {
  playerId: string
  track: Track
  /** 最终停轮结果，reels[0] 为步数（1–9） */
  reels: [number, number, number]
}

export interface GameState {
  phase: GamePhase
  seatCount: number
  age: number
  seasonIndex: number
  turnPlayerIndex: number
  players: PlayerState[]
  careerChoices: Career[]
  logs: LogEntry[]
  pendingEvent: PendingEvent | null
  pendingDecision: PendingDecision | null
  pendingLocation: PendingLocation | null
  deferredLocation: PendingLocation | null
  pendingDate: PendingDate | null
  pendingCasino: import('./casino').PendingCasino | null
  pendingVisitShop: import('./visitShop').PendingVisitShop | null
  pendingExchange: import('./exchange').PendingExchange | null
  slotSpin: SlotSpin | null
  moveAnimation: MoveAnimation | null
  autoEnabled: boolean
  autoSensitivity: AutoSensitivity
  seed: number
  rngState: number
  endAge: number
  lastDice: number | null
  lastReels: [number, number, number] | null
  /** 当前回合是否已拉过 777（一人一回合） */
  turnRolled: boolean
}

export type GameAction =
  | { type: 'NEW_GAME'; seatCount: number; seed?: number; endAge?: number }
  | { type: 'CHOOSE_CAREER'; careerId: string }
  | { type: 'ROLL_AND_MOVE' }
  | { type: 'FINISH_SLOT' }
  | { type: 'ANIM_STEP' }
  | { type: 'FINISH_MOVE' }
  | { type: 'RESOLVE_EVENT_CHOICE'; choiceId: string }
  | { type: 'LOCATION_BUY_VACANT'; relationId: string }
  | { type: 'LOCATION_BUY_ITEM'; itemId: string }
  | { type: 'LOCATION_POACH' }
  | { type: 'OFFICE_RECOMMEND'; kind: 'network' | 'romance' }
  | { type: 'OFFICE_ADJUST'; ownerId: string; relationId: string; direction: 'up' | 'down' }
  | { type: 'OFFICE_POACH'; targetPlayerId: string; relationId: string }
  | { type: 'LOCATION_UPGRADE_SHOP'; shopId: string }
  | { type: 'LOCATION_REBIND_OPERATOR'; shopId: string; relationId: string }
  | { type: 'SHOP_ADD_STAFF'; shopId: string; relationId: string }
  | { type: 'SHOP_REMOVE_STAFF'; shopId: string; relationId: string }
  | { type: 'SHOP_SET_MANAGER'; shopId: string; relationId: string }
  | { type: 'TRAIN_START'; relationId: string; skillId: string }
  | { type: 'LOCATION_PARK_REST' }
  | { type: 'LOCATION_PARK_CHAT'; relationId: string }
  | { type: 'LOCATION_BUY_INVEST'; offerId: string }
  | { type: 'LOCATION_SELL_INVEST'; investmentId: string }
  | { type: 'LOCATION_GAMBLE'; bet: number }
  | { type: 'CASINO_ENTER' }
  | { type: 'CASINO_LEAVE' }
  | { type: 'CASINO_LOBBY' }
  | { type: 'CASINO_OPEN'; game: 'baccarat' | 'dice' | 'blackjack' }
  | { type: 'CASINO_BACARAT_BET'; betKind: 'player' | 'banker' | 'tie'; amount: number }
  | { type: 'CASINO_DICE_BET'; line: 'pass' | 'dontPass'; amount: number; fieldAmount?: number }
  | { type: 'CASINO_DICE_ROLL' }
  | { type: 'CASINO_BJ_BET'; amount: number }
  | { type: 'CASINO_BJ_INSURANCE'; take: boolean }
  | { type: 'CASINO_BJ_HIT' }
  | { type: 'CASINO_BJ_STAND' }
  | { type: 'CASINO_BJ_DOUBLE' }
  | { type: 'CASINO_BJ_SPLIT' }
  | { type: 'CASINO_BJ_NEXT' }
  | { type: 'VISIT_PAY' }
  | { type: 'VISIT_TALK' }
  | { type: 'VISIT_PICK_STAFF'; relationId: string }
  | { type: 'VISIT_GIFT'; giftId: string }
  | { type: 'VISIT_SKIP_GIFT' }
  | { type: 'VISIT_POACH_SPIN' }
  | { type: 'VISIT_SKIP_POACH' }
  | { type: 'VISIT_LEAVE' }
  | { type: 'EXCHANGE_ENTER' }
  | { type: 'EXCHANGE_LEAVE' }
  | { type: 'EXCHANGE_LOBBY' }
  | { type: 'EXCHANGE_OPEN_FUNDS' }
  | { type: 'EXCHANGE_OPEN_TRADE'; stake: number }
  | { type: 'EXCHANGE_TICK' }
  | { type: 'EXCHANGE_BUY'; symbolId: string; amount: number }
  | { type: 'EXCHANGE_SELL'; symbolId: string; qtyRatio?: number }
  | { type: 'EXCHANGE_SET_LEVERAGE'; leverage: 1 | 2 | 5 }
  | { type: 'EXCHANGE_CLOSE' }
  | { type: 'LOCATION_SKIP' }
  | { type: 'SPEND_ACTION'; action: 'date' }
  | { type: 'DATE_PICK_PARTNER'; relationId: string }
  | { type: 'DATE_CONFIRM_VENUE'; venueId: string }
  | { type: 'DATE_CANCEL' }
  | { type: 'PROMOTE_TO_INVESTOR' }
  | { type: 'SKIP_PROMOTE' }
  | { type: 'CONFIRM_MARRIAGE'; accept: boolean }
  | { type: 'CONFIRM_BIG_SPEND'; accept: boolean }
  | { type: 'CONFIRM_POACH'; accept: boolean }
  | { type: 'RESOLVE_BANKRUPT' }
  | { type: 'END_TURN' }
  | { type: 'SET_AUTO'; enabled: boolean }
  | { type: 'SET_SENSITIVITY'; value: AutoSensitivity }
  | { type: 'AUTO_STEP' }
  | { type: 'LOAD_STATE'; state: GameState }

export interface ScoreResult {
  free: boolean
  netWorth: number
  networkScore: number
  romanceScore: number
  grade: 'S' | 'A' | 'B' | 'C'
  comment: string
  finance: FinanceSnapshot
}
