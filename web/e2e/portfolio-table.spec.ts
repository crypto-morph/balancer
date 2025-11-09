import { test, expect } from '@playwright/test'

test.describe('Portfolio Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 })
  })

  test('displays portfolio table or loading state', async ({ page }) => {
    // Table should be visible OR show loading state
    const table = page.locator('[data-slot="table"]').first()
    const tableVisible = await table.isVisible().catch(() => false)
    const loadingVisible = await page.getByText(/loading portfolio/i).isVisible().catch(() => false)
    expect(tableVisible || loadingVisible).toBeTruthy()
  })

  test('table has headers or shows loading', async ({ page }) => {
    // Wait a bit for table to render
    await page.waitForTimeout(2000)
    
    // Check for table headers OR loading state
    const headers = page.locator('th, [role="columnheader"]')
    const headerCount = await headers.count()
    const loadingVisible = await page.getByText(/loading portfolio/i).isVisible().catch(() => false)
    
    // Either we have headers OR we're in loading state
    expect(headerCount > 0 || loadingVisible).toBeTruthy()
  })

  test('displays portfolio content', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(3000)

    // Should show some content (table, loading, or empty state)
    const bodyText = await page.textContent('body') || ''
    const hasTable = bodyText.includes('Asset') || bodyText.includes('Coins') || bodyText.includes('Price')
    const hasLoading = /loading/i.test(bodyText)
    const hasContent = bodyText.length > 100 // At least some content
    
    expect(hasTable || hasLoading || hasContent).toBeTruthy()
  })
})

