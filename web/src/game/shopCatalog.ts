/** 店铺投资类型目录：营收、成本、波动、升级树 */

export interface ShopUpgradeStep {
  /** 升到该 level 的花费（从上一档） */
  upgradeCost: number
  revenueDelta: number
  costDelta: number
}

export interface ShopTypeDef {
  id: string
  label: string
  skillTags: string[]
  requiredSkills: string[]
  /** 波动半幅，U(-σ,+σ) */
  volatility: number
  /** Lv1 初始 */
  baseRevenue: number
  operatingCost: number
  /** index 0 = 升到 Lv2，index 1 = 升到 Lv3 */
  upgrades: [ShopUpgradeStep, ShopUpgradeStep]
  /** 满级后追加运营 */
  extraOps: { cost: number; revenueDelta: number; costDelta: number }
}

/** 春夏秋冬偏置 */
export const SEASON_BIAS = [0.05, 0, 0.03, -0.08] as const

export const SHOP_TYPES: ShopTypeDef[] = [
  {
    id: 'stall',
    label: '街头摊位',
    skillTags: ['sales', 'retail'],
    requiredSkills: [],
    volatility: 0.22,
    baseRevenue: 0.28,
    operatingCost: 0.12,
    upgrades: [
      { upgradeCost: 0.25, revenueDelta: 0.1, costDelta: 0.04 },
      { upgradeCost: 0.4, revenueDelta: 0.12, costDelta: 0.05 },
    ],
    extraOps: { cost: 0.15, revenueDelta: 0.04, costDelta: 0.02 },
  },
  {
    id: 'snack',
    label: '小吃档口',
    skillTags: ['cook', 'service'],
    requiredSkills: ['cook'],
    volatility: 0.18,
    baseRevenue: 0.35,
    operatingCost: 0.18,
    upgrades: [
      { upgradeCost: 0.35, revenueDelta: 0.12, costDelta: 0.06 },
      { upgradeCost: 0.55, revenueDelta: 0.14, costDelta: 0.07 },
    ],
    extraOps: { cost: 0.2, revenueDelta: 0.05, costDelta: 0.03 },
  },
  {
    id: 'cafe',
    label: '咖啡馆',
    skillTags: ['cook', 'service'],
    requiredSkills: ['cook'],
    volatility: 0.12,
    baseRevenue: 0.42,
    operatingCost: 0.22,
    upgrades: [
      { upgradeCost: 0.45, revenueDelta: 0.1, costDelta: 0.05 },
      { upgradeCost: 0.7, revenueDelta: 0.14, costDelta: 0.06 },
    ],
    extraOps: { cost: 0.25, revenueDelta: 0.04, costDelta: 0.02 },
  },
  {
    id: 'convenience',
    label: '便利店',
    skillTags: ['retail', 'sales'],
    requiredSkills: ['retail'],
    volatility: 0.06,
    baseRevenue: 0.55,
    operatingCost: 0.32,
    upgrades: [
      { upgradeCost: 0.5, revenueDelta: 0.12, costDelta: 0.06 },
      { upgradeCost: 0.85, revenueDelta: 0.15, costDelta: 0.08 },
    ],
    extraOps: { cost: 0.3, revenueDelta: 0.05, costDelta: 0.03 },
  },
  {
    id: 'boutique',
    label: '精品零售',
    skillTags: ['retail', 'sales'],
    requiredSkills: ['retail'],
    volatility: 0.14,
    baseRevenue: 0.48,
    operatingCost: 0.26,
    upgrades: [
      { upgradeCost: 0.5, revenueDelta: 0.14, costDelta: 0.06 },
      { upgradeCost: 0.8, revenueDelta: 0.16, costDelta: 0.07 },
    ],
    extraOps: { cost: 0.28, revenueDelta: 0.05, costDelta: 0.025 },
  },
  {
    id: 'brand',
    label: '品牌店',
    skillTags: ['creative', 'sales'],
    requiredSkills: ['creative'],
    volatility: 0.16,
    baseRevenue: 0.7,
    operatingCost: 0.4,
    upgrades: [
      { upgradeCost: 0.8, revenueDelta: 0.18, costDelta: 0.08 },
      { upgradeCost: 1.2, revenueDelta: 0.22, costDelta: 0.1 },
    ],
    extraOps: { cost: 0.4, revenueDelta: 0.06, costDelta: 0.03 },
  },
  {
    id: 'dream',
    label: '梦想小店',
    skillTags: ['creative', 'sales'],
    requiredSkills: ['creative'],
    volatility: 0.25,
    baseRevenue: 0.45,
    operatingCost: 0.2,
    upgrades: [
      { upgradeCost: 0.55, revenueDelta: 0.15, costDelta: 0.05 },
      { upgradeCost: 0.9, revenueDelta: 0.2, costDelta: 0.08 },
    ],
    extraOps: { cost: 0.3, revenueDelta: 0.06, costDelta: 0.03 },
  },
  {
    id: 'gym',
    label: '健身馆',
    skillTags: ['service', 'manage'],
    requiredSkills: ['service'],
    volatility: 0.1,
    baseRevenue: 0.5,
    operatingCost: 0.3,
    upgrades: [
      { upgradeCost: 0.6, revenueDelta: 0.12, costDelta: 0.06 },
      { upgradeCost: 0.95, revenueDelta: 0.16, costDelta: 0.08 },
    ],
    extraOps: { cost: 0.35, revenueDelta: 0.05, costDelta: 0.03 },
  },
  {
    id: 'salon',
    label: '美业店',
    skillTags: ['service', 'sales'],
    requiredSkills: ['service'],
    volatility: 0.13,
    baseRevenue: 0.4,
    operatingCost: 0.22,
    upgrades: [
      { upgradeCost: 0.4, revenueDelta: 0.11, costDelta: 0.05 },
      { upgradeCost: 0.65, revenueDelta: 0.13, costDelta: 0.06 },
    ],
    extraOps: { cost: 0.22, revenueDelta: 0.04, costDelta: 0.02 },
  },
  {
    id: 'bookstore',
    label: '书店文创',
    skillTags: ['creative', 'service'],
    requiredSkills: ['creative'],
    volatility: 0.08,
    baseRevenue: 0.32,
    operatingCost: 0.2,
    upgrades: [
      { upgradeCost: 0.35, revenueDelta: 0.08, costDelta: 0.03 },
      { upgradeCost: 0.55, revenueDelta: 0.1, costDelta: 0.04 },
    ],
    extraOps: { cost: 0.18, revenueDelta: 0.03, costDelta: 0.015 },
  },
  {
    id: 'bar',
    label: '清吧',
    skillTags: ['sales', 'service'],
    requiredSkills: ['sales'],
    volatility: 0.24,
    baseRevenue: 0.52,
    operatingCost: 0.28,
    upgrades: [
      { upgradeCost: 0.55, revenueDelta: 0.14, costDelta: 0.06 },
      { upgradeCost: 0.85, revenueDelta: 0.16, costDelta: 0.07 },
    ],
    extraOps: { cost: 0.3, revenueDelta: 0.05, costDelta: 0.03 },
  },
  {
    id: 'warehouse',
    label: '微仓零售',
    skillTags: ['retail', 'manage'],
    requiredSkills: ['retail'],
    volatility: 0.07,
    baseRevenue: 0.75,
    operatingCost: 0.48,
    upgrades: [
      { upgradeCost: 0.9, revenueDelta: 0.15, costDelta: 0.08 },
      { upgradeCost: 1.4, revenueDelta: 0.2, costDelta: 0.1 },
    ],
    extraOps: { cost: 0.45, revenueDelta: 0.06, costDelta: 0.04 },
  },
  {
    id: 'vacantLot',
    label: '空地小店',
    skillTags: ['retail', 'service', 'sales'],
    requiredSkills: [],
    volatility: 0.12,
    baseRevenue: 0.22,
    operatingCost: 0.1,
    upgrades: [
      { upgradeCost: 0.2, revenueDelta: 0.08, costDelta: 0.03 },
      { upgradeCost: 0.35, revenueDelta: 0.1, costDelta: 0.04 },
    ],
    extraOps: { cost: 0.12, revenueDelta: 0.03, costDelta: 0.015 },
  },
]

