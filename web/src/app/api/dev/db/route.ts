import { NextResponse } from 'next/server'
import path from 'path'
import Database from 'better-sqlite3'
import fs from 'fs'
import { getProjectRoot, getDbPath } from '@/lib/db-config'

// Only allow in development
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table')
  const query = searchParams.get('query')
  const limit = parseInt(searchParams.get('limit') || '1000')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const projectRoot = getProjectRoot()
    const dbPath = getDbPath()
    
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 404 })
    }
    
    const db = new Database(dbPath)
    
    try {
      // Get all table names
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as Array<{ name: string }>
      
      // If specific query provided, execute it
      if (query) {
        try {
          const rows = db.prepare(query).all()
          return NextResponse.json({ 
            query,
            result: rows,
            rowCount: rows.length 
          })
        } catch (err) {
          return NextResponse.json({ 
            error: String(err),
            query 
          }, { status: 400 })
        }
      }
      
      // If specific table requested, return its data
      if (table) {
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
        const rows = db.prepare(`SELECT * FROM ${table} LIMIT ? OFFSET ?`).all(limit, offset)
        const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : []
        
        // Get table info
        const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all()
        
        return NextResponse.json({
          table,
          columns,
          data: rows,
          count: countResult.count,
          limit,
          offset,
          tableInfo,
        })
      }
      
      // Get table list with row counts
      const tableList = tables.map(t => {
        try {
          const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get() as { count: number }
          return { name: t.name, rowCount: count.count }
        } catch {
          return { name: t.name, rowCount: 0 }
        }
      })
      
      // Get schema info
      const schemas: Record<string, string> = {}
      for (const table of tables) {
        const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table.name) as { sql?: string } | undefined
        schemas[table.name] = schema?.sql || ''
      }
      
      return NextResponse.json({
        tables: tableList,
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

