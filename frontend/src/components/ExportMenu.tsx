import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown } from 'lucide-react'

type Format = 'csv' | 'json' | 'yaml'

const formats: { value: Format; label: string; desc: string }[] = [
  { value: 'csv',  label: 'CSV',  desc: 'Excel / Google Sheets' },
  { value: 'json', label: 'JSON', desc: 'API / automation' },
  { value: 'yaml', label: 'YAML', desc: 'Nätverk / config' },
]

export function ExportMenu({ onExport, disabled }: {
  onExport: (format: Format) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className="btn-ghost flex items-center gap-1.5"
        style={{ opacity: disabled ? 0.4 : 1 }}
      >
        <Download size={14} />
        Exportera
        <ChevronDown size={13} style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : '', transition: 'transform 150ms' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 rounded-lg overflow-hidden z-50"
          style={{
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            boxShadow: '0 8px 24px oklch(0% 0 0 / 0.4)',
            minWidth: '180px',
          }}
        >
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--c-border-sub)' }}>
            <p style={{ fontSize: '11px', color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
              Format
            </p>
          </div>
          {formats.map(f => (
            <button
              key={f.value}
              onClick={() => { onExport(f.value); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors"
              style={{ fontSize: '13px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-raised)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <span style={{ fontWeight: 600, color: 'var(--c-text)', fontFamily: 'monospace' }}>{f.label}</span>
              <span style={{ color: 'var(--c-text-3)', fontSize: '12px' }}>{f.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
