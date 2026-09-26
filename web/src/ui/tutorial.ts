export const TUTORIAL_STORAGE_KEY = 'fi45_tutorial_seen'

export const TUTORIAL_LINES = [
  '拉下 777：第一位是步数，后两位决定事件。',
  '事件要选手动选项（接受 / 拒绝 / 加码）。',
  '走到格子会打开落点（空地开店、事务所、公园、投资所等）。',
  '每回合关系会降温——用「约会·交友」或公园聊天维护，否则可能破裂。',
] as const

export function hasSeenTutorial(storage: Pick<Storage, 'getItem'> = localStorage): boolean {
  try {
    return storage.getItem(TUTORIAL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen(storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(TUTORIAL_STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}
