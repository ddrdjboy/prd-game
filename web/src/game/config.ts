export const START_AGE = 18
export const END_AGE = 45
export const SEASONS = ['春', '夏', '秋', '冬'] as const

/** 每边格子数（含两端角格），总格数 = 4 * (SPACES_PER_SIDE - 1) */
export const SPACES_PER_SIDE = 10
export const WORKER_SPACES = 4 * (SPACES_PER_SIDE - 1) // 36
export const INVESTOR_SPACES = 4 * (SPACES_PER_SIDE - 1) // 36

/** 走格动画间隔（毫秒） */
export const MOVE_STEP_MS = 280
/** 777 拉霸停轮动画总时长 */
export const SLOT_SPIN_MS = 1400
/** 连爆停轮后额外庆祝节拍（fast 模式为 0） */
export const COMBO_HOLD_MS = 420
/** 发薪/晋级横幅展示时长 */
export const MOMENT_BANNER_MS = 1200

export const ACTION_POINTS_PER_SEASON = 1
export const BIG_SPEND_RATIO = 0.5
export const MAINTENANCE_PER_RELATION = 0.02
export const MARRIAGE_EXTRA_EXPENSE = 0.1
export const LIABILITY_INTEREST_RATE = 0.02

/** 每回合结束：未锁定关系降温 */
export const RELATION_DECAY_UNLOCKED = 4
/** 每回合结束：锁定关系（结婚/合伙人）降温 */
export const RELATION_DECAY_LOCKED = 1
/** 衰减后 ≤ 此分 → broken */
export const RELATION_BREAK_AT = 10
/** 挖角后冷却的自己回合数 */
export const POACH_COOLDOWN_TURNS = 3
/** 22 岁前发薪额外红利 */
export const EARLY_AGE_MAX = 22
export const EARLY_PAY_BONUS = 0.12
/** 晋级投资人圈启动金 */
export const INVESTOR_START_BONUS = 0.8
/** 好友面板：预计再衰减一次会破裂的预警阈值 */
export const RELATION_WARN_WITHIN = 1


/** Debug: ?fast=1 makes the run end at age 21 */
export function isFastMode(): boolean {
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('fast') === '1'
  }
  return false
}

export function getEndAge(): number {
  return isFastMode() ? 21 : END_AGE
}

export function getComboHoldMs(): number {
  return isFastMode() ? 0 : COMBO_HOLD_MS
}
