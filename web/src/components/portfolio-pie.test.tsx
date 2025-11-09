import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PortfolioPie } from './portfolio-pie'

describe('PortfolioPie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays loading state initially', () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      } as Response)
    )

    render(<PortfolioPie />)
    expect(screen.getByText('Portfolio Breakdown')).toBeInTheDocument()
  })

  it('renders pie chart with portfolio data', async () => {
    const mockData = {
      total_mv_usd: 100000,
      total_mv_gbp: 80000,
      assets: [
        { symbol: 'BTC', name: 'Bitcoin', is_stable: false, is_fiat: false, mv_usd: 40000, mv_gbp: 32000 },
        { symbol: 'ETH', name: 'Ethereum', is_stable: false, is_fiat: false, mv_usd: 30000, mv_gbp: 24000 },
        { symbol: 'USDC', name: 'USD Coin', is_stable: true, is_fiat: false, mv_usd: 10000, mv_gbp: 8000 },
      ],
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<PortfolioPie />)

    await waitFor(() => {
      // Should filter out stablecoins and fiat
      expect(screen.getByText('BTC')).toBeInTheDocument()
      expect(screen.getByText('ETH')).toBeInTheDocument()
      expect(screen.queryByText('USDC')).not.toBeInTheDocument()
    })
  })

  it('filters out stablecoins and fiat from chart', async () => {
    const mockData = {
      total_mv_gbp: 100000,
      assets: [
        { symbol: 'BTC', is_stable: false, is_fiat: false, mv_gbp: 50000 },
        { symbol: 'USDC', is_stable: true, is_fiat: false, mv_gbp: 30000 },
        { symbol: 'GBP', is_stable: false, is_fiat: true, mv_gbp: 20000 },
      ],
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<PortfolioPie />)

    await waitFor(() => {
      expect(screen.getByText('BTC')).toBeInTheDocument()
      expect(screen.queryByText('USDC')).not.toBeInTheDocument()
      expect(screen.queryByText('GBP')).not.toBeInTheDocument()
    })
  })

  it('groups assets beyond top 7 into "Other"', async () => {
    const mockData = {
      total_mv_gbp: 100000,
      assets: Array.from({ length: 10 }, (_, i) => ({
        symbol: `ASSET${i}`,
        is_stable: false,
        is_fiat: false,
        mv_gbp: 10000,
      })),
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<PortfolioPie />)

    await waitFor(() => {
      expect(screen.getByText('Other')).toBeInTheDocument()
    })
  })

  it('handles empty portfolio gracefully', async () => {
    const mockData = {
      total_mv_gbp: 0,
      assets: [],
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<PortfolioPie />)

    await waitFor(() => {
      expect(screen.getByText('Portfolio Breakdown')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('API Error')))

    render(<PortfolioPie />)

    await waitFor(() => {
      expect(screen.getByText('Portfolio Breakdown')).toBeInTheDocument()
    })
  })

  it('refreshes data every 60 seconds', async () => {
    vi.useFakeTimers()
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ total_mv_gbp: 100000, assets: [] }),
      } as Response)
    )

    render(<PortfolioPie />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    vi.advanceTimersByTime(60000)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  })
})

