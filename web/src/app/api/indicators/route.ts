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
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const all = db.prepare('SELECT name, value, at FROM indicators WHERE at >= ? ORDER BY at ASC').all(since) as { name: string, value: number, at: string }[]
      const names = ["BTCD", "DXY_TWEX", "FEAR_GREED"]
      const latest: Record<string, { value: number, at: string }> = {}
      const series: Record<string, Array<{ t: string, v: number }>> = { BTCD: [], DXY_TWEX: [], FEAR_GREED: [] }
      for (const r of all) {
        if (!latest[r.name]) latest[r.name] = { value: r.value, at: r.at }
        if (names.includes(r.name)) series[r.name].push({ t: r.at, v: r.value })
      }
      return NextResponse.json({ indicators: latest, series }, { status: 200 })
    } finally {
      db.close()
    }
  } catch {
    return NextResponse.json({ indicators: {}, series: {} }, { status: 200 })
  }
}
