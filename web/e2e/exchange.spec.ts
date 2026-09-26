/**
 * Playwright：交易所交易盘（注入存档直达大厅）
 */
import { test, expect, type Page } from '@playwright/test'

const SAVE_KEY = 'fi45_save'
const TUTORIAL_KEY = 'fi45_tutorial_seen'

function exchangeSave() {
  const human = {
    id: 'p0',
    name: '你',
    isHuman: true,
    careerId: 'dev',
    salary: 1.4,
    fixedExpense: 0.5,
    cash: 10,
    liabilities: 0,
    track: 'investor' as const,
    position: 3,
    relations: [],
    shops: [],
    investments: [],
    actionPoints: 1,
    aiStyle: null,
    trait: null,
    poachCooldown: 0,
    maintainedRelationIds: [],
  }
  const ai = {
    ...human,
    id: 'p1',
    name: 'AI-1',
    isHuman: false,
    cash: 5,
    aiStyle: 'steady' as const,
  }
  return {
    phase: 'playing',
    seatCount: 2,
    age: 25,
    seasonIndex: 0,
    turnPlayerIndex: 0,
    players: [human, ai],
    careerChoices: [],
    logs: [{ id: 'l0', text: 'e2e exchange' }],
    pendingEvent: null,
    pendingDecision: null,
    pendingLocation: {
      playerId: 'p0',
      spaceKind: 'invest',
      spaceIndex: 3,
      track: 'investor',
      label: '投资所',
    },
    deferredLocation: null,
    pendingDate: null,
    pendingCasino: null,
    pendingVisitShop: null,
    pendingExchange: {
      playerId: 'p0',
      screen: 'lobby',
      tradeSessionsPlayed: 0,
      trade: null,
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

async function openExchange(page: Page) {
  const save = exchangeSave()
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
  await expect(page.getByTestId('exchange-title')).toBeVisible({ timeout: 10_000 })
}

test('交易所：开交易盘 → 买 → tick → 收盘 → 离开', async ({ page }) => {
  await openExchange(page)
  await page.getByTestId('exchange-open-trade').click()
  await expect(page.getByTestId('exchange-trade-title')).toBeVisible()
  await page.getByTestId('exchange-buy-bluechip-0.1').click()
  await page.getByTestId('exchange-tick').click()
  await page.getByTestId('exchange-close').click()
  await expect(page.getByTestId('exchange-title')).toBeVisible()
  await page.getByTestId('exchange-leave').click()
  await expect(page.getByTestId('exchange-title')).toHaveCount(0)
})
