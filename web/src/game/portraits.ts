import type { PlayerState } from './types'

export type CharacterDef = {
  /** g01…g20，对应 /portraits/{id}.jpg */
  portraitId: string
  /** CHARACTER_PROMPTS.md 中的英文 id */
  key: string
  name: string
  /** 职业 / 身份（来自提示词表） */
  title: string
  /** 一句气质+场景提示 */
  blurb: string
  /** 初始技能 0–3 */
  skills: string[]
}

/**
 * 20 名定妆角色：图序 = CHARACTER_PROMPTS.md 的 1…20
 * 中文名按职业与气质拟定，便于对局辨认。
 */
export const CHARACTERS: readonly CharacterDef[] = [
  {
    portraitId: 'g01',
    key: 'blue_maid',
    name: '蓝铃',
    title: '女仆',
    blurb: '浅蓝长发与夜窗城市灯火，温柔而妥帖。',
    skills: ['service'],
  },
  {
    portraitId: 'g02',
    key: 'rainbow_space',
    name: '星澜',
    title: '航天员',
    blurb: '彩虹卷发坐在飞船舷窗前，望着地球弧光。',
    skills: ['manage', 'creative'],
  },
  {
    portraitId: 'g03',
    key: 'water_rune',
    name: '涟心',
    title: '水符文法师',
    blurb: '青蓝短发与紫粉眼，水花与符文环绕。',
    skills: ['creative'],
  },
  {
    portraitId: 'g04',
    key: 'sakura_sailor',
    name: '樱奈',
    title: '水手服少女',
    blurb: '樱花树下的琥珀眼笑意，清新利落。',
    skills: ['service', 'sales'],
  },
  {
    portraitId: 'g05',
    key: 'sunset_beach',
    name: '夏澄',
    title: '泳装少女',
    blurb: '长黑发与翠绿眼，日落沙滩的暖橙光。',
    skills: ['service'],
  },
  {
    portraitId: 'g06',
    key: 'ember_chef',
    name: '炽火',
    title: '料理师',
    blurb: '暖红短发、琥珀眼，厨房灶火与铜锅香气。',
    skills: ['cook', 'service'],
  },
  {
    portraitId: 'g07',
    key: 'bamboo_archer',
    name: '青羽',
    title: '弓手',
    blurb: '墨青马尾、冷静青灰眼，晨雾竹林中蓄势。',
    skills: ['manage'],
  },
  {
    portraitId: 'g08',
    key: 'violet_scribe',
    name: '紫砚',
    title: '文书官',
    blurb: '淡紫长发与紫罗兰眼，烛光古籍室里文静浅笑。',
    skills: ['manage', 'creative'],
  },
  {
    portraitId: 'g09',
    key: 'neon_rider',
    name: '霓可',
    title: '机车技师',
    blurb: '金棕双马尾、俏皮琥珀眼，雨夜霓虹车库。',
    skills: ['creative', 'sales'],
  },
  {
    portraitId: 'g10',
    key: 'bloom_florist',
    name: '花穗',
    title: '花店女店主',
    blurb: '柔粉发与小花发夹，晴天花店橱窗的亲切笑。',
    skills: ['retail', 'service'],
  },
  {
    portraitId: 'g11',
    key: 'frost_skater',
    name: '冰璃',
    title: '花样滑冰选手',
    blurb: '银白长发冰蓝眼，冰场反光中自信浅笑。',
    skills: ['service', 'creative'],
  },
  {
    portraitId: 'g12',
    key: 'matcha_tea',
    name: '茶纪',
    title: '茶艺师',
    blurb: '深绿高髻与翠绿眼，榻榻米茶室里温雅奉茶。',
    skills: ['service'],
  },
  {
    portraitId: 'g13',
    key: 'dune_wanderer',
    name: '沙言',
    title: '沙漠旅人',
    blurb: '沙金长发与琥珀眼，绿洲棕榈边的坚毅浅笑。',
    skills: ['sales', 'manage'],
  },
  {
    portraitId: 'g14',
    key: 'stage_idol',
    name: '星柚',
    title: '舞台偶像',
    blurb: '粉蓝麻花辫与粉眼，舞台追光下灿烂笑容。',
    skills: ['sales', 'creative'],
  },
  {
    portraitId: 'g15',
    key: 'noir_detective',
    name: '墨探',
    title: '侦探',
    blurb: '短黑发灰眼，雨夜街道霓虹倒影中的冷静。',
    skills: ['manage'],
  },
  {
    portraitId: 'g16',
    key: 'cream_patissier',
    name: '糖绘',
    title: '甜点师',
    blurb: '奶油金卷发与蜜色眼，粉色甜品店橱窗前。',
    skills: ['cook', 'retail'],
  },
  {
    portraitId: 'g17',
    key: 'crimson_knight',
    name: '绯甲',
    title: '骑士',
    blurb: '酒红长发金眼，城堡庭院中绯红轻甲与披风。',
    skills: ['manage', 'sales'],
  },
  {
    portraitId: 'g18',
    key: 'coral_diver',
    name: '珊瑚',
    title: '水族馆向导',
    blurb: '青绿短发海蓝眼，海底隧道热带鱼游过身旁。',
    skills: ['service', 'sales'],
  },
  {
    portraitId: 'g19',
    key: 'alpine_guide',
    name: '雪踪',
    title: '登山向导',
    blurb: '栗棕辫发与褐绿眼，雪山营地帐篷边爽朗一笑。',
    skills: ['service', 'manage'],
  },
  {
    portraitId: 'g20',
    key: 'brass_inventor',
    name: '铜心',
    title: '蒸汽发明家',
    blurb: '铜色短发、额前护目镜，黄铜工坊齿轮暖光。',
    skills: ['creative', 'manage'],
  },
]

