interface Props {
  value: number
  showLabel?: boolean
  height?: number
}

function barColor(pct: number): string {
  if (pct >= 90) return 'var(--c-danger)'
  if (pct >= 75) return 'oklch(68% 0.16 55)'
  if (pct >= 55) return 'var(--c-warning)'
  return 'var(--c-success)'
}

export function UtilizationBar({ value, showLabel = true, height = 3 }: Props) {
  const pct = Math.min(100, Math.max(0, value))

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex-1 rounded-full overflow-hidden min-w-[52px]"
        style={{ height: `${height}px`, background: 'var(--c-border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: barColor(pct) }}
        />
      </div>
      {showLabel && (
        <span
          className="tabular-nums flex-shrink-0 w-8 text-right"
          style={{ fontSize: '11px', color: 'var(--c-text-3)', fontVariantNumeric: 'tabular-nums' }}
        >
          {pct.toFixed(0)}%
        </span>
      )}
    </div>
  )
}
