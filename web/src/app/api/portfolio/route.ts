import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET() {
  try {
    const projectRoot = path.resolve(process.cwd(), '..')
    const filePath = path.join(projectRoot, 'portfolio.json')
    const data = await fs.readFile(filePath, 'utf8').catch(() => '')
    if (!data) {
      return NextResponse.json({ as_of: null, assets: [], total_mv_usd: 0 }, { status: 200 })
    }
    const json = JSON.parse(data)
    return NextResponse.json(json, { status: 200 })
  } catch (e) {
    return NextResponse.json({ as_of: null, assets: [], total_mv_usd: 0, error: 'failed_to_read_portfolio' }, { status: 200 })
  }
}
