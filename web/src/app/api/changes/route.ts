import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import Database from 'better-sqlite3'

function pctChange(latest: number, ref: number | null | undefined): number | null {
  if (!ref || ref <= 0 || !isFinite(ref)) return null
  if (!isFinite(latest)) return null
  return ((latest - ref) / ref) * 100
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const ccy = (searchParams.get('ccy') || 'USD').toUpperCase()
    const projectRoot = path.resolve(process.cwd(), '..')
    const dbPath = process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
    const cacheDir = path.join(projectRoot, '.cache')
    const cacheFile = path.join(cacheDir, `changes-${ccy}.json`)

    // Attempt to serve from cache (10 minutes TTL)
    try {
      const stat = await fs.stat(cacheFile)
      const ageMs = Date.now() - stat.mtimeMs
      if (ageMs < 10 * 60 * 1000) {
        const cached = JSON.parse(await fs.readFile(cacheFile, 'utf-8'))
        return NextResponse.json(cached)
      }
    } catch {}
    const db = new Database(dbPath)
    try {
      // Collect latest price per asset for the requested currency
      const posRows = db.prepare(`
        SELECT a.id AS asset_id, a.symbol
        FROM positions p
        JOIN assets a ON a.id = p.asset_id
        JOIN portfolios pf ON pf.id = p.portfolio_id
        WHERE a.active = 1 AND (pf.name = COALESCE(?, pf.name))
      `).all(process.env.PORTFOLIO_NAME || null) as Array<{ asset_id: number, symbol: string }>

      const qLatestUsd = db.prepare("SELECT price, at FROM prices WHERE asset_id = ? AND ccy = 'USD' ORDER BY at DESC LIMIT 1")
      const qAtOrBeforeUsd = db.prepare("SELECT price, at FROM prices WHERE asset_id = ? AND ccy = 'USD' AND at <= ? ORDER BY at DESC LIMIT 1")
      const qFxAtOrBefore = db.prepare("SELECT rate FROM fx_rates WHERE base_ccy = ? AND quote_ccy = 'USD' AND at <= ? ORDER BY at DESC LIMIT 1")

      const nowRow = db.prepare('SELECT COALESCE(MAX(at), CURRENT_TIMESTAMP) AS now FROM prices').get() as { now?: string }
      const nowISO = nowRow?.now || new Date().toISOString()
      const now = new Date(nowISO).getTime()

      const oneHour = 60 * 60 * 1000
      const oneDay = 24 * oneHour
      const days = (n: number) => n * oneDay

      const result: Record<string, any> = {}

      for (const r of posRows) {
        const latestUsd = qLatestUsd.get(r.asset_id) as { price?: number, at?: string } | undefined
        const latestUsdPrice = latestUsd?.price ?? null
        const latestPrice = (() => {
          if (latestUsdPrice === null) return null
          if (ccy === 'USD') return latestUsdPrice
          const fx = (qFxAtOrBefore.get(ccy, latestUsd?.at || new Date().toISOString()) as { rate?: number } | undefined)?.rate ?? null
          if (!fx || fx <= 0) return null
          // base_ccy -> USD rate; price_ccy = USD / fx
          return latestUsdPrice / fx
        })()
        if (latestPrice === null) continue

        const at1h = new Date(now - oneHour).toISOString()
        const at1d = new Date(now - oneDay).toISOString()
        const at30d = new Date(now - days(30)).toISOString()
        const at60d = new Date(now - days(60)).toISOString()
        const at90d = new Date(now - days(90)).toISOString()
        const at365d = new Date(now - days(365)).toISOString()

        function convertedAtOrBefore(iso: string): number | null {
          const usd = (qAtOrBeforeUsd.get(r.asset_id, iso) as { price?: number } | undefined)?.price ?? null
          if (usd === null) return null
          if (ccy === 'USD') return usd
          const fx = (qFxAtOrBefore.get(ccy, iso) as { rate?: number } | undefined)?.rate ?? null
          if (!fx || fx <= 0) return null
          return usd / fx
        }

        const p1h = convertedAtOrBefore(at1h)
        const p1d = convertedAtOrBefore(at1d)
        const p30d = convertedAtOrBefore(at30d)
        const p60d = convertedAtOrBefore(at60d)
        const p90d = convertedAtOrBefore(at90d)
        const p365d = convertedAtOrBefore(at365d)

        const firstUsdRow = db.prepare("SELECT price, at FROM prices WHERE asset_id = ? AND ccy = 'USD' ORDER BY at ASC LIMIT 1").get(r.asset_id) as { price?: number, at?: string } | undefined
        const pMax = (() => {
          const usd = firstUsdRow?.price ?? null
          if (usd === null) return null
          if (ccy === 'USD') return usd
          const fx = (qFxAtOrBefore.get(ccy, firstUsdRow?.at || new Date(0).toISOString()) as { rate?: number } | undefined)?.rate ?? null
          if (!fx || fx <= 0) return null
          return usd / fx
        })()

        result[r.symbol] = {
          ccy,
          latest: latestPrice,
          pcts: {
            h1: pctChange(latestPrice, p1h),
            d1: pctChange(latestPrice, p1d),
            d30: pctChange(latestPrice, p30d),
            d60: pctChange(latestPrice, p60d),
            d90: pctChange(latestPrice, p90d),
            d365: pctChange(latestPrice, p365d),
            max: pctChange(latestPrice, pMax),
          }
        }
      }

      const payload = { ok: true, ccy, changes: result }
      try {
        await fs.mkdir(cacheDir, { recursive: true })
        await fs.writeFile(cacheFile, JSON.stringify(payload), 'utf-8')
      } catch {}
      return NextResponse.json(payload)
    } finally {
      db.close()
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'changes_failed' }, { status: 200 })
  }
}
