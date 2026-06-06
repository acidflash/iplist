import type { Status } from '../types'
import { useT } from '../i18n'

const dot: Record<Status, string> = {
  active:     'var(--c-success)',
  reserved:   'var(--c-accent)',
  deprecated: 'var(--c-text-3)',
  pending:    'var(--c-warning)',
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useT()
  const label: Record<Status, string> = {
    active:     t.status.active,
    reserved:   t.status.reserved,
    deprecated: t.status.deprecated,
    pending:    t.status.pending,
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-c-text2" style={{ fontSize: '12px' }}>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: dot[status] }}
      />
      {label[status]}
    </span>
  )
}
