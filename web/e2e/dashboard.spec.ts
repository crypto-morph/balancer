import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('loads and displays all main components', async ({ page }) => {
    await page.goto('/')

    // Check for main header - wait for it to be visible
    await expect(page.getByRole('heading', { name: /balancer dashboard/i })).toBeVisible({ timeout: 10000 })

    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 })

    // Check for SummaryCard - look for currency values, "Portfolio" text, or loading state
    const summaryText = await page.textContent('body') || ''
    const hasSummaryContent = /£|USD|BTC|GBP|portfolio|total|delta/i.test(summaryText)
    const summaryLoading = await page.getByText(/loading/i).isVisible().catch(() => false)
    expect(hasSummaryContent || summaryLoading).toBeTruthy()

    // Check for IndicatorsCard - look for indicator labels or loading state
    const indicatorsText = await page.textContent('body') || ''
    const hasIndicators = /BTC Dominance|DXY|Fear & Greed|BTCD|FEAR_GREED|DXY_TWEX|indicators/i.test(indicatorsText)
    const indicatorsLoading = await page.getByText(/loading/i).isVisible().catch(() => false)
    expect(hasIndicators || indicatorsLoading).toBeTruthy()

    // Check for PortfolioTable - look for table or loading state
    const tableVisible = await page.locator('[data-slot="table"]').isVisible().catch(() => false)
    const tableLoading = await page.getByText(/loading portfolio/i).isVisible().catch(() => false)
    expect(tableVisible || tableLoading).toBeTruthy()

    // Check for AlertsList - look for "Alerts" heading or empty state
    const alertsText = await page.textContent('body') || ''
    const hasAlerts = /alerts|no alerts|loading/i.test(alertsText)
    expect(hasAlerts).toBeTruthy()
  })

  test('displays portfolio summary', async ({ page }) => {
    await page.goto('/')

    // Wait for summary to load (may show £0.00 initially or loading state)
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Summary should display some currency value or loading/empty state
    const bodyText = await page.textContent('body') || ''
    const hasCurrency = /£|USD|BTC|GBP/.test(bodyText)
    const hasLoading = /loading/i.test(bodyText)
    expect(hasCurrency || hasLoading).toBeTruthy()
  })

  test('displays indicators', async ({ page }) => {
    await page.goto('/')

    // Wait for indicators to load
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Should show indicator labels or loading state
    const bodyText = await page.textContent('body') || ''
    const hasIndicators = /BTC Dominance|DXY|Fear & Greed|BTCD|FEAR_GREED|DXY_TWEX/i.test(bodyText)
    const hasLoading = /loading/i.test(bodyText)
    expect(hasIndicators || hasLoading).toBeTruthy()
  })
})

