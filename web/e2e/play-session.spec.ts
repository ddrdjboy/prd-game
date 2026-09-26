/**
 * Experiential play session via Playwright — play like a human, log issues.
 */
import { test, expect, type Page } from '@playwright/test'

type Note = { kind: 'bug' | 'ux' | 'ok'; text: string }

async function clearState(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {
      /* ignore */
    }
  })
}

async function dismissTutorial(page: Page) {
  const b = page.getByRole('button', { name: '知道了' })
  if (await b.isVisible().catch(() => false)) await b.click()
}

async function safeClick(locator: ReturnType<Page['locator']>, notes: Note[], label: string) {
  try {
    if (await locator.isVisible({ timeout: 800 }).catch(() => false)) {
      await locator.click({ timeout: 3000 })
      return true
    }
  } catch {
    notes.push({ kind: 'ux', text: `点击失败：${label}` })
  }
  return false
}

async function clearModals(page: Page, notes: Note[], max = 24) {
  for (let i = 0; i < max; i++) {
    await dismissTutorial(page)
    if (!(await page.locator('.modal').first().isVisible().catch(() => false))) return

    // 后渲染的弹层在上；用最后一个 modal 的标题，避免底层「空地」挡住「大额决策」
    const topModal = page.locator('.modal').last()
    const title = ((await topModal.locator('h3').first().textContent().catch(() => '')) ?? '').trim()

    const eventBtns = topModal.locator('.event-choices button')
    if ((await eventBtns.count()) > 0) {
      const enabled = topModal.locator('.event-choices button:not(:disabled)')
      const skip = topModal.getByRole('button', { name: /空手过关/ })
      if ((await enabled.count()) === 0) {
        if (await skip.isVisible().catch(() => false)) {
          notes.push({ kind: 'ok', text: `穷事件空手过关：${title}` })
          await skip.click()
          continue
        }
        notes.push({ kind: 'bug', text: `事件「${title}」全部选项禁用且无空手过关` })
        return
      }
      if (await skip.isVisible().catch(() => false)) {
        await skip.click()
        continue
      }
      const decline = enabled.filter({
        hasText: /拒绝|观望|忍住|冷处理|婉拒|不|先|维持|离开|推迟|象征|收缩|休息|改|躺平|风险太大/,
      })
      if (await decline.first().isVisible().catch(() => false)) {
        await decline.first().click()
        continue
      }
      await enabled.first().click()
      continue
    }

    if (title.includes('大额')) {
      notes.push({ kind: 'ok', text: `大额决策：${title}` })
      await topModal.getByRole('button', { name: '放弃' }).click()
      continue
    }

    if (title.includes('空地')) {
      const buy = topModal.locator('.shop-item:not(:disabled)').first()
      const leave = topModal.getByRole('button', { name: '走开' })
      if (await buy.isVisible().catch(() => false)) {
        notes.push({ kind: 'ok', text: '空地开店' })
        await buy.click({ force: true })
      } else if (await safeClick(leave, notes, '空地走开')) {
        notes.push({ kind: 'ux', text: '空地买不起/无经营者' })
      }
      continue
    }

    if (title.includes('公园')) {
      const chat = topModal.locator('.shop-item').filter({ hasText: '小坐' }).first()
      if (await chat.isVisible().catch(() => false)) {
        notes.push({ kind: 'ok', text: '公园聊天' })
        await chat.click()
      } else {
        await topModal.getByRole('button', { name: /休息回血/ }).click()
      }
      continue
    }

    if (title.includes('投资所')) {
      const buy = topModal.locator('.shop-item:not(:disabled)').filter({ hasText: /^买 / }).first()
      if (await buy.isVisible().catch(() => false)) {
        notes.push({ kind: 'ok', text: '投资所买入' })
        await buy.click()
      } else {
        await topModal.getByRole('button', { name: '离开' }).click()
      }
      continue
    }

    if (title.includes('经营区')) {
      await safeClick(topModal.getByRole('button', { name: '下次再说' }), notes, '经营区离开')
      continue
    }

    if (title.includes('事务所')) {
      await safeClick(topModal.getByRole('button', { name: '离开' }), notes, '事务所离开')
      continue
    }

    if (title.includes('赌场') || title.includes('百家乐') || title.includes('骰子') || title.includes('21')) {
      const leave = topModal.getByRole('button', { name: /离开赌场|离开|不赌了/ })
      await safeClick(leave, notes, '赌场离开')
      continue
    }

    if (title.includes('商店')) {
      await safeClick(topModal.getByRole('button', { name: '不买了' }), notes, '商店离开')
      continue
    }

    if (title.includes('约会')) {
      await safeClick(topModal.getByRole('button', { name: /算了|取消/ }), notes, '取消约会')
      continue
    }

    if (title.includes('晋级')) {
      notes.push({ kind: 'ok', text: '出现晋级提示' })
      await topModal.getByRole('button', { name: '暂留打工人圈' }).click()
      continue
    }

    if (title.includes('挖角')) {
      const body = ((await topModal.locator('p').first().textContent()) ?? '').slice(0, 48)
      notes.push({ kind: 'ok', text: `挖角：${body}` })
      await topModal.getByRole('button', { name: '挽留' }).click()
      continue
    }

    if (title.includes('破产') || title.includes('资不抵债')) {
      await safeClick(topModal.getByRole('button').first(), notes, '破产处理')
      continue
    }

    const any = topModal.locator('button:not(:disabled)').last()
    if (!(await safeClick(any, notes, `通用关闭 ${title}`))) {
      notes.push({ kind: 'bug', text: `无法关闭弹层：${title || '(无标题)'}` })
      return
    }
  }
}

