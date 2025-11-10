import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { promises as fs } from 'fs'
import path from 'path'

// Mock fs
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}))

// Mock path
vi.mock('path', () => ({
  default: {
    resolve: vi.fn(() => '/test/project'),
    join: vi.fn((...args) => args.join('/')),
  },
}))

describe('/api/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed alerts from JSONL file', async () => {
    const mockAlerts = [
      { at: '2024-01-01T00:00:00Z', type: 'take_profit', severity: 'info', message: 'Test alert 1' },
      { at: '2024-01-02T00:00:00Z', type: 'drift', severity: 'warning', message: 'Test alert 2' },
    ]
    const jsonlContent = mockAlerts.map(a => JSON.stringify(a)).join('\n')
    ;(fs.readFile as any).mockResolvedValue(jsonlContent)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toHaveLength(2)
    expect(data.alerts[0]).toMatchObject(mockAlerts[0])
    expect(data.alerts[1]).toMatchObject(mockAlerts[1])
    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('alerts.jsonl'),
      'utf8'
    )
  })

  it('returns last 100 alerts when more than 100 exist', async () => {
    const manyAlerts = Array.from({ length: 150 }, (_, i) => ({
      at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      type: 'test',
      severity: 'info',
      message: `Alert ${i}`,
    }))
    const jsonlContent = manyAlerts.map(a => JSON.stringify(a)).join('\n')
    ;(fs.readFile as any).mockResolvedValue(jsonlContent)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toHaveLength(100)
    expect(data.alerts[0].message).toBe('Alert 50') // Last 100, so starts at index 50
  })

  it('returns empty array when file does not exist', async () => {
    ;(fs.readFile as any).mockRejectedValue(new Error('File not found'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toEqual([])
  })

  it('filters out invalid JSON lines', async () => {
    const jsonlContent = [
      JSON.stringify({ at: '2024-01-01T00:00:00Z', type: 'test', severity: 'info', message: 'Valid' }),
      'invalid json line',
      JSON.stringify({ at: '2024-01-02T00:00:00Z', type: 'test', severity: 'info', message: 'Also valid' }),
    ].join('\n')
    ;(fs.readFile as any).mockResolvedValue(jsonlContent)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toHaveLength(2)
  })

  it('handles empty file gracefully', async () => {
    ;(fs.readFile as any).mockResolvedValue('')

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toEqual([])
  })

  it('handles file read errors gracefully', async () => {
    ;(fs.readFile as any).mockRejectedValue(new Error('Permission denied'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toEqual([])
    expect(data.error).toBe('failed_to_read_alerts')
  })
})


