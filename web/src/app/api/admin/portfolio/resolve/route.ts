import { NextResponse } from 'next/server'
import { spawnSync } from 'node:child_process'
import path from 'path'

export async function GET() {
  const projectRoot = path.resolve(process.cwd(), '..')
  // Delegate to balancerctl resolve-cg for consistency and reuse
  const bin = path.join(projectRoot, 'balancerctl')
  const proc = spawnSync(bin, ['resolve-cg'], { cwd: projectRoot })
  const out = proc.stdout?.toString('utf8') || ''
  try {
    const json = JSON.parse(out)
    return NextResponse.json(json, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to resolve or parse output' }, { status: 500 })
  }
}
