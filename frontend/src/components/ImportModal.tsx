import { useRef, useState } from 'react'
import { Upload, CheckCircle, AlertCircle, Download } from 'lucide-react'
import { Modal } from './Modal'
import type { ImportResult } from '../api/client'
import { useT } from '../i18n'

interface Props {
  what: string
  formatHint: string       // e.g. "vid, name, description, status"
  exampleFile: string      // path to example CSV in /public, e.g. "/examples/vlans.csv"
  onImport: (file: File) => Promise<ImportResult>
  onDone: () => void
  onClose: () => void
}

export function ImportModal({ what, formatHint, exampleFile, onImport, onDone, onClose }: Props) {
  const { t } = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const pickFile = (f: File) => {
    setFile(f)
    setResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    try {
      const res = await onImport(file)
      setResult(res)
      onDone()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Something went wrong'
      setResult({ imported: 0, skipped: 0, errors: [{ row: 0, error: msg }] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={t.importCSV.title(what)} onClose={onClose}>
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors py-8"
          style={{
            borderColor: dragOver ? 'var(--c-accent)' : 'var(--c-border)',
            background: dragOver ? 'oklch(62% 0.20 258 / 0.06)' : 'var(--c-base)',
          }}
        >
          <Upload size={22} style={{ color: file ? 'var(--c-accent)' : 'var(--c-text-3)' }} />
          <p style={{ fontSize: '13px', color: file ? 'var(--c-text)' : 'var(--c-text-3)' }}>
            {file ? file.name : t.importCSV.dropzone}
          </p>
          {file && (
            <p style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>
              {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
          />
        </div>

        {/* Format hint + example download */}
        <div className="flex items-center justify-between gap-4">
          <div style={{ fontSize: '12px', color: 'var(--c-text-3)' }}>
            <span style={{ fontWeight: 500 }}>{t.importCSV.format}</span>{' '}
            <code className="font-ip" style={{ fontSize: '11.5px', color: 'var(--c-text-2)' }}>{formatHint}</code>
          </div>
          <a
            href={exampleFile}
            download
            className="flex items-center gap-1 flex-shrink-0"
            style={{ fontSize: '12px', color: 'var(--c-accent)', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            <Download size={12} /> {t.importCSV.downloadExample}
          </a>
        </div>

        {/* Result */}
        {result && (
          <div
            className="rounded-lg p-3 space-y-1.5"
            style={{ background: 'var(--c-base)', border: '1px solid var(--c-border-sub)' }}
          >
            <div className="flex items-center gap-2" style={{ fontSize: '13px' }}>
              <CheckCircle size={14} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
              <span style={{ color: 'var(--c-text)' }}>{t.importCSV.resultImported(result.imported)}</span>
              {result.skipped > 0 && (
                <span style={{ color: 'var(--c-text-3)' }}>· {t.importCSV.resultSkipped(result.skipped)}</span>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-1.5" style={{ fontSize: '12px' }}>
                    <AlertCircle size={12} style={{ color: 'var(--c-danger)', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: 'var(--c-danger)' }}>{t.importCSV.rowError(e.row, e.error)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost">
            {result ? t.importCSV.done : t.common.cancel}
          </button>
          {!result && (
            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className="btn-primary flex items-center gap-1.5"
              style={{ opacity: !file || loading ? 0.6 : 1 }}
            >
              <Upload size={13} />
              {loading ? t.importCSV.importing : t.importCSV.submit}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
