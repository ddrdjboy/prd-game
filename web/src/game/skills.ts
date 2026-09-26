export interface SkillDef {
  id: string
  name: string
  cost: number
  turns: number
  successChance: number
  /** 匹配店铺 skillTags 时的 CF 加成 */
  shopBonus: number
}

export const MAX_SKILLS = 3
export const SKILL_BONUS_CAP = 0.4
export const SHOP_SELL_RATIO = 0.9

export const SKILLS: SkillDef[] = [
  { id: 'sales', name: '销售', cost: 0.25, turns: 1, successChance: 0.7, shopBonus: 0.08 },
  { id: 'service', name: '服务', cost: 0.2, turns: 1, successChance: 0.75, shopBonus: 0.06 },
  { id: 'cook', name: '厨艺', cost: 0.35, turns: 2, successChance: 0.6, shopBonus: 0.12 },
  { id: 'retail', name: '零售', cost: 0.3, turns: 2, successChance: 0.65, shopBonus: 0.1 },
  { id: 'manage', name: '管理', cost: 0.4, turns: 2, successChance: 0.55, shopBonus: 0.1 },
  { id: 'creative', name: '创意', cost: 0.3, turns: 2, successChance: 0.6, shopBonus: 0.1 },
]

export function skillById(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id)
}

export function skillLabel(id: string): string {
  return skillById(id)?.name ?? id
}

/** 店铺等级 → 编制上限 */
export function shopCapacity(level: 1 | 2 | 3): number {
  return level * 3
}

export function shopTagsFromName(name: string): { skillTags: string[]; requiredSkills: string[] } {
  if (/便利|摊|零售/.test(name)) {
    return { skillTags: ['retail', 'sales'], requiredSkills: ['retail'] }
  }
  if (/咖啡|餐|厨|食/.test(name)) {
    return { skillTags: ['cook', 'service'], requiredSkills: ['cook'] }
  }
  if (/品牌|梦想|创意|设计/.test(name)) {
    return { skillTags: ['creative', 'sales'], requiredSkills: ['creative'] }
  }
  if (/升级|精品|扩/.test(name)) {
    return { skillTags: ['sales', 'service'], requiredSkills: [] }
  }
  return { skillTags: ['sales', 'service'], requiredSkills: [] }
}

/** 空地小店：无硬门槛，偏零售/服务 */
export const VACANT_SHOP_TAGS = {
  skillTags: ['retail', 'service', 'sales'],
  requiredSkills: [] as string[],
}
