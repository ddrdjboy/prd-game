/**
 * Playwright：赌场三桌（注入存档直达大厅）
 */
import { test, expect, type Page } from '@playwright/test'

const SAVE_KEY = 'fi45_save'
const TUTORIAL_KEY = 'fi45_tutorial_seen'

function casinoSave() {
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
    position: 5,
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
    cash: 5,
    aiStyle: 'steady' as const,
    trait: null,
  }
  return {
    phase: 'playing',
    seatCount: 2,
    age: 22,
    seasonIndex: 0,
    turnPlayerIndex: 0,
    players: [human, ai],
    careerChoices: [],
    logs: [{ id: 'l0', text: 'e2e casino' }],
    pendingEvent: null,
    pendingDecision: null,
    pendingLocation: {
      playerId: 'p0',
      spaceKind: 'casino',
      spaceIndex: 5,
      track: 'worker',
      label: '赌场',
    },
    deferredLocation: null,
    pendingDate: null,
    pendingCasino: {
      playerId: 'p0',
      screen: 'lobby',
      handsPlayed: 0,
      shoe: null,
      baccarat: null,
      dice: null,
      blackjack: null,
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

async function openCasinoFromSave(page: Page) {
  const save = casinoSave()
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
  await expect(page.getByRole('heading', { name: '赌场大厅' })).toBeVisible({ timeout: 10_000 })
}

async function backToLobby(page: Page) {
  await page.getByRole('button', { name: '回大厅' }).click()
  await expect(page.getByRole('heading', { name: '赌场大厅' })).toBeVisible({ timeout: 5_000 })
}

test.describe('赌场三桌 e2e', () => {
  test('百家乐：下注并结算后可回大厅', async ({ page }) => {
    await openCasinoFromSave(page)
    await page.getByRole('button', { name: /百家乐/ }).click()
    await expect(page.getByRole('heading', { name: '百家乐' })).toBeVisible()

    await page.getByRole('button', { name: /闲/ }).filter({ hasText: '0.2' }).first().click()
    await expect(page.locator('.shop-detail-list')).toContainText(/闲：|庄：/, { timeout: 5_000 })
    await expect(page.locator('.shop-detail-list')).toContainText(/赢|输|和|退还|净得/)

    await backToLobby(page)
  })

  test('骰子：Pass 开局，point 时可再掷至结束', async ({ page }) => {
    await openCasinoFromSave(page)
    await page.getByRole('button', { name: /^骰子/ }).click()
    await expect(page.getByRole('heading', { name: /骰子/ })).toBeVisible()

    await page.getByTestId('dice-pass-0.2').click()

    for (let i = 0; i < 16; i++) {
      const roll = page.getByTestId('dice-roll')
      if (await roll.isVisible().catch(() => false)) {
        await roll.click()
        continue
      }
      break
    }

    await expect(page.locator('.shop-detail-list')).toBeVisible()
    await expect(page.locator('.shop-detail-list')).toContainText(/Pass|Point|七点|通杀|Field|赢|输/)
    await backToLobby(page)
  })

  test('21 点：下注后完成一手并离开赌场', async ({ page }) => {
    await openCasinoFromSave(page)
    await page.getByRole('button', { name: /21 点/ }).click()
    await expect(page.getByRole('heading', { name: '21 点' })).toBeVisible()

    await page.getByTestId('bj-bet-0.2').click()

    // 打完一手直到可离开
    await expect
      .poll(
        async () => {
          const phase = await page.getByTestId('bj-phase').getAttribute('data-phase')
          if (phase === 'insurance') {
            await page.getByTestId('bj-ins-no').click()
            return 'insurance'
          }
          if (phase === 'player') {
            const text = (await page.locator('.location-card').innerText()) ?? ''
            const m = text.match(/你[^\n]*→\s*(\d+)/)
            const total = m ? Number(m[1]) : 17
            if (total <= 11) await page.getByTestId('bj-hit').click()
            else await page.getByTestId('bj-stand').click()
            return 'player'
          }
          return phase
        },
        { timeout: 15_000, intervals: [100, 200, 300] },
      )
      .toMatch(/settled|betting/)

    await expect(page.getByTestId('casino-leave')).toBeEnabled({ timeout: 5_000 })
    await page.getByTestId('casino-leave').click()
    await expect(page.getByRole('heading', { name: '赌场大厅' })).toHaveCount(0)
    await expect(page.locator('.play')).toBeVisible()
  })
})
