import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'

// Mock db-config so routes read/write under our tempRoot
vi.mock('@/lib/db-config', () => ({
  getProjectRoot: vi.fn(() => tempRoot),
  getDbPath: vi.fn(() => path.join(tempRoot, 'balancer.db')),
  getCacheDir: vi.fn(() => path.join(tempRoot, '.cache')),
}))

let tempRoot: string

describe('/api/alerts', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'alerts-test-'))
  })

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('returns parsed alerts from JSONL file', async () => {
    const mockAlerts = [
      { at: '2024-01-01T00:00:00Z', type: 'take_profit', severity: 'info', message: 'Test alert 1' },
      { at: '2024-01-02T00:00:00Z', type: 'drift', severity: 'warning', message: 'Test alert 2' },
    ]
    const jsonlContent = mockAlerts.map(a => JSON.stringify(a)).join('\n')
    
    await writeFile(path.join(tempRoot, 'alerts.jsonl'), jsonlContent, 'utf8')

    const { GET } = await import('./route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toHaveLength(2)
    expect(data.alerts[0]).toMatchObject(mockAlerts[0])
    expect(data.alerts[1]).toMatchObject(mockAlerts[1])
  })

  it('returns last 100 alerts when more than 100 exist', async () => {
    const manyAlerts = Array.from({ length: 150 }, (_, i) => ({
      at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      type: 'test',
      severity: 'info',
      message: `Alert ${i}`,
    }))
    const jsonlContent = manyAlerts.map(a => JSON.stringify(a)).join('\n')
    await writeFile(path.join(tempRoot, 'alerts.jsonl'), jsonlContent, 'utf8')

    const { GET } = await import('./route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toHaveLength(100)
    expect(data.alerts[0].message).toBe('Alert 50') // Last 100, so starts at index 50
  })

  it('returns empty array when file does not exist', async () => {

    const { GET } = await import('./route')
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
    await writeFile(path.join(tempRoot, 'alerts.jsonl'), jsonlContent, 'utf8')

    const { GET } = await import('./route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toHaveLength(2)
  })

  it('handles empty file gracefully', async () => {
    await writeFile(path.join(tempRoot, 'alerts.jsonl'), '', 'utf8')

    const { GET } = await import('./route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toEqual([])
  })

  it('handles file read errors gracefully', async () => {
    // Simulate read error by pointing to a path we cannot read: remove temp dir before request
    await rm(tempRoot, { recursive: true, force: true })

    const { GET } = await import('./route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    // Route catches fs.readFile errors with .catch(() => ''), so returns empty array without error field
    expect(data.alerts).toEqual([])
    expect(data.error).toBeUndefined()
  })
})


