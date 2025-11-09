import { NextResponse } from 'next/server'
import path from 'path'
import Database from 'better-sqlite3'

// Only allow in development
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const projectRoot = path.resolve(process.cwd(), '..')
    const dbPath = process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
    const db = new Database(dbPath)
    
    try {
      // Get all table names
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as Array<{ name: string }>
      
      const result: Record<string, unknown[]> = {}
      
      // Get data from each table
      for (const table of tables) {
        try {
          const rows = db.prepare(`SELECT * FROM ${table.name} LIMIT 1000`).all()
          result[table.name] = rows
        } catch (err) {
          result[table.name] = [{ error: String(err) }]
        }
      }
      
      // Get schema info
      const schemas: Record<string, string> = {}
      for (const table of tables) {
        const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table.name) as { sql?: string } | undefined
        schemas[table.name] = schema?.sql || ''
      }
      
      return NextResponse.json({
        tables: tables.map(t => t.name),
        data: result,
        schemas,
        dbPath,
      })
    } finally {
      db.close()
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

