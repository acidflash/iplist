import { X } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'oklch(5% 0.010 263 / 0.75)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[480px] rounded-xl shadow-2xl"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          boxShadow: '0 24px 64px oklch(4% 0.010 263 / 0.6)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--c-border-sub)' }}
        >
          <h2 className="text-sm font-semibold text-c-text">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-c-text3 hover:text-c-text2 hover:bg-c-raised transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
