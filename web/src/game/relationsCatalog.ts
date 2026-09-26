export const NETWORK_NAMES = [
  '阿强', '小林', '老周', '小美同事', '客户老王', '导师陈', '合伙人阿杰',
  'HR小张', '设计师阿南', '会计小刘', '产品阿飞', '运营小雪', '投资人K',
  '前台小慧', '技术大佬', '销售冠军', '媒体朋友', '学长阿哲', '邻居大叔', '社团学妹',
]

export const ROMANCE_NAMES = [
  '晓雯', '子轩', '诗涵', '浩然', '雨桐', '一诺', '思远',
  '佳怡', '明杰', '若曦', '宇轩', '清妍', '志强', '欣怡', '天佑',
]

/** 人名 → 固定初始技能（0–3） */
export const INITIAL_SKILLS_BY_NAME: Record<string, string[]> = {
  阿强: ['sales'],
  小林: ['service'],
  老周: ['manage', 'retail'],
  小美同事: ['service'],
  客户老王: ['sales'],
  导师陈: ['manage'],
  合伙人阿杰: ['manage', 'sales'],
  HR小张: ['service'],
  设计师阿南: ['creative'],
  会计小刘: ['retail'],
  产品阿飞: ['creative', 'sales'],
  运营小雪: ['sales', 'service'],
  投资人K: ['manage'],
  前台小慧: ['service'],
  技术大佬: ['creative'],
  销售冠军: ['sales', 'manage'],
  媒体朋友: ['creative', 'sales'],
  学长阿哲: ['manage'],
  邻居大叔: ['retail'],
  社团学妹: ['service'],
  晓雯: ['service'],
  子轩: ['sales'],
  诗涵: ['creative'],
  浩然: ['sales'],
  雨桐: ['service', 'creative'],
  一诺: ['service'],
  思远: ['manage'],
  佳怡: ['service'],
  明杰: ['sales', 'retail'],
  若曦: ['creative'],
  宇轩: ['sales'],
  清妍: ['service'],
  志强: ['retail', 'manage'],
  欣怡: ['service'],
  天佑: ['sales'],
}

export function initialSkillsForName(name: string): string[] {
  const raw = INITIAL_SKILLS_BY_NAME[name]
  if (!raw) return []
  // 去重并限制 3
  return [...new Set(raw)].slice(0, 3)
}

export function pickName(pool: string[], used: Set<string>, rng: () => number): string {
  const available = pool.filter((n) => !used.has(n))
  const list = available.length ? available : pool
  return list[Math.floor(rng() * list.length)]
}
