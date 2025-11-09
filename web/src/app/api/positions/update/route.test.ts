import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn(),
    transaction: vi.fn(),
    close: vi.fn(),
  }
  return {
    default: vi.fn(() => mockDb),
  }
})

// Mock path
vi.mock('path', () => ({
  default: {
    resolve: vi.fn(() => '/test/project'),
    join: vi.fn((...args) => args.join('/')),
  },
}))

describe('/api/positions/update', () => {
  let mockDb: any
  let mockStmts: Record<string, any>

  beforeEach(() => {
    vi.clearAllMocks()
    mockStmts = {
      portfolio: { get: vi.fn() },
      asset: { get: vi.fn() },
      position: { get: vi.fn() },
      updateCoins: { run: vi.fn() },
      updateAvg: { run: vi.fn() },
    }
    mockDb = {
      prepare: vi.fn((query: string) => {
        if (query.includes('portfolios')) return mockStmts.portfolio
        if (query.includes('assets') && query.includes('UPPER')) return mockStmts.asset
        if (query.includes('positions') && query.includes('SELECT')) return mockStmts.position
        if (query.includes('UPDATE') && query.includes('coins')) return mockStmts.updateCoins
        if (query.includes('UPDATE') && query.includes('avg_cost_per_unit')) return mockStmts.updateAvg
        return { get: vi.fn(), run: vi.fn() }
      }),
      transaction: vi.fn((fn) => fn),
      close: vi.fn(),
    }
    ;(Database as any).mockImplementation(() => mockDb)
    process.env.DB_PATH = undefined
    process.env.PORTFOLIO_NAME = undefined
  })

  it('updates coins successfully', async () => {
    mockStmts.portfolio.get.mockReturnValue({ id: 1 })
    mockStmts.asset.get.mockReturnValue({ id: 10 })
    mockStmts.position.get.mockReturnValue({ id: 100, coins: 1.5 })
    mockStmts.updateCoins.run.mockReturnValue(undefined)

    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'BTC', coins: 2.0 }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(mockStmts.updateCoins.run).toHaveBeenCalledWith(2.0, 100)
  })

  it('updates avg_cost_per_unit successfully', async () => {
    mockStmts.portfolio.get.mockReturnValue({ id: 1 })
    mockStmts.asset.get.mockReturnValue({ id: 10 })
    mockStmts.position.get.mockReturnValue({ id: 100, coins: 1.0 })
    mockStmts.updateAvg.run.mockReturnValue(undefined)

    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'BTC', avg_cost_per_unit: 50000 }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(mockStmts.updateAvg.run).toHaveBeenCalledWith(50000, 100)
  })

  it('updates cost_basis_usd by calculating avg_cost_per_unit', async () => {
    mockStmts.portfolio.get.mockReturnValue({ id: 1 })
    mockStmts.asset.get.mockReturnValue({ id: 10 })
    mockStmts.position.get.mockReturnValue({ id: 100, coins: 2.0 })
    mockStmts.updateAvg.run.mockReturnValue(undefined)

    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'BTC', coins: 2.0, cost_basis_usd: 100000 }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    // Should calculate: 100000 / 2.0 = 50000
    expect(mockStmts.updateAvg.run).toHaveBeenCalledWith(50000, 100)
  })

  it('returns error for invalid payload (missing symbol)', async () => {
    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ coins: 2.0 }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.error).toBe('invalid_payload')
  })

  it('returns error for invalid payload (no update fields)', async () => {
    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'BTC' }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.error).toBe('invalid_payload')
  })

  it('returns error when portfolio not found', async () => {
    mockStmts.portfolio.get.mockReturnValue(undefined)

    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'BTC', coins: 2.0 }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.error).toBe('portfolio_not_found')
  })

  it('returns error when asset not found', async () => {
    mockStmts.portfolio.get.mockReturnValue({ id: 1 })
    mockStmts.asset.get.mockReturnValue(undefined)

    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'INVALID', coins: 2.0 }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.error).toBe('asset_not_found')
  })

  it('returns error when position not found', async () => {
    mockStmts.portfolio.get.mockReturnValue({ id: 1 })
    mockStmts.asset.get.mockReturnValue({ id: 10 })
    mockStmts.position.get.mockReturnValue(undefined)

    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'BTC', coins: 2.0 }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.error).toBe('position_not_found')
  })

  it('returns error when cost_basis_usd provided but coins is zero', async () => {
    mockStmts.portfolio.get.mockReturnValue({ id: 1 })
    mockStmts.asset.get.mockReturnValue({ id: 10 })
    mockStmts.position.get.mockReturnValue({ id: 100, coins: 0 })

    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'BTC', coins: 0, cost_basis_usd: 100000 }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.error).toBe('invalid_coins_for_cost_basis')
  })

  it('handles uppercase symbol conversion', async () => {
    mockStmts.portfolio.get.mockReturnValue({ id: 1 })
    mockStmts.asset.get.mockReturnValue({ id: 10 })
    mockStmts.position.get.mockReturnValue({ id: 100, coins: 1.5 })
    mockStmts.updateCoins.run.mockReturnValue(undefined)

    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'btc', coins: 2.0 }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    // Should query with uppercase
    expect(mockStmts.asset.get).toHaveBeenCalledWith('BTC')
  })

  it('handles invalid JSON body gracefully', async () => {
    const req = new NextRequest('http://localhost/api/positions/update', {
      method: 'POST',
      body: 'invalid json',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.error).toBe('invalid_payload')
  })
})

