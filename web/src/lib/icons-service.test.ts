/**
 * Example test showing how much easier it is to test the refactored version.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getIcons, isCacheFresh, loadCache, fetchIconsFromApi, type IconsServiceDeps } from './icons-service'

describe('IconsService', () => {
  let deps: IconsServiceDeps

  beforeEach(() => {
    deps = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      fetch: vi.fn(),
      getCoingeckoIds: vi.fn(),
      getApiKey: vi.fn(),
      getCachePath: vi.fn(() => '/test/cache/icons.json'),
      now: vi.fn(() => Date.now()),
    }
  })

  it('returns fresh cache when available', async () => {
    const freshCache = {
      updatedAt: Date.now() - 1000, // 1 second ago
      images: { bitcoin: 'bitcoin.png' },
      caps: { bitcoin: 1000000 },
    }

    ;(deps.readFile as any).mockResolvedValue(JSON.stringify(freshCache))
    ;(deps.mkdir as any).mockResolvedValue(undefined)

    const result = await getIcons(deps)

    expect(result.images).toEqual(freshCache.images)
    expect(result.caps).toEqual(freshCache.caps)
    expect(deps.fetch).not.toHaveBeenCalled()
  })

  it('fetches from API when cache is stale', async () => {
    const staleCache = {
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
      images: { bitcoin: 'old.png' },
      caps: { bitcoin: 500 },
    }

    ;(deps.readFile as any).mockResolvedValue(JSON.stringify(staleCache))
    ;(deps.getCoingeckoIds as any).mockResolvedValue(['bitcoin'])
    ;(deps.getApiKey as any).mockReturnValue('test-key')
    ;(deps.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'bitcoin', image: 'new.png', market_cap: 1000 }],
    })
    ;(deps.writeFile as any).mockResolvedValue(undefined)

    const result = await getIcons(deps)

    expect(result.images.bitcoin).toBe('new.png')
    expect(result.caps.bitcoin).toBe(1000)
    expect(deps.fetch).toHaveBeenCalled()
    expect(deps.writeFile).toHaveBeenCalled()
  })

  it('falls back to stale cache when API fails', async () => {
    const staleCache = {
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      images: { bitcoin: 'stale.png' },
      caps: { bitcoin: 500 },
    }

    ;(deps.readFile as any).mockResolvedValue(JSON.stringify(staleCache))
    ;(deps.getCoingeckoIds as any).mockResolvedValue(['bitcoin'])
    ;(deps.getApiKey as any).mockReturnValue('test-key')
    ;(deps.fetch as any).mockRejectedValue(new Error('API error'))

    const result = await getIcons(deps)

    expect(result.images).toEqual(staleCache.images)
    expect(result.caps).toEqual(staleCache.caps)
  })

  it('isCacheFresh returns true for fresh cache with caps', () => {
    const cache = {
      updatedAt: Date.now() - 1000,
      images: {},
      caps: { bitcoin: 1000 },
    }
    expect(isCacheFresh(cache, Date.now())).toBe(true)
  })

  it('isCacheFresh returns false for stale cache', () => {
    const cache = {
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      images: {},
      caps: { bitcoin: 1000 },
    }
    expect(isCacheFresh(cache, Date.now())).toBe(false)
  })
})

