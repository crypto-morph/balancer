import { NextResponse } from 'next/server'
import path from 'path'
import Database from 'better-sqlite3'

export async function GET() {
  try {
    const projectRoot = path.resolve(process.cwd(), '..')
    const dbPath = process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
    const db = new Database(dbPath)
    try {
      const asOfRow = db.prepare("SELECT at AS as_of FROM prices ORDER BY at DESC LIMIT 1").get() as { as_of?: string } | undefined
      const posRows = db.prepare(`
        SELECT a.symbol, a.name, a.coingecko_id, a.is_stable, a.is_fiat,
               p.coins, p.avg_cost_per_unit, a.id AS asset_id
        FROM positions p
        JOIN assets a ON a.id = p.asset_id
        JOIN portfolios pf ON pf.id = p.portfolio_id
        WHERE a.active = 1 AND (pf.name = COALESCE(?, pf.name))
      `).all(process.env.PORTFOLIO_NAME || null) as Array<{
        symbol: string,
        name: string,
        coingecko_id?: string,
        is_stable: number,
        is_fiat: number,
        coins: number,
        avg_cost_per_unit: number,
        asset_id: number
      }>

      const qPriceLatest = db.prepare("SELECT price FROM prices WHERE asset_id = ? AND ccy = ? ORDER BY at DESC LIMIT 1")

      let total_mv_usd = 0
      let total_mv_gbp = 0
      let total_mv_btc = 0

      const assets = posRows.map((r) => {
        const price_usd = ((qPriceLatest.get(r.asset_id, 'USD') as { price?: number } | undefined)?.price) ?? 0
        const price_gbp = ((qPriceLatest.get(r.asset_id, 'GBP') as { price?: number } | undefined)?.price) ?? 0
        const price_btc = ((qPriceLatest.get(r.asset_id, 'BTC') as { price?: number } | undefined)?.price) ?? 0
        const mv_usd = r.coins * price_usd
        const mv_gbp = r.coins * price_gbp
        const mv_btc = r.coins * price_btc
        const cb_usd = (r.avg_cost_per_unit || 0) * (r.coins || 0)
        total_mv_usd += mv_usd
        total_mv_gbp += mv_gbp
        total_mv_btc += mv_btc
        return {
          symbol: r.symbol,
          name: r.name,
          coingecko_id: r.coingecko_id,
          is_stable: !!r.is_stable,
          is_fiat: !!r.is_fiat,
          coins: r.coins,
          price_usd,
          price_gbp,
          price_btc,
          mv_usd,
          mv_gbp,
          mv_btc,
          cb_usd,
        }
      })

      return NextResponse.json({
        as_of: asOfRow?.as_of ?? null,
        assets,
        total_mv_usd,
        total_mv_gbp,
        total_mv_btc,
      })
    } finally {
      db.close()
    }
  } catch {
    return NextResponse.json({ as_of: null, assets: [], total_mv_usd: 0 }, { status: 200 })
  }
}
