import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'path'
import { getProjectRoot } from '@/lib/db-config'

export async function GET() {
  try {
    const projectRoot = getProjectRoot()
    const filePath = path.join(projectRoot, 'alerts.jsonl')
    const data = await readFile(filePath, 'utf8').catch(() => '')
    if (!data) {
      return NextResponse.json({ alerts: [] }, { status: 200 })
    }
    const lines = data.split('\n').filter((l) => l.trim().length > 0)
    const last = lines.slice(-100)
    const alerts = last
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    return NextResponse.json({ alerts }, { status: 200 })
  } catch {
    return NextResponse.json({ alerts: [], error: 'failed_to_read_alerts' }, { status: 200 })
  }
}
