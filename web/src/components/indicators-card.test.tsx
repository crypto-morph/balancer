import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { IndicatorsCard } from './indicators-card'

describe('IndicatorsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays loading state initially', () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      } as Response)
    )

    render(<IndicatorsCard />)
    expect(screen.getByText('Indicators')).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('displays indicators when data is loaded', async () => {
    const mockData = {
      indicators: {
        BTCD: { value: 52.5, at: '2024-01-01T00:00:00Z' },
        DXY_TWEX: { value: 103.5, at: '2024-01-01T00:00:00Z' },
        FEAR_GREED: { value: 65, at: '2024-01-01T00:00:00Z' },
      },
      series: {
        BTCD: [
          { t: '2024-01-01T00:00:00Z', v: 52.0 },
          { t: '2024-01-02T00:00:00Z', v: 52.5 },
        ],
        DXY_TWEX: [
          { t: '2024-01-01T00:00:00Z', v: 103.0 },
          { t: '2024-01-02T00:00:00Z', v: 103.5 },
        ],
        FEAR_GREED: [
          { t: '2024-01-01T00:00:00Z', v: 60 },
          { t: '2024-01-02T00:00:00Z', v: 65 },
        ],
      },
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<IndicatorsCard />)

    await waitFor(() => {
      expect(screen.getByText('BTC Dominance')).toBeInTheDocument()
      expect(screen.getByText('52.50%')).toBeInTheDocument()
      expect(screen.getByText('DXY (TWEX)')).toBeInTheDocument()
      expect(screen.getByText('103.50')).toBeInTheDocument()
      expect(screen.getByText('Fear & Greed')).toBeInTheDocument()
      expect(screen.getByText('65')).toBeInTheDocument()
    })
  })

  it('displays single-point series as flat line', async () => {
    const mockData = {
      indicators: {
        BTCD: { value: 52.5, at: '2024-01-01T00:00:00Z' },
      },
      series: {
        BTCD: [{ t: '2024-01-01T00:00:00Z', v: 52.5 }],
      },
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<IndicatorsCard />)

    await waitFor(() => {
      // Should render without crashing (single point handled internally)
      expect(screen.getByText('BTC Dominance')).toBeInTheDocument()
    })
  })

  it('handles missing indicators gracefully', async () => {
    const mockData = {
      indicators: {
        BTCD: { value: 52.5, at: '2024-01-01T00:00:00Z' },
      },
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockData),
      } as Response)
    )

    render(<IndicatorsCard />)

    await waitFor(() => {
      expect(screen.getByText('BTC Dominance')).toBeInTheDocument()
      // Missing indicators should show "-" (use getAllByText since there are multiple)
      const dashes = screen.getAllByText('-')
      expect(dashes.length).toBeGreaterThan(0)
    })
  })

  it('handles API errors gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('API Error')))

    render(<IndicatorsCard />)

    await waitFor(() => {
      // Should still render the component
      expect(screen.getByText('Indicators')).toBeInTheDocument()
    })
  })
})

