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

export const ACTION_POINTS_PER_SEASON = 1
export const BIG_SPEND_RATIO = 0.5
export const MAINTENANCE_PER_RELATION = 0.02
export const MARRIAGE_EXTRA_EXPENSE = 0.1
export const LIABILITY_INTEREST_RATE = 0.02

/** Debug: ?fast=1 makes the run end at age 21 */
export function getEndAge(): number {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('fast') === '1') return 21
  }
  return END_AGE
}
