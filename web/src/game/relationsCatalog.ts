export const NETWORK_NAMES = [
  '阿强', '小林', '老周', '小美同事', '客户老王', '导师陈', '合伙人阿杰',
  'HR小张', '设计师阿南', '会计小刘', '产品阿飞', '运营小雪', '投资人K',
  '前台小慧', '技术大佬', '销售冠军', '媒体朋友', '学长阿哲', '邻居大叔', '社团学妹',
]

export const ROMANCE_NAMES = [
  '晓雯', '子轩', '诗涵', '浩然', '雨桐', '一诺', '思远',
  '佳怡', '明杰', '若曦', '宇轩', '清妍', '志强', '欣怡', '天佑',
]

export function pickName(pool: string[], used: Set<string>, rng: () => number): string {
  const available = pool.filter((n) => !used.has(n))
  const list = available.length ? available : pool
  return list[Math.floor(rng() * list.length)]
}
