/**
 * Refactored icons route - uses dependency injection for better testability.
 * 
 * This version separates concerns:
 * - Route handler: handles HTTP request/response
 * - Service layer: business logic (icons-service.ts)
 * - Dependencies: injected for easy testing
 */

import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import Database from 'better-sqlite3'
import { getIcons, type IconsServiceDeps } from '@/lib/icons-service'

/**
 * Get Coingecko IDs from database.
 */
async function getCoingeckoIdsFromDb(): Promise<string[]> {
  const projectRoot = path.resolve(process.cwd(), '..')
  const dbPath = process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
  const db = new Database(dbPath)

  try {
    const rows = db
      .prepare(
        `
        SELECT DISTINCT a.coingecko_id
        FROM positions p
        JOIN assets a ON a.id = p.asset_id
        JOIN portfolios pf ON pf.id = p.portfolio_id
        WHERE a.coingecko_id IS NOT NULL AND a.coingecko_id <> ''
          AND (pf.name = COALESCE(?, pf.name))
      `
      )
      .all(process.env.PORTFOLIO_NAME || null) as Array<{ coingecko_id: string }>

    return Array.from(new Set(rows.map((r) => r.coingecko_id))).filter(Boolean)
  } finally {
    db.close()
  }
}

/**
 * Get API key from environment or .env file.
 */
async function getApiKeyFromEnv(): Promise<string> {
  let key = process.env.COINGECKO_API_KEY || process.env.COINGECKO || ''

  if (!key) {
    try {
      const projectRoot = path.resolve(process.cwd(), '..')
      const envPath = path.join(projectRoot, '.env')
      const envRaw = await fs.readFile(envPath, 'utf-8')
      for (const line of envRaw.split(/\r?\n/)) {
        const m = line.match(/^\s*(COINGECKO_API_KEY|COINGECKO)\s*=\s*(.+)\s*$/)
        if (m) {
          key = m[2].trim()
          break
        }
      }
    } catch {
      // .env file not found or unreadable
    }
  }

  return key
}

export async function GET() {
  try {
    const projectRoot = path.resolve(process.cwd(), '..')
    const cacheDir = path.join(projectRoot, '.cache')
    const cachePath = path.join(cacheDir, 'icons.json')

    // Create dependencies object
    const deps: IconsServiceDeps = {
      readFile: (p: string) => fs.readFile(p, 'utf-8'),
      writeFile: (p: string, content: string) => fs.writeFile(p, content, 'utf-8'),
      mkdir: (p: string) => fs.mkdir(p, { recursive: true }),
      fetch: global.fetch,
      getCoingeckoIds: getCoingeckoIdsFromDb,
      getApiKey: getApiKeyFromEnv,
      getCachePath: () => cachePath,
      now: () => Date.now(),
    }

    const { images, caps } = await getIcons(deps)

    return NextResponse.json({ images, caps })
  } catch {
    return NextResponse.json({ images: {}, caps: {} }, { status: 200 })
  }
}

