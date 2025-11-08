import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import Database from 'better-sqlite3'

type CacheFile = { updatedAt: number, images: Record<string, string>, caps: Record<string, number> }
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export async function GET() {
  try {
    const projectRoot = path.resolve(process.cwd(), '..')
    const cacheDir = path.join(projectRoot, '.cache')
    const cachePath = path.join(cacheDir, 'icons.json')

    // ensure cache dir exists
    try { await fs.mkdir(cacheDir, { recursive: true }) } catch {}

    // load cache if fresh (but only if it contains caps too)
    try {
      const cachedRaw = await fs.readFile(cachePath, 'utf-8')
      const cached: CacheFile = JSON.parse(cachedRaw)
      const fresh = cached && typeof cached.updatedAt === 'number' && Date.now() - cached.updatedAt < WEEK_MS
      const hasCaps = cached && cached.caps && Object.keys(cached.caps).length > 0
      if (fresh && hasCaps) {
        return NextResponse.json({ images: cached.images || {}, caps: cached.caps || {} })
      }
      // else fall through to refetch below
    } catch {}

    // compute ids from DB active positions
    const dbPath = process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
    const db = new Database(dbPath)
    let ids: string[] = []
    try {
      const rows = db.prepare(`
        SELECT DISTINCT a.coingecko_id
        FROM positions p
        JOIN assets a ON a.id = p.asset_id
        JOIN portfolios pf ON pf.id = p.portfolio_id
        WHERE a.coingecko_id IS NOT NULL AND a.coingecko_id <> ''
          AND (pf.name = COALESCE(?, pf.name))
      `).all(process.env.PORTFOLIO_NAME || null) as Array<{ coingecko_id: string }>
      ids = Array.from(new Set(rows.map(r => r.coingecko_id))).filter(Boolean)
    } finally {
      db.close()
    }
    if (ids.length === 0) {
      return NextResponse.json({ images: {} })
    }

    // resolve API key from env or repo .env fallback
    let key = process.env.COINGECKO_API_KEY || process.env.COINGECKO || ''
    if (!key) {
      try {
        const envPath = path.join(projectRoot, '.env')
        const envRaw = await fs.readFile(envPath, 'utf-8')
        for (const line of envRaw.split(/\r?\n/)) {
          const m = line.match(/^\s*(COINGECKO_API_KEY|COINGECKO)\s*=\s*(.+)\s*$/)
          if (m) { key = m[2].trim(); break }
        }
      } catch {}
    }

    // fetch once from Coingecko
    const params = new URLSearchParams()
    params.set('ids', ids.join(','))
    params.set('vs_currency', 'usd')
    if (key) params.set('x_cg_demo_api_key', key)
    const url = `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) {
      // if fetch fails, try to serve stale cache if present
      try {
        const cachedRaw = await fs.readFile(cachePath, 'utf-8')
        const cached: CacheFile = JSON.parse(cachedRaw)
        return NextResponse.json({ images: cached.images || {}, caps: cached.caps || {} })
      } catch {}
      return NextResponse.json({ images: {} }, { status: 200 })
    }
    const rows = await r.json() as Array<{ id: string, image?: string, market_cap?: number }>
    const images: Record<string, string> = {}
    const caps: Record<string, number> = {}
    for (const row of rows) {
      if (row.id && row.image) images[row.id] = row.image
      if (row.id && typeof row.market_cap === 'number') caps[row.id] = row.market_cap
    }

    // write cache
    const payload: CacheFile = { updatedAt: Date.now(), images, caps }
    try { await fs.writeFile(cachePath, JSON.stringify(payload), 'utf-8') } catch {}

    return NextResponse.json({ images, caps })
  } catch {
    return NextResponse.json({ images: {} }, { status: 200 })
  }
}
