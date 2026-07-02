import { useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react'
import { downloadBackup, restoreBackup, type RestoreResult } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useT } from '../i18n'

export function Backup() {
  const { isAdmin } = useAuth()
  const { t } = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [result, setResult] = useState<RestoreResult | null>(null)
  const [error, setError] = useState('')

  if (!isAdmin) return <Navigate to="/" replace />

  const handleRestore = async () => {
    if (!file || restoring) return
    if (!confirm(t.backup.confirmRestore)) return
    setRestoring(true)
    setResult(null)
    setError('')
    try {
      const res = await restoreBackup(file)
      setResult(res)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t.common.somethingWentWrong)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-base font-semibold text-c-text">{t.backup.title}</h1>
      </div>

      {/* Download */}
      <section
        className="rounded-lg p-4 mb-4"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-sub)' }}
      >
        <h2 className="font-medium mb-1" style={{ fontSize: '14px', color: 'var(--c-text)' }}>
          {t.backup.downloadTitle}
        </h2>
        <p className="mb-3" style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
          {t.backup.downloadDesc}
        </p>
        <button onClick={() => downloadBackup()} className="btn-primary flex items-center gap-1.5">
          <Download size={14} /> {t.backup.downloadBtn}
        </button>
      </section>

      {/* Restore */}
      <section
        className="rounded-lg p-4"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-sub)' }}
      >
        <h2 className="font-medium mb-1" style={{ fontSize: '14px', color: 'var(--c-text)' }}>
          {t.backup.restoreTitle}
        </h2>
        <p className="mb-3 flex items-center gap-1.5" style={{ fontSize: '13px', color: 'var(--c-warning)' }}>
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          {t.backup.restoreDesc}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => inputRef.current?.click()} className="btn-ghost flex items-center gap-1.5">
            <Upload size={14} /> {file ? file.name : t.backup.chooseFile}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); setError('') } }}
          />
          <button
            onClick={handleRestore}
            disabled={!file || restoring}
            className="btn-primary flex items-center gap-1.5"
            style={{ opacity: !file || restoring ? 0.5 : 1 }}
          >
            {restoring ? t.backup.restoring : t.backup.restoreBtn}
          </button>
        </div>

        {result && (
          <p className="mt-3 flex items-center gap-1.5 rounded-md px-3 py-2"
            style={{ fontSize: '13px', color: 'var(--c-success)', background: 'oklch(68% 0.145 145 / 0.10)', border: '1px solid oklch(68% 0.145 145 / 0.25)' }}>
            <CheckCircle size={13} style={{ flexShrink: 0 }} />
            {t.backup.restoredSummary(result.vlans, result.prefixes, result.addresses, result.users)}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-md px-3 py-2"
            style={{ fontSize: '13px', color: 'var(--c-danger)', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.25)' }}>
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
