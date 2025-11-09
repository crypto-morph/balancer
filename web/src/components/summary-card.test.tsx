import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SummaryCard } from './summary-card'

describe('SummaryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays loading state initially', () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      } as Response)
    )

    render(<SummaryCard />)
    // Component should render without crashing
    expect(screen.getByText('Portfolio')).toBeInTheDocument()
  })

  it('displays portfolio summary when data is loaded', async () => {
    const mockData = {
      total_gbp: 100000,
      cost_basis_gbp: 80000,
      net_gbp: 20000,
      delta_1d_gbp: 1000,
      delta_1m_gbp: 5000,
      pct_1d_gbp: 1.0,
      pct_1m_gbp: 5.0,
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<SummaryCard />)

    await waitFor(() => {
      expect(screen.getByText(/£20,000.00/)).toBeInTheDocument()
    })
  })

  it('displays positive delta in green', async () => {
    const mockData = {
      total_gbp: 100000,
      cost_basis_gbp: 80000,
      net_gbp: 20000,
      delta_1d_gbp: 1000,
      delta_1m_gbp: 5000,
      pct_1d_gbp: 1.0,
      pct_1m_gbp: 5.0,
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<SummaryCard />)

    await waitFor(() => {
      const delta = screen.getByText(/\+£1,000.00/)
      expect(delta).toBeInTheDocument()
      expect(delta).toHaveClass('text-emerald-600')
    })
  })

  it('displays negative delta in red', async () => {
    const mockData = {
      total_gbp: 100000,
      cost_basis_gbp: 80000,
      net_gbp: 20000,
      delta_1d_gbp: -1000,
      delta_1m_gbp: -5000,
      pct_1d_gbp: -1.0,
      pct_1m_gbp: -5.0,
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<SummaryCard />)

    await waitFor(() => {
      const delta = screen.getByText(/-£1,000.00/)
      expect(delta).toBeInTheDocument()
      expect(delta).toHaveClass('text-red-600')
    })
  })

  it('handles API errors gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('API Error')))

    render(<SummaryCard />)

    await waitFor(() => {
      // Should still render the component
      expect(screen.getByText('Portfolio')).toBeInTheDocument()
    })
  })
})

