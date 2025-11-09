import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

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

describe('/api/indicators', () => {
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
  })

  it('returns latest indicators and 30-day series', async () => {
    const mockData = [
      { name: 'BTCD', value: 45.5, at: '2024-01-01T00:00:00Z' },
      { name: 'BTCD', value: 46.0, at: '2024-01-02T00:00:00Z' },
      { name: 'DXY_TWEX', value: 120.5, at: '2024-01-01T00:00:00Z' },
      { name: 'FEAR_GREED', value: 60, at: '2024-01-01T00:00:00Z' },
    ]
    mockStmt.all.mockReturnValue(mockData)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.indicators).toBeDefined()
    expect(data.series).toBeDefined()
    expect(data.series.BTCD).toHaveLength(2)
    expect(data.series.DXY_TWEX).toHaveLength(1)
    expect(data.series.FEAR_GREED).toHaveLength(1)
    // The implementation takes the first occurrence as latest, so it's the first one
    expect(data.indicators.BTCD).toEqual({ value: 45.5, at: '2024-01-01T00:00:00Z' })
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('SELECT name, value, at FROM indicators')
    )
    expect(mockDb.close).toHaveBeenCalled()
  })

  it('returns empty data on database error', async () => {
    mockDb.prepare.mockImplementation(() => {
      throw new Error('Database error')
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.indicators).toEqual({})
    expect(data.series).toEqual({})
  })

  it('filters to last 30 days', async () => {
    mockStmt.all.mockReturnValue([])

    await GET()

    const callArgs = mockStmt.all.mock.calls[0]
    expect(callArgs).toBeDefined()
    const sinceDate = new Date(callArgs[0])
    const now = new Date()
    const daysDiff = (now.getTime() - sinceDate.getTime()) / (1000 * 60 * 60 * 24)
    expect(daysDiff).toBeLessThan(31)
    expect(daysDiff).toBeGreaterThan(29)
  })

  it('includes all three indicator names in series', async () => {
    mockStmt.all.mockReturnValue([])

    const response = await GET()
    const data = await response.json()

    expect(data.series).toHaveProperty('BTCD')
    expect(data.series).toHaveProperty('DXY_TWEX')
    expect(data.series).toHaveProperty('FEAR_GREED')
  })
})

