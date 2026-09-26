/**
 * Playwright：探店会话（注入存档直达付钱阶段）
 */
import { test, expect, type Page } from '@playwright/test'

const SAVE_KEY = 'fi45_save'
const TUTORIAL_KEY = 'fi45_tutorial_seen'

function visitSave() {
  const manager = {
    id: 'mgr1',
    kind: 'network' as const,
    name: '阿伟',
    score: 42,
    status: 'stable' as const,
    locked: false,
    skills: ['sales'],
    training: null,
  }
  const staff = {
    id: 'st1',
    kind: 'network' as const,
    name: '小美',
    score: 50,
    status: 'stable' as const,
    locked: false,
    skills: ['service'],
    training: null,
  }
  const human = {
    id: 'p0',
    name: '你',
    isHuman: true,
    careerId: 'dev',
    salary: 1.4,
    fixedExpense: 0.5,
    cash: 10,
    liabilities: 0,
    track: 'worker' as const,
    position: 3,
    relations: [],
    shops: [],
    investments: [],
    actionPoints: 1,
    aiStyle: null,
    trait: 'investDiscount' as const,
    poachCooldown: 0,
    maintainedRelationIds: [],
  }
  const ai = {
    ...human,
    id: 'p1',
    name: 'AI-1',
    isHuman: false,
    cash: 3,
    aiStyle: 'steady' as const,
    trait: null,
    relations: [manager, staff],
    shops: [
      {
        id: 'lot-worker-3-1',
        name: '市区空地店',
        level: 1,
        typeId: 'vacantLot',
        baseRevenue: 0.22,
        operatingCost: 0.1,
        baseCashflow: 0.22,
        lastFactor: 1,
        staffIds: ['mgr1', 'st1'],
        managerId: 'mgr1',
        skillTags: ['retail', 'service', 'sales'],
        requiredSkills: [],
        boardTrack: 'worker',
        boardIndex: 3,
      },
    ],
  }
  return {
    phase: 'playing',
    seatCount: 2,
    age: 22,
    seasonIndex: 0,
    turnPlayerIndex: 0,
    players: [human, ai],
    careerChoices: [],
    logs: [{ id: 'l0', text: 'e2e visit' }],
    pendingEvent: null,
    pendingDecision: null,
    pendingLocation: {
      playerId: 'p0',
      spaceKind: 'vacant',
      spaceIndex: 3,
      track: 'worker',
      label: '空地',
    },
    deferredLocation: null,
    pendingDate: null,
    pendingCasino: null,
    pendingVisitShop: {
      playerId: 'p0',
      ownerId: 'p1',
      shopId: 'lot-worker-3-1',
      step: 'pay',
      entryFee: 0.09,
      tipFee: 0.12,
      paid: false,
      staffId: null,
      rapport: 0,
      lastReels: null,
      lastPoachOk: null,
    },
    slotSpin: null,
    moveAnimation: null,
    autoEnabled: false,
    autoSensitivity: 'standard',
    seed: 42,
    rngState: 42,
    endAge: 45,
    lastDice: null,
    lastReels: null,
    turnRolled: true,
  }
}

async function openVisitFromSave(page: Page) {
  const save = visitSave()
  await page.addInitScript(
    ({ saveKey, tutorialKey, payload }) => {
      localStorage.setItem(saveKey, JSON.stringify(payload))
      localStorage.setItem(tutorialKey, '1')
    },
    { saveKey: SAVE_KEY, tutorialKey: TUTORIAL_KEY, payload: save },
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '45岁财富自由' })).toBeVisible()
  await page.getByRole('button', { name: '继续上次' }).click()
  await expect(page.getByTestId('visit-title')).toBeVisible({ timeout: 10_000 })
}

test('探店：付钱 → 店长 → 选店员 → 跳过送礼 → 离开', async ({ page }) => {
  await openVisitFromSave(page)
  await page.getByTestId('visit-pay').click()
  await expect(page.getByTestId('visit-talk')).toBeVisible()
  await page.getByTestId('visit-talk').click()
  await expect(page.getByTestId('visit-staff-st1')).toBeVisible()
  await page.getByTestId('visit-staff-st1').click()
  await expect(page.getByTestId('visit-skip-gift')).toBeVisible()
  await page.getByTestId('visit-skip-gift').click()
  await expect(page.getByTestId('visit-leave')).toBeVisible()
  await page.getByTestId('visit-leave').click()
  await expect(page.getByTestId('visit-title')).toHaveCount(0)
})
