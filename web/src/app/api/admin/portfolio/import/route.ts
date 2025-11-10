import { NextResponse } from 'next/server'
import path from 'path'
import Database from 'better-sqlite3'

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null) as any
  if (!payload || !Array.isArray(payload.assets)) {
    return NextResponse.json({ ok: false, error: 'Invalid payload: expected { assets: [] }' }, { status: 400 })
  }
  const projectRoot = path.resolve(process.cwd(), '..')
  const dbPath = process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
  const db = new Database(dbPath)
  try {
    const portfolioName = (payload.portfolio as string) || process.env.PORTFOLIO_NAME || 'Default'
    const getPf = db.prepare("SELECT id FROM portfolios WHERE name = ?")
    const insPf = db.prepare("INSERT INTO portfolios(name, base_currency) VALUES(?, 'USD')")
    let pf = getPf.get(portfolioName) as { id?: number } | undefined
    if (!pf) {
      const info = insPf.run(portfolioName)
      pf = { id: info.lastInsertRowid as number }
    }

    const getAsset = db.prepare("SELECT id, name, coingecko_id, is_fiat, is_stable FROM assets WHERE symbol = ?")
    const insAsset = db.prepare("INSERT INTO assets(symbol, name, coingecko_id, is_fiat, is_stable, active) VALUES(?,?,?,?,?,1)")
    const updAsset = db.prepare("UPDATE assets SET name = COALESCE(?, name), coingecko_id = COALESCE(?, coingecko_id) WHERE id = ?")

    const getPos = db.prepare("SELECT rowid as rid FROM positions WHERE portfolio_id = ? AND asset_id = ?")
    const insPos = db.prepare("INSERT INTO positions(portfolio_id, asset_id, coins, avg_cost_ccy, avg_cost_per_unit) VALUES(?,?,?,?,?)")
    const updPos = db.prepare("UPDATE positions SET coins = ? WHERE portfolio_id = ? AND asset_id = ?")

    const tx = db.transaction((assets: any[]) => {
      for (const a of assets) {
        const symbol = String(a.symbol || '').toUpperCase()
        if (!symbol) continue
        const name = a.name || symbol
        const cg = a.coingecko_id || null
        const coins = Number(a.coins || 0)
        let asset = getAsset.get(symbol) as { id?: number } | undefined
        if (!asset) {
          const info = insAsset.run(symbol, name, cg, Number(!!a.is_fiat), Number(!!a.is_stable))
          asset = { id: info.lastInsertRowid as number }
        } else {
          updAsset.run(name, cg, asset.id)
        }
        const pos = getPos.get(pf!.id, asset!.id) as { rid?: number } | undefined
        if (!pos) {
          insPos.run(pf!.id, asset!.id, coins, (process.env.AVG_COST_CCY || 'GBP').toUpperCase(), 0.0)
        } else {
          updPos.run(coins, pf!.id, asset!.id)
        }
      }
    })
    tx(payload.assets)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  } finally {
    db.close()
  }
}
