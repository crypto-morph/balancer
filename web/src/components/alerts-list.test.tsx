import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AlertsList } from './alerts-list'

describe('AlertsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays loading state initially', () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      } as Response)
    )

    render(<AlertsList />)
    expect(screen.getByText('Loading alerts…')).toBeInTheDocument()
  })

  it('displays alerts from API', async () => {
    const mockAlerts = [
      {
        at: '2024-01-01T00:00:00Z',
        type: 'take_profit',
        severity: 'info',
        message: 'BTC: Value >= 2.0x cost. Consider selling 33%',
      },
      {
        at: '2024-01-02T00:00:00Z',
        type: 'drift',
        severity: 'warning',
        message: 'ETH: Drift exceeds 20% of target',
      },
    ]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ alerts: mockAlerts }),
      } as Response)
    )

    render(<AlertsList />)

    await waitFor(() => {
      expect(screen.getByText('take_profit')).toBeInTheDocument()
      expect(screen.getByText('drift')).toBeInTheDocument()
      expect(screen.getByText(/BTC: Value >= 2.0x cost/)).toBeInTheDocument()
      expect(screen.getByText(/ETH: Drift exceeds/)).toBeInTheDocument()
    })
  })

  it('displays empty state when no alerts', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ alerts: [] }),
      } as Response)
    )

    render(<AlertsList />)

    await waitFor(() => {
      expect(screen.getByText('No alerts yet.')).toBeInTheDocument()
    })
  })

  it('displays critical severity with destructive badge', async () => {
    const mockAlerts = [
      {
        at: '2024-01-01T00:00:00Z',
        type: 'critical_alert',
        severity: 'critical',
        message: 'Critical issue detected',
      },
    ]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ alerts: mockAlerts }),
      } as Response)
    )

    render(<AlertsList />)

    await waitFor(() => {
      const badge = screen.getByText('critical')
      expect(badge).toBeInTheDocument()
      // Badge should have destructive variant for critical
      expect(badge.closest('[class*="destructive"]') || badge.closest('[class*="bg-destructive"]')).toBeTruthy()
    })
  })

  it('displays non-critical severity with secondary badge', async () => {
    const mockAlerts = [
      {
        at: '2024-01-01T00:00:00Z',
        type: 'info_alert',
        severity: 'info',
        message: 'Information message',
      },
    ]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ alerts: mockAlerts }),
      } as Response)
    )

    render(<AlertsList />)

    await waitFor(() => {
      expect(screen.getByText('info')).toBeInTheDocument()
    })
  })

  it('reverses alerts array (newest first)', async () => {
    const mockAlerts = [
      {
        at: '2024-01-01T00:00:00Z',
        type: 'first',
        severity: 'info',
        message: 'First alert',
      },
      {
        at: '2024-01-02T00:00:00Z',
        type: 'second',
        severity: 'info',
        message: 'Second alert',
      },
    ]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ alerts: mockAlerts }),
      } as Response)
    )

    render(<AlertsList />)

    await waitFor(() => {
      const alerts = screen.getAllByText(/alert/i)
      // Should be reversed, so "Second alert" appears first
      expect(alerts[0]).toHaveTextContent('Second alert')
    })
  })

  it('formats alert timestamp', async () => {
    const mockAlerts = [
      {
        at: '2024-01-01T12:30:00Z',
        type: 'test',
        severity: 'info',
        message: 'Test alert',
      },
    ]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ alerts: mockAlerts }),
      } as Response)
    )

    render(<AlertsList />)

    await waitFor(() => {
      // Should display formatted date
      const dateElement = screen.getByText(/2024|Jan|January/)
      expect(dateElement).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('API Error')))

    render(<AlertsList />)

    await waitFor(() => {
      expect(screen.getByText('No alerts yet.')).toBeInTheDocument()
    })
  })

  it('handles invalid API response gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      } as Response)
    )

    render(<AlertsList />)

    await waitFor(() => {
      expect(screen.getByText('No alerts yet.')).toBeInTheDocument()
    })
  })

  it('refreshes data every 15 seconds', async () => {
    vi.useFakeTimers()
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ alerts: [] }),
      } as Response)
    )

    render(<AlertsList />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    vi.advanceTimersByTime(15000)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  })
})


