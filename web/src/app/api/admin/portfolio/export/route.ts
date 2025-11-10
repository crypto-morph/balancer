import { NextResponse } from 'next/server'
import path from 'path'
import Database from 'better-sqlite3'

export async function GET() {
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

    const qPriceLatestUsd = db.prepare("SELECT price FROM prices WHERE asset_id = ? AND ccy = 'USD' ORDER BY at DESC LIMIT 1")
    const qFxLatest = db.prepare("SELECT rate FROM fx_rates WHERE base_ccy = ? AND quote_ccy = 'USD' ORDER BY at DESC LIMIT 1")

    let total_mv_usd = 0
    let total_mv_gbp = 0
    let total_mv_btc = 0

    const assets = posRows.map((r) => {
      const price_usd = ((qPriceLatestUsd.get(r.asset_id) as { price?: number } | undefined)?.price) ?? 0
      const gbp_usd = ((qFxLatest.get('GBP') as { rate?: number } | undefined)?.rate) ?? 0
      const btc_usd = ((qFxLatest.get('BTC') as { rate?: number } | undefined)?.rate) ?? 0
      const price_gbp = gbp_usd > 0 ? price_usd / gbp_usd : 0
      const price_btc = btc_usd > 0 ? price_usd / btc_usd : 0
      const mv_usd = r.coins * price_usd
      const mv_gbp = r.coins * price_gbp
      const mv_btc = r.coins * price_btc
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
        cb_usd: (r.avg_cost_per_unit || 0) * (r.coins || 0),
      }
    })

    const payload = {
      as_of: asOfRow?.as_of ?? null,
      portfolio: process.env.PORTFOLIO_NAME || 'Default',
      total_mv_usd,
      total_mv_gbp,
      total_mv_btc,
      assets,
    }
    return NextResponse.json(payload, { status: 200 })
  } catch (e) {
    return NextResponse.json({ as_of: null, assets: [] }, { status: 200 })
  } finally {
    db.close()
  }
}
