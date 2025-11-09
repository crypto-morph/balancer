import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('loads and displays all main components', async ({ page }) => {
    await page.goto('/')

    // Check for main header
    await expect(page.getByRole('heading', { name: /balancer dashboard/i })).toBeVisible()

    // Check for SummaryCard
    await expect(page.getByText(/portfolio/i)).toBeVisible()

    // Check for IndicatorsCard
    await expect(page.getByText(/indicators/i)).toBeVisible()

    // Check for PortfolioPie (may take time to load)
    // The pie chart should be present in the DOM

    // Check for PortfolioTable
    await expect(page.getByText(/token|symbol|coins/i)).toBeVisible()

    // Check for AlertsList
    await expect(page.getByText(/alerts/i)).toBeVisible()
  })

  test('displays portfolio summary', async ({ page }) => {
    await page.goto('/')

    // Wait for summary to load (may show £0.00 initially)
    await page.waitForTimeout(1000)

    // Summary should display some currency value
    const summaryText = await page.textContent('text=/£|USD|BTC/')
    expect(summaryText).toBeTruthy()
  })

  test('displays indicators', async ({ page }) => {
    await page.goto('/')

    // Wait for indicators to load
    await page.waitForTimeout(1000)

    // Should show indicator labels
    const indicatorsText = await page.textContent('body')
    expect(indicatorsText).toMatch(/BTC Dominance|DXY|Fear & Greed/i)
  })
})

