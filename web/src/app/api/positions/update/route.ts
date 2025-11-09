import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import Database from 'better-sqlite3'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      symbol?: string
      coins?: number
      avg_cost_per_unit?: number
      cost_basis_usd?: number
      portfolio_name?: string
      db_path?: string
    }
    const symbol = (body.symbol || '').toUpperCase()
    const coins = typeof body.coins === 'number' ? body.coins : undefined
    const avg = typeof body.avg_cost_per_unit === 'number' ? body.avg_cost_per_unit : undefined
    const cb_usd = typeof body.cost_basis_usd === 'number' ? body.cost_basis_usd : undefined
    if (!symbol || (coins === undefined && avg === undefined && cb_usd === undefined)) {
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
    }

    const projectRoot = path.resolve(process.cwd(), '..')
    const dbPath = body.db_path || process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
    const portfolioName = body.portfolio_name || process.env.PORTFOLIO_NAME || 'Default'

    const db = new Database(dbPath)
    try {
      const tx = db.transaction(() => {
        const pf = db.prepare('SELECT id FROM portfolios WHERE name = ?').get(portfolioName) as { id: number } | undefined
        if (!pf) throw new Error('portfolio_not_found')
        const asset = db.prepare('SELECT id FROM assets WHERE UPPER(symbol) = ?').get(symbol) as { id: number } | undefined
        if (!asset) throw new Error('asset_not_found')
        const pos = db
          .prepare('SELECT id, coins FROM positions WHERE portfolio_id = ? AND asset_id = ?')
          .get(pf.id, asset.id) as { id: number, coins: number } | undefined
        if (!pos) throw new Error('position_not_found')

        // If cost_basis_usd is provided, compute avg from cost basis and coins (prefer provided coins, else current)
        let newCoins = pos.coins
        if (coins !== undefined) {
          db.prepare('UPDATE positions SET coins = ? WHERE id = ?').run(coins, pos.id)
          newCoins = coins
        }
        if (cb_usd !== undefined) {
          if (!newCoins || newCoins <= 0) throw new Error('invalid_coins_for_cost_basis')
          const newAvg = cb_usd / newCoins
          db.prepare('UPDATE positions SET avg_cost_per_unit = ? WHERE id = ?').run(newAvg, pos.id)
        } else if (avg !== undefined) {
          db.prepare('UPDATE positions SET avg_cost_per_unit = ? WHERE id = ?').run(avg, pos.id)
        }
      })
      tx()
    } finally {
      db.close()
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json({ ok: false, error }, { status: 200 })
  }
}
