import { NextResponse } from 'next/server'
import path from 'path'
import Database from 'better-sqlite3'

export async function GET() {
  try {
    const projectRoot = path.resolve(process.cwd(), '..')
    const dbPath = process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
    const db = new Database(dbPath)
    try {
      const now = new Date()
      const t1d = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const t1m = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const posRows = db.prepare(`
        SELECT positions.coins AS coins, positions.avg_cost_per_unit AS avg_cost_per_unit, assets.id AS asset_id
        FROM positions
        JOIN assets ON assets.id = positions.asset_id
        WHERE assets.active = 1
      `).all() as { coins: number, avg_cost_per_unit: number, asset_id: number }[]

      let total_gbp = 0, total1d_gbp = 0, total1m_gbp = 0
      let cost_basis_gbp = 0

      const qLatest = db.prepare(`SELECT price FROM prices WHERE asset_id = ? AND ccy = 'GBP' ORDER BY at DESC LIMIT 1`)
      const qAtOrBefore = db.prepare(`SELECT price FROM prices WHERE asset_id = ? AND ccy = 'GBP' AND at <= ? ORDER BY at DESC LIMIT 1`)
      const qUsd = db.prepare(`SELECT price FROM prices WHERE asset_id = ? AND ccy = 'USD' ORDER BY at DESC LIMIT 1`)

      for (const row of posRows) {
        const curr = qLatest.get(row.asset_id) as { price?: number } | undefined
        const p1d = qAtOrBefore.get(row.asset_id, t1d) as { price?: number } | undefined
        const p1m = qAtOrBefore.get(row.asset_id, t1m) as { price?: number } | undefined
        if (curr && typeof curr.price === 'number') total_gbp += row.coins * curr.price
        if (p1d && typeof p1d.price === 'number') total1d_gbp += row.coins * p1d.price
        if (p1m && typeof p1m.price === 'number') total1m_gbp += row.coins * p1m.price

        // derive cost basis in GBP from USD avg*coins using per-asset FX
        const cb_usd = (row.avg_cost_per_unit || 0) * (row.coins || 0)
        if (cb_usd) {
          const p_usd_row = qUsd.get(row.asset_id) as { price?: number } | undefined
          const p_gbp_row = curr
          const p_usd = p_usd_row?.price ?? 0
          const p_gbp = p_gbp_row?.price ?? 0
          const usd_per_gbp = p_gbp > 0 ? (p_usd / p_gbp) : 0
          if (usd_per_gbp > 0) cost_basis_gbp += cb_usd / usd_per_gbp
        }
      }

      const delta1d = total_gbp && total1d_gbp ? total_gbp - total1d_gbp : 0
      const delta1m = total_gbp && total1m_gbp ? total_gbp - total1m_gbp : 0
      const pct1d = total1d_gbp ? (delta1d / total1d_gbp) * 100 : 0
      const pct1m = total1m_gbp ? (delta1m / total1m_gbp) * 100 : 0
      const net_gbp = total_gbp - cost_basis_gbp

      return NextResponse.json({
        total_gbp,
        cost_basis_gbp,
        net_gbp,
        delta_1d_gbp: delta1d,
        delta_1m_gbp: delta1m,
        pct_1d_gbp: pct1d,
        pct_1m_gbp: pct1m,
      })
    } finally {
      db.close()
    }
  } catch {
    return NextResponse.json({ total_gbp: 0, delta_1d_gbp: 0, delta_1m_gbp: 0, pct_1d_gbp: 0, pct_1m_gbp: 0 })
  }
}
