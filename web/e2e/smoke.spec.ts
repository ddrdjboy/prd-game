import { test, expect, type Page } from '@playwright/test'

async function clearClientState(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {
      /* ignore */
    }
  })
}

async function startGame(page: Page, seats = 2) {
  await clearClientState(page)
  await page.goto('/?fast=1')
  await expect(page.getByRole('heading', { name: '45岁财富自由' })).toBeVisible()
  await page.getByRole('button', { name: `${seats} 人开局` }).click()
  await expect(page.getByRole('heading', { name: /职业卡/ })).toBeVisible()
  await page.locator('.career-card').first().click()
}

async function dismissTutorialIfAny(page: Page) {
  const know = page.getByRole('button', { name: '知道了' })
  if (await know.isVisible().catch(() => false)) {
    await know.click()
  }
}

/** Resolve any blocking modal with a safe click */
async function clearBlockingModals(page: Page, maxRounds = 16) {
  for (let i = 0; i < maxRounds; i++) {
    await dismissTutorialIfAny(page)

    const modal = page.locator('.modal')
    if (!(await modal.first().isVisible().catch(() => false))) return

    const eventSkip = page.getByRole('button', { name: /空手过关/ })
    if (await eventSkip.isVisible().catch(() => false)) {
      await eventSkip.click()
      continue
    }

    const decline = page
      .locator('.event-choices button:not(:disabled)')
      .filter({ hasText: /拒绝|观望|忍住|冷处理|婉拒|不|先|维持|离开|推迟|象征|收缩|休息|改|躺平/ })
    if (await decline.first().isVisible().catch(() => false)) {
      await decline.first().click()
      continue
    }
    const anyEvent = page.locator('.event-choices button:not(:disabled)')
    if (await anyEvent.first().isVisible().catch(() => false)) {
      await anyEvent.first().click()
      continue
    }

    // Dating cancel
    const dateCancel = page.getByRole('button', { name: /算了|取消/ })
    if (await dateCancel.first().isVisible().catch(() => false)) {
      await dateCancel.first().click()
      continue
    }

    const leave = page.getByRole('button', {
      name: /走开|离开赌场|离开|下次再说|不买了|不赌了|关闭/,
    })
    if (await leave.first().isVisible().catch(() => false)) {
      await leave.first().click()
      continue
    }

    const skipPromote = page.getByRole('button', { name: '暂留打工人圈' })
    if (await skipPromote.isVisible().catch(() => false)) {
      await skipPromote.click()
      continue
    }

    if (await page.getByRole('heading', { name: /破产/ }).isVisible().catch(() => false)) {
      const btn = page.locator('.modal button').first()
      await btn.click()
      continue
    }

    const poachKeep = page.getByRole('button', { name: '挽留' })
    if (await poachKeep.isVisible().catch(() => false)) {
      await poachKeep.click()
      continue
    }

    if (await page.getByRole('heading', { name: /结婚|婚事/ }).isVisible().catch(() => false)) {
      const no = page.locator('.modal button', { hasText: /暂缓|不|拒绝/ }).first()
      if (await no.isVisible().catch(() => false)) await no.click()
      else await page.locator('.modal button').last().click()
      continue
    }

    if (await page.getByRole('heading', { name: /大额|投资确认/ }).isVisible().catch(() => false)) {
      const no = page.locator('.modal button', { hasText: /放弃|拒绝|不/ }).first()
      if (await no.isVisible().catch(() => false)) await no.click()
      else await page.locator('.modal button').last().click()
      continue
    }

    // Last resort: click any enabled button in modal
    const anyBtn = page.locator('.modal button:not(:disabled)').last()
    if (await anyBtn.isVisible().catch(() => false)) {
      await anyBtn.click()
      continue
    }

    break
  }
}

test.describe('《45岁财富自由》关键路径', () => {
  test('首页可开局并进入职业选择', async ({ page }) => {
    await clearClientState(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '45岁财富自由' })).toBeVisible()
    await page.getByRole('button', { name: '玩法说明' }).click()
    await expect(page.getByRole('heading', { name: '玩法说明' })).toBeVisible()
    await page.getByRole('button', { name: '关闭' }).click()
    await page.getByRole('button', { name: '2 人开局' }).click()
    await expect(page.getByRole('heading', { name: /职业卡/ })).toBeVisible()
    await expect(page.locator('.career-card')).toHaveCount(3)
  })

  test('选职业后进入对局，可关掉教程并看到拉霸', async ({ page }) => {
    await startGame(page, 2)
    await dismissTutorialIfAny(page)
    await expect(page.locator('.play')).toBeVisible()
    await expect(page.getByRole('button', { name: /777 拉霸/ })).toBeVisible()
    await expect(page.locator('.topbar .muted')).toContainText('岁')
  })

  test('拉霸推进会出现事件或落点弹层并可关闭', async ({ page }) => {
    await startGame(page, 2)
    await dismissTutorialIfAny(page)

    const spin = page.getByRole('button', { name: /777 拉霸/ })
    await expect(spin).toBeEnabled({ timeout: 10_000 })
    await spin.click()

    const modal = page.locator('.modal').first()
    await expect(modal).toBeVisible({ timeout: 15_000 })

    await clearBlockingModals(page)
    await expect(page.locator('.play')).toBeVisible()
    await expect(page.getByRole('button', { name: /777 拉霸|结束回合|推进 AI/ }).first()).toBeVisible()
  })

  test('TopBar 可切换打断灵敏度', async ({ page }) => {
    await startGame(page, 2)
    await dismissTutorialIfAny(page)
    const sens = page.locator('.top-actions button').filter({ hasText: /打断|少打断|标准|多打断/ }).first()
    await expect(sens).toBeVisible()
    const before = await sens.innerText()
    await sens.click()
    const after = await sens.innerText()
    expect(after).not.toEqual(before)
  })

  test('fast 模式可连打数回合不卡死在事件上', async ({ page }) => {
    await startGame(page, 2)
    await dismissTutorialIfAny(page)

    for (let turn = 0; turn < 4; turn++) {
      await clearBlockingModals(page)

      const primary = page.locator('.controls-spin .control-spin')
      const pushAi = page.getByRole('button', { name: '推进 AI' })

      if (await primary.isEnabled().catch(() => false)) {
        const label = ((await primary.textContent()) ?? '').trim()
        await primary.click()
        if (/777|拉霸/.test(label)) {
          await page.waitForTimeout(1600)
          await clearBlockingModals(page)
          if (await primary.isEnabled().catch(() => false)) {
            const after = ((await primary.textContent()) ?? '').trim()
            if (/结束/.test(after)) {
              await primary.click()
              await clearBlockingModals(page)
            }
          }
        } else {
          await clearBlockingModals(page)
        }
      } else if (await pushAi.isVisible().catch(() => false)) {
        await clearBlockingModals(page)
        if (await pushAi.isVisible().catch(() => false)) {
          await pushAi.click({ timeout: 5_000 })
        }
        await page.waitForTimeout(500)
        await clearBlockingModals(page)
      } else {
        await page.waitForTimeout(400)
      }

      await expect(page.locator('.play')).toBeVisible()
    }
  })
})