/** 已登记的肖像 id；加图时只追加，勿复用旧 id */
export const PORTRAIT_CATALOG = CHARACTERS.map((c) => c.portraitId)

const BY_PORTRAIT = new Map(CHARACTERS.map((c) => [c.portraitId, c]))
const BY_NAME = new Map(CHARACTERS.map((c) => [c.name, c]))
const CATALOG_SET = new Set(PORTRAIT_CATALOG)

export function characterByPortraitId(id: string | undefined | null): CharacterDef | undefined {
  if (!id) return undefined
  return BY_PORTRAIT.get(id)
}

export function characterByName(name: string): CharacterDef | undefined {
  return BY_NAME.get(name)
}

export function portraitUrl(id: string | undefined | null): string | null {
  if (!id || !CATALOG_SET.has(id)) return null
  return `${import.meta.env.BASE_URL}portraits/${id}.jpg`
}

export function usedPortraitIds(players: PlayerState[]): Set<string> {
  const used = new Set<string>()
  for (const p of players) {
    for (const r of p.relations) {
      if (r.portraitId) used.add(r.portraitId)
    }
  }
  return used
}

function usedNames(players: PlayerState[]): Set<string> {
  const used = new Set<string>()
  for (const p of players) {
    for (const r of p.relations) used.add(r.name)
  }
  return used
}

/** 抽一名尚未占用肖像与名字的角色；池空返回 undefined */
export function pickCharacter(
  players: PlayerState[],
  rng: () => number,
): CharacterDef | undefined {
  const portraits = usedPortraitIds(players)
  const names = usedNames(players)
  const free = CHARACTERS.filter((c) => !portraits.has(c.portraitId) && !names.has(c.name))
  if (!free.length) return undefined
  return free[Math.floor(rng() * free.length)]
}

/** @deprecated 优先用 pickCharacter；仅在角色池用尽时回退 */
export function pickPortraitId(used: Set<string>, rng: () => number): string | undefined {
  const free = PORTRAIT_CATALOG.filter((id) => !used.has(id))
  if (!free.length) return undefined
  return free[Math.floor(rng() * free.length)]
}