export function shopTypeById(id: string): ShopTypeDef | undefined {
  return SHOP_TYPES.find((t) => t.id === id)
}

/** 店名 → 类型（兼容旧事件文案） */
export function inferShopTypeId(name: string): string {
  if (/空地/.test(name)) return 'vacantLot'
  if (/摊/.test(name)) return 'stall'
  if (/小吃|餐|厨|食/.test(name) && !/咖啡/.test(name)) return 'snack'
  if (/咖啡/.test(name)) return 'cafe'
  if (/便利/.test(name)) return 'convenience'
  if (/精品|扩店|升级小店/.test(name)) return 'boutique'
  if (/品牌|双子/.test(name)) return 'brand'
  if (/梦想/.test(name)) return 'dream'
  if (/健身/.test(name)) return 'gym'
  if (/美业|美容|理发/.test(name)) return 'salon'
  if (/书店|文创/.test(name)) return 'bookstore'
  if (/吧|酒/.test(name)) return 'bar'
  if (/仓|仓储/.test(name)) return 'warehouse'
  if (/零售/.test(name)) return 'boutique'
  return 'stall'
}

export function seasonBias(seasonIndex: number): number {
  return SEASON_BIAS[((seasonIndex % 4) + 4) % 4] ?? 0
}

export function rollSeasonFactor(
  seasonIndex: number,
  volatility: number,
  rng: () => number,
): number {
  const noise = (rng() * 2 - 1) * volatility
  return Math.round((1 + seasonBias(seasonIndex) + noise) * 1000) / 1000
}

export function upgradeCostFor(shop: { typeId: string; level: 1 | 2 | 3 }): number {
  const def = shopTypeById(shop.typeId)
  if (!def) return 0.2
  if (shop.level >= 3) return def.extraOps.cost
  return def.upgrades[shop.level - 1].upgradeCost
}

export function applyShopUpgrade<T extends { typeId: string; level: 1 | 2 | 3; baseRevenue: number; operatingCost: number; baseCashflow: number }>(
  shop: T,
): T {
  const def = shopTypeById(shop.typeId)
  if (!def) {
    return {
      ...shop,
      level: Math.min(3, (shop.level + 1) as 1 | 2 | 3) as 1 | 2 | 3,
      baseRevenue: round2(shop.baseRevenue + 0.08),
      baseCashflow: round2(shop.baseCashflow + 0.08),
      operatingCost: round2(shop.operatingCost + 0.03),
    }
  }
  if (shop.level >= 3) {
    const e = def.extraOps
    const baseRevenue = round2(shop.baseRevenue + e.revenueDelta)
    const operatingCost = round2(shop.operatingCost + e.costDelta)
    return { ...shop, baseRevenue, operatingCost, baseCashflow: baseRevenue }
  }
  const step = def.upgrades[shop.level - 1]
  const level = (shop.level + 1) as 1 | 2 | 3
  const baseRevenue = round2(shop.baseRevenue + step.revenueDelta)
  const operatingCost = round2(shop.operatingCost + step.costDelta)
  return { ...shop, level, baseRevenue, operatingCost, baseCashflow: baseRevenue }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
