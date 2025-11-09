/**
 * Icons service - handles fetching and caching of Coingecko icon URLs and market caps.
 * Separated from route handler for better testability.
 */

type CacheFile = {
  updatedAt: number
  images: Record<string, string>
  caps: Record<string, number>
}

export type IconsServiceDeps = {
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  mkdir: (path: string) => Promise<void>
  fetch: (url: string, options?: RequestInit) => Promise<Response>
  getCoingeckoIds: () => Promise<string[]>
  getApiKey: () => string
  getCachePath: () => string
  now: () => number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Check if cache is fresh (less than 1 week old) and has caps data.
 */
export function isCacheFresh(cached: CacheFile | null, now: number): boolean {
  if (!cached || typeof cached.updatedAt !== 'number') return false
  const age = now - cached.updatedAt
  const hasCaps = cached.caps && Object.keys(cached.caps).length > 0
  return age < WEEK_MS && hasCaps
}

/**
 * Load cache from file system.
 */
export async function loadCache(
  cachePath: string,
  readFile: (path: string) => Promise<string>
): Promise<CacheFile | null> {
  try {
    const raw = await readFile(cachePath)
    return JSON.parse(raw) as CacheFile
  } catch {
    return null
  }
}

/**
 * Fetch icons from Coingecko API.
 */
export async function fetchIconsFromApi(
  ids: string[],
  apiKey: string,
  fetchFn: (url: string, options?: RequestInit) => Promise<Response>
): Promise<{ images: Record<string, string>; caps: Record<string, number> }> {
  if (ids.length === 0) {
    return { images: {}, caps: {} }
  }

  const params = new URLSearchParams()
  params.set('ids', ids.join(','))
  params.set('vs_currency', 'usd')
  if (apiKey) params.set('x_cg_demo_api_key', apiKey)

  const url = `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`
  const response = await fetchFn(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Coingecko API error: ${response.status}`)
  }

  const rows = (await response.json()) as Array<{
    id: string
    image?: string
    market_cap?: number
  }>

  const images: Record<string, string> = {}
  const caps: Record<string, number> = {}

  for (const row of rows) {
    if (row.id && row.image) images[row.id] = row.image
    if (row.id && typeof row.market_cap === 'number') caps[row.id] = row.market_cap
  }

  return { images, caps }
}

/**
 * Save icons to cache file.
 */
export async function saveCache(
  cachePath: string,
  images: Record<string, string>,
  caps: Record<string, number>,
  now: number,
  writeFile: (path: string, content: string) => Promise<void>
): Promise<void> {
  const payload: CacheFile = { updatedAt: now, images, caps }
  try {
    await writeFile(cachePath, JSON.stringify(payload), 'utf-8')
  } catch {
    // Silently fail cache write - not critical
  }
}

/**
 * Main service function to get icons.
 * Returns cached icons if fresh, otherwise fetches from API and updates cache.
 */
export async function getIcons(deps: IconsServiceDeps): Promise<{
  images: Record<string, string>
  caps: Record<string, number>
}> {
  const { readFile, writeFile, mkdir, fetch, getCoingeckoIds, getApiKey, getCachePath, now } = deps
  const cachePath = getCachePath()
  const currentTime = now()

  // Ensure cache directory exists
  try {
    await mkdir(cachePath.replace(/\/[^/]+$/, ''), { recursive: true })
  } catch {
    // Directory might already exist
  }

  // Try to load fresh cache
  const cached = await loadCache(cachePath, readFile)
  if (isCacheFresh(cached, currentTime)) {
    return {
      images: cached!.images || {},
      caps: cached!.caps || {},
    }
  }

  // Cache is stale or missing - fetch from API
  const ids = await getCoingeckoIds()
  if (ids.length === 0) {
    return { images: {}, caps: {} }
  }

  try {
    const apiKey = getApiKey()
    const { images, caps } = await fetchIconsFromApi(ids, apiKey, fetch)

    // Save to cache
    await saveCache(cachePath, images, caps, currentTime, writeFile)

    return { images, caps }
  } catch {
    // API failed - try to return stale cache if available
    if (cached) {
      return {
        images: cached.images || {},
        caps: cached.caps || {},
      }
    }
    // No cache available - return empty
    return { images: {}, caps: {} }
  }
}