test('玩家视角：fast 局连玩体验', async ({ page }) => {
  test.setTimeout(120_000)
  const notes: Note[] = []
  await clearState(page)
  await page.goto('/?fast=1')

  await expect(page.getByRole('heading', { name: '45岁财富自由' })).toBeVisible()
  await page.getByRole('button', { name: '2 人开局' }).click()
  await page.locator('.career-card').first().click()
  await dismissTutorial(page)

  for (let i = 0; i < 28; i++) {
    if (await page.locator('.settle').isVisible().catch(() => false)) {
      notes.push({ kind: 'ok', text: `到达结算 @ step ${i}` })
      break
    }
    if (await page.getByRole('button', { name: '再来一局' }).isVisible().catch(() => false)) {
      notes.push({ kind: 'ok', text: `结算·再来一局 @ step ${i}` })
      break
    }

    await clearModals(page, notes)

    const ageText = await page.locator('.topbar .muted').innerText().catch(() => '')
    const primary = page.locator('.controls-spin .control-spin')
    const pushAi = page.getByRole('button', { name: '推进 AI' })

    if (await primary.isEnabled().catch(() => false)) {
      const label = ((await primary.textContent()) ?? '').trim()
      await primary.click()
      if (/777|拉霸/.test(label)) {
        await page.waitForTimeout(1500)
        await clearModals(page, notes)
        if (await primary.isEnabled().catch(() => false)) {
          const after = ((await primary.textContent()) ?? '').trim()
          if (/结束/.test(after)) {
            await primary.click()
            await clearModals(page, notes)
          }
        }
      } else {
        await clearModals(page, notes)
      }
    } else if (await pushAi.isVisible().catch(() => false)) {
      await clearModals(page, notes)
      await safeClick(pushAi, notes, '推进 AI')
      await page.waitForTimeout(350)
      await clearModals(page, notes)
    } else {
      await page.waitForTimeout(250)
    }

    if (i === 27) notes.push({ kind: 'ux', text: `未到结算，停在 ${ageText}` })
  }

  const fin = page.locator('.finance')
  if (await fin.isVisible().catch(() => false)) {
    const t = await fin.innerText()
    if (/NaN|Infinity/.test(t)) notes.push({ kind: 'bug', text: '财报出现 NaN/Infinity' })
    if (/\bdev\b|\bsales\b|\bnurse\b/.test(t) && !t.includes('程序员') && !t.includes('销售')) {
      // career id leak — only flag if clearly english id without chinese career
    }
  }

  console.log('\n===== PLAY SESSION NOTES =====')
  for (const n of notes) console.log(`[${n.kind}] ${n.text}`)
  console.log('===== END NOTES =====\n')

  const bugs = notes.filter((n) => n.kind === 'bug')
  expect(bugs, bugs.map((b) => b.text).join('; ')).toHaveLength(0)
})
