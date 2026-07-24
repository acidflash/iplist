import { useT } from '../i18n'

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT()
  return (
    <div
      role="alert"
      className="rounded-md px-3 py-2 mb-4 flex items-center justify-between gap-3"
      style={{ fontSize: '13px', color: 'var(--c-danger)', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.25)' }}
    >
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline flex-shrink-0" style={{ color: 'var(--c-danger)' }}>
          {t.common.retry}
        </button>
      )}
    </div>
  )
}
