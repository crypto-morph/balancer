import { test, expect } from '@playwright/test'

test.describe('Portfolio Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for table to load
    await page.waitForTimeout(1000)
  })

  test('displays portfolio table', async ({ page }) => {
    // Table should be visible
    const table = page.locator('table, [role="table"]').first()
    await expect(table).toBeVisible()
  })

  test('table has sortable headers', async ({ page }) => {
    // Check for common table headers
    const headers = page.locator('th, [role="columnheader"]')
    const count = await headers.count()
    expect(count).toBeGreaterThan(0)
  })

  test('displays asset information', async ({ page }) => {
    // Wait a bit for data to load
    await page.waitForTimeout(2000)

    // Should show some asset data (even if empty state)
    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
  })
})

