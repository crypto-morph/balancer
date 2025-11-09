import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(() => ({
      prepare: vi.fn((query: string) => {
        if (query.includes('SELECT at AS as_of')) {
          return {
            get: () => ({ as_of: '2024-01-01T00:00:00Z' }),
          }
        }
        if (query.includes('SELECT a.symbol')) {
          return {
            all: () => [
              {
                symbol: 'BTC',
                name: 'Bitcoin',
                coingecko_id: 'bitcoin',
                is_stable: 0,
                is_fiat: 0,
                coins: 1.0,
                avg_cost_per_unit: 30000.0,
                asset_id: 1,
              },
            ],
          }
        }
        if (query.includes('SELECT price FROM prices')) {
          return {
            get: (assetId: number, ccy: string) => {
              if (ccy === 'USD') return { price: 60000.0 }
              if (ccy === 'GBP') return { price: 48000.0 }
              if (ccy === 'BTC') return { price: 1.0 }
              return null
            },
          }
        }
        return { get: () => null, all: () => [] }
      }),
      close: vi.fn(),
    })),
  }
})

describe('GET /api/portfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns portfolio data with assets', async () => {
    const request = new NextRequest('http://localhost:3000/api/portfolio')
    const response = await GET()
    const data = await response.json()

    expect(data).toHaveProperty('as_of')
    expect(data).toHaveProperty('assets')
    expect(data).toHaveProperty('total_mv_usd')
    expect(data).toHaveProperty('total_mv_gbp')
    expect(data).toHaveProperty('total_mv_btc')

    if (data.assets.length > 0) {
      const asset = data.assets[0]
      expect(asset).toHaveProperty('symbol')
      expect(asset).toHaveProperty('name')
      expect(asset).toHaveProperty('coins')
      expect(asset).toHaveProperty('price_usd')
      expect(asset).toHaveProperty('price_gbp')
      expect(asset).toHaveProperty('price_btc')
      expect(asset).toHaveProperty('mv_usd')
      expect(asset).toHaveProperty('mv_gbp')
      expect(asset).toHaveProperty('mv_btc')
      expect(asset).toHaveProperty('cb_usd')
    }
  })

  it('handles database errors gracefully', async () => {
    // Mock database to throw error
    vi.doMock('better-sqlite3', () => {
      return {
        default: vi.fn(() => {
          throw new Error('Database error')
        }),
      }
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('as_of')
    expect(data).toHaveProperty('assets')
    expect(Array.isArray(data.assets)).toBe(true)
  })

  it('calculates market values correctly', async () => {
    const request = new NextRequest('http://localhost:3000/api/portfolio')
    const response = await GET()
    const data = await response.json()

    if (data.assets.length > 0) {
      const asset = data.assets[0]
      // MV should be coins * price
      expect(asset.mv_usd).toBe(asset.coins * asset.price_usd)
      expect(asset.mv_gbp).toBe(asset.coins * asset.price_gbp)
      expect(asset.mv_btc).toBe(asset.coins * asset.price_btc)
    }
  })
})

