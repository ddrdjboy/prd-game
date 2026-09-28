import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

for (const vp of VIEWPORTS) {
  test(`霓虹皮肤无横向滚动（${vp.name}）`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.addInitScript(() => {
      try {
        localStorage.clear()
      } catch {
        /* ignore */
      }
    })
    const shot = (name: string) =>
      page.screenshot({ path: `test-results/visual/${vp.name}-${name}.png` })

    await page.goto('/?fast=1')
    await expect(page.getByRole('heading', { name: '45岁财富自由' })).toBeVisible()
    await expectNoHorizontalScroll(page)
    await shot('home')

    await page.getByRole('button', { name: '2 人开局' }).click()
    await expect(page.locator('.career-card')).toHaveCount(3)
    await expectNoHorizontalScroll(page)
    await shot('career')

    await page.locator('.career-card').first().click()
    const know = page.getByRole('button', { name: '知道了' })
    if (await know.isVisible().catch(() => false)) await know.click()
    await expect(page.locator('.play')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await shot('play')

    const spin = page.getByRole('button', { name: /777 拉霸/ })
    await expect(spin).toBeEnabled({ timeout: 10_000 })
    await spin.click()
    await expect(page.locator('.modal').first()).toBeVisible({ timeout: 15_000 })
    await expectNoHorizontalScroll(page)
    await shot('modal')
  })
}
