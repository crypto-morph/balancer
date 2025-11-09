import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { promises as fs } from 'fs'
import Database from 'better-sqlite3'
import path from 'path'

// Mock fs
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}))

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn(),
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

// Mock global fetch
global.fetch = vi.fn()

describe('/api/icons', () => {
  let mockDb: any
  let mockStmt: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockStmt = {
      all: vi.fn(),
    }
    mockDb = {
      prepare: vi.fn(() => mockStmt),
      close: vi.fn(),
    }
    ;(Database as any).mockImplementation(() => mockDb)
    process.env.DB_PATH = undefined
    process.env.COINGECKO_API_KEY = undefined
    process.env.COINGECKO = undefined
  })

  it('returns cached icons when cache is fresh and has caps', async () => {
    const cachedData = {
      updatedAt: Date.now() - 1000, // 1 second ago (fresh)
      images: { bitcoin: 'https://example.com/bitcoin.png' },
      caps: { bitcoin: 1000000000 },
    }
    ;(fs.readFile as any).mockResolvedValue(JSON.stringify(cachedData))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.images).toEqual(cachedData.images)
    expect(data.caps).toEqual(cachedData.caps)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches from API when cache is stale', async () => {
    const staleCache = {
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago (stale)
      images: { bitcoin: 'old.png' },
      caps: { bitcoin: 500000000 },
    }
    // First read finds stale cache, so continues to API fetch
    ;(fs.readFile as any).mockResolvedValueOnce(JSON.stringify(staleCache))
    ;(fs.mkdir as any).mockResolvedValue(undefined)

    mockStmt.all.mockReturnValue([{ coingecko_id: 'bitcoin' }])
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'bitcoin', image: 'https://example.com/bitcoin.png', market_cap: 1000000000 },
      ],
    })
    ;(fs.writeFile as any).mockResolvedValue(undefined)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.images.bitcoin).toBe('https://example.com/bitcoin.png')
    expect(data.caps.bitcoin).toBe(1000000000)
    expect(global.fetch).toHaveBeenCalled()
    expect(fs.writeFile).toHaveBeenCalled()
  })

  it('fetches from API when cache is missing', async () => {
    ;(fs.readFile as any).mockRejectedValue(new Error('File not found'))
    ;(fs.mkdir as any).mockResolvedValue(undefined)

    mockStmt.all.mockReturnValue([{ coingecko_id: 'bitcoin' }])
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'bitcoin', image: 'https://example.com/bitcoin.png', market_cap: 1000000000 },
      ],
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.images.bitcoin).toBe('https://example.com/bitcoin.png')
    expect(global.fetch).toHaveBeenCalled()
  })

  it('uses Coingecko IDs from database positions', async () => {
    ;(fs.readFile as any).mockRejectedValue(new Error('File not found'))
    mockStmt.all.mockReturnValue([
      { coingecko_id: 'bitcoin' },
      { coingecko_id: 'ethereum' },
    ])
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'bitcoin', image: 'bitcoin.png', market_cap: 1000 },
        { id: 'ethereum', image: 'ethereum.png', market_cap: 500 },
      ],
    })

    await GET()

    expect(global.fetch).toHaveBeenCalled()
    const fetchUrl = (global.fetch as any).mock.calls[0][0]
    expect(fetchUrl).toContain('bitcoin')
    expect(fetchUrl).toContain('ethereum')
  })

  it('includes API key in request when available', async () => {
    process.env.COINGECKO_API_KEY = 'test-key-123'
    ;(fs.readFile as any).mockRejectedValue(new Error('File not found'))
    mockStmt.all.mockReturnValue([{ coingecko_id: 'bitcoin' }])
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'bitcoin', image: 'bitcoin.png' }],
    })

    await GET()

    const fetchUrl = (global.fetch as any).mock.calls[0][0]
    expect(fetchUrl).toContain('x_cg_demo_api_key=test-key-123')
  })

  it('handles API fetch failure gracefully', async () => {
    // Cache is missing, so tries to fetch from API
    ;(fs.readFile as any).mockRejectedValue(new Error('File not found'))
    ;(fs.mkdir as any).mockResolvedValue(undefined)
    mockStmt.all.mockReturnValue([{ coingecko_id: 'bitcoin' }])
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    // Should return empty images when API fails and no cache exists
    expect(data.images).toEqual({})
  })

  it('returns empty images when no IDs found in database', async () => {
    ;(fs.readFile as any).mockRejectedValue(new Error('File not found'))
    mockStmt.all.mockReturnValue([])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.images).toEqual({})
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles cache without caps property', async () => {
    const cacheWithoutCaps = {
      updatedAt: Date.now() - 1000,
      images: { bitcoin: 'bitcoin.png' },
    }
    ;(fs.readFile as any).mockResolvedValue(JSON.stringify(cacheWithoutCaps))

    mockStmt.all.mockReturnValue([{ coingecko_id: 'bitcoin' }])
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'bitcoin', image: 'bitcoin.png', market_cap: 1000 }],
    })

    const response = await GET()
    const data = await response.json()

    // Should refetch because cache doesn't have caps
    expect(global.fetch).toHaveBeenCalled()
    expect(data.caps).toBeDefined()
  })

  it('handles errors gracefully', async () => {
    ;(fs.readFile as any).mockRejectedValue(new Error('Permission denied'))
    ;(fs.mkdir as any).mockRejectedValue(new Error('Permission denied'))
    mockDb.prepare.mockImplementation(() => {
      throw new Error('Database error')
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.images).toEqual({})
  })
})

