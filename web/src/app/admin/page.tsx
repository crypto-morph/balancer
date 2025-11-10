"use client"

import { useState } from 'react'

export default function AdminPage() {
  const [exportJson, setExportJson] = useState<any | null>(null)
  const [resolveJson, setResolveJson] = useState<any | null>(null)
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function doExport() {
    setStatus('Exporting...')
    const res = await fetch('/api/admin/portfolio/export', { cache: 'no-store' })
    const j = await res.json()
    setExportJson(j)
    setStatus(null)
  }

  async function doResolve() {
    setStatus('Resolving...')
    const res = await fetch('/api/admin/portfolio/resolve', { cache: 'no-store' })
    const j = await res.json()
    setResolveJson(j)
    setStatus(null)
  }

  async function doImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fileInput = form.querySelector('input[type=file]') as HTMLInputElement
    if (!fileInput?.files?.[0]) return
    setImporting(true)
    setStatus('Importing...')
    const text = await fileInput.files[0].text()
    const res = await fetch('/api/admin/portfolio/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: text,
    })
    const j = await res.json()
    setStatus(j.ok ? 'Import OK' : `Import failed: ${j.error}`)
    setImporting(false)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="flex gap-3">
        <button className="px-3 py-2 border rounded" onClick={doExport}>Export portfolio.json</button>
        <form onSubmit={doImport} className="flex items-center gap-2">
          <input type="file" accept="application/json" />
          <button className="px-3 py-2 border rounded" disabled={importing}>
            {importing ? 'Importing...' : 'Import portfolio.json'}
          </button>
        </form>
        <button className="px-3 py-2 border rounded" onClick={doResolve}>Resolve CG IDs</button>
      </div>
      {status && <div className="text-sm text-gray-600">{status}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-medium mb-2">Export Output</h2>
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96">{exportJson ? JSON.stringify(exportJson, null, 2) : 'No export yet.'}</pre>
        </div>
        <div>
          <h2 className="font-medium mb-2">Resolver Proposals</h2>
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96">{resolveJson ? JSON.stringify(resolveJson, null, 2) : 'No proposals yet.'}</pre>
        </div>
      </div>
    </div>
  )
}
