import { NextResponse } from 'next/server'
import path from 'path'
import Database from 'better-sqlite3'
import { getProjectRoot, getDbPath } from '@/lib/db-config'

export async function GET() {
  try {
    const projectRoot = getProjectRoot()
    const dbPath = getDbPath()
    const db = new Database(dbPath)
    try {
      const nowRow = db.prepare("SELECT COALESCE(MAX(at), CURRENT_TIMESTAMP) AS now FROM prices").get() as { now?: string }
      const nowISO = nowRow?.now || new Date().toISOString()
      const now = new Date(nowISO)
      const since24hISO = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const since1yISO = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()

      const assetIds = db.prepare("SELECT id FROM assets WHERE active = 1").all() as Array<{ id: number }>

      const qPriceHourly = db.prepare("SELECT COUNT(DISTINCT strftime('%Y-%m-%d %H', at)) AS c FROM prices WHERE asset_id = ? AND ccy = 'USD' AND at >= ?")
      const qPriceDaily = db.prepare("SELECT COUNT(DISTINCT date(at)) AS c FROM prices WHERE asset_id = ? AND ccy = 'USD' AND at >= ?")

      const qFxHourly = db.prepare("SELECT COUNT(DISTINCT strftime('%Y-%m-%d %H', at)) AS c FROM fx_rates WHERE base_ccy = ? AND quote_ccy = 'USD' AND at >= ?")
      const qFxDaily = db.prepare("SELECT COUNT(DISTINCT date(at)) AS c FROM fx_rates WHERE base_ccy = ? AND quote_ccy = 'USD' AND at >= ?")

      let prices_hourly_missing = 0
      let prices_daily_missing = 0

      for (const a of assetIds) {
        const h = (qPriceHourly.get(a.id, since24hISO) as { c?: number } | undefined)?.c ?? 0
        if ((h || 0) < 20) prices_hourly_missing += 1
        const d = (qPriceDaily.get(a.id, since1yISO) as { c?: number } | undefined)?.c ?? 0
        if ((d || 0) < 300) prices_daily_missing += 1
      }

      const gbp_h = (qFxHourly.get('GBP', since24hISO) as { c?: number } | undefined)?.c ?? 0
      const gbp_d = (qFxDaily.get('GBP', since1yISO) as { c?: number } | undefined)?.c ?? 0
      const btc_h = (qFxHourly.get('BTC', since24hISO) as { c?: number } | undefined)?.c ?? 0
      const btc_d = (qFxDaily.get('BTC', since1yISO) as { c?: number } | undefined)?.c ?? 0

      const payload = {
        ok: true,
        now: nowISO,
        assets_total: assetIds.length,
        prices: { hourly_24h_missing: prices_hourly_missing, daily_1y_missing: prices_daily_missing },
        fx: {
          GBPUSD: { hourly_24h_missing: gbp_h < 20 ? 1 : 0, daily_1y_missing: gbp_d < 300 ? 1 : 0 },
          BTCUSD: { hourly_24h_missing: btc_h < 20 ? 1 : 0, daily_1y_missing: btc_d < 300 ? 1 : 0 },
        },
      }
      return NextResponse.json(payload)
    } finally {
      db.close()
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'health_failed' }, { status: 200 })
  }
}
