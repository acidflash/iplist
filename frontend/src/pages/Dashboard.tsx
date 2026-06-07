import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Network, Layers, Server, ArrowRight, AlertTriangle } from 'lucide-react'
import { getStats, getPrefixes } from '../api/client'
import type { Stats, Prefix } from '../types'
import { UtilizationBar } from '../components/UtilizationBar'
import { StatusBadge } from '../components/StatusBadge'
import { useT } from '../i18n'

export function Dashboard() {
  const { t } = useT()
  const [stats, setStats] = useState<Stats | null>(null)
  const [prefixes, setPrefixes] = useState<Prefix[]>([])

  useEffect(() => {
    getStats().then(setStats).catch(console.error)
    getPrefixes().then(setPrefixes).catch(console.error)
  }, [])

  const highUtil = prefixes
    .filter(p => p.utilization >= 80)
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, 5)

  const recent = [...prefixes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  return (
    <div className="p-6 max-w-5xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-base font-semibold text-c-text">{t.dashboard.title}</h1>
      </div>

      {/* Inline stat row — no hero-metric */}
      <div
        className="flex items-center gap-6 px-4 py-3 rounded-lg mb-6 text-[14px]"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-sub)' }}
      >
        <Stat icon={Network} label={t.nav.prefixes} value={stats?.total_prefixes} to="/prefixes" />
        <Divider />
        <Stat icon={Layers} label={t.nav.vlans} value={stats?.total_vlans} to="/vlans" />
        <Divider />
        <Stat icon={Server} label={t.dashboard.ipAddresses} value={stats?.total_addresses} to="/addresses" />
        <Divider />
        <div className="flex items-center gap-2 text-c-text2" title={t.dashboard.utilizationHint}>
          <span>{t.dashboard.utilization}</span>
          <span className="font-semibold text-c-text tabular-nums">
            {stats ? `${stats.utilization.toFixed(1)}%` : '–'}
          </span>
          {stats && stats.utilization >= 80 && (
            <AlertTriangle size={12} style={{ color: 'var(--c-warning)' }} />
          )}
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* High utilization */}
        <Panel
          title={t.dashboard.highUtil}
          emptyText={t.dashboard.noHighUtil}
          isEmpty={highUtil.length === 0}
        >
          {highUtil.map(p => (
            <PrefixRow key={p.id} prefix={p} />
          ))}
          {highUtil.length > 0 && (
            <Link
              to="/prefixes"
              className="flex items-center gap-1 text-c-text3 hover:text-c-text2 transition-colors mt-3"
              style={{ fontSize: '13px' }}
            >
              {t.dashboard.viewAll} <ArrowRight size={11} />
            </Link>
          )}
        </Panel>

        {/* Recent */}
        <Panel
          title={t.dashboard.recent}
          emptyText={t.dashboard.noRecent}
          isEmpty={recent.length === 0}
        >
          {recent.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-3 py-2"
              style={{ borderBottom: '1px solid var(--c-border-sub)' }}
            >
              <code className="font-ip text-c-accent flex-shrink-0" style={{ fontSize: '13px' }}>
                {p.prefix}
              </code>
              <span className="text-c-text2 flex-1 truncate" style={{ fontSize: '13px' }}>
                {p.name || '–'}
              </span>
              <StatusBadge status={p.status} />
            </div>
          ))}
          {recent.length > 0 && (
            <Link
              to="/prefixes"
              className="flex items-center gap-1 text-c-text3 hover:text-c-text2 transition-colors mt-3"
              style={{ fontSize: '13px' }}
            >
              {t.dashboard.viewAll} <ArrowRight size={11} />
            </Link>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, to }: {
  icon: typeof Network
  label: string
  value: number | undefined
  to: string
}) {
  return (
    <Link to={to} className="flex items-center gap-2 text-c-text2 hover:text-c-text transition-colors">
      <Icon size={13} />
      <span>{label}</span>
      <span className="font-semibold text-c-text tabular-nums">{value ?? '–'}</span>
    </Link>
  )
}

function Divider() {
  return <span style={{ width: '1px', height: '14px', background: 'var(--c-border-sub)' }} />
}

function Panel({ title, emptyText, isEmpty, children }: {
  title: string
  emptyText: string
  isEmpty: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-sub)' }}
    >
      <h2 className="text-[13px] font-semibold text-c-text3 uppercase tracking-wider mb-3">
        {title}
      </h2>
      {isEmpty ? (
        <p className="text-c-text3 py-4 text-center" style={{ fontSize: '13px' }}>{emptyText}</p>
      ) : children}
    </div>
  )
}

function PrefixRow({ prefix }: { prefix: Prefix }) {
  return (
    <div
      className="py-2"
      style={{ borderBottom: '1px solid var(--c-border-sub)' }}
    >
      <div className="flex items-center gap-3 mb-1.5">
        <code className="font-ip text-c-accent flex-shrink-0" style={{ fontSize: '13px' }}>
          {prefix.prefix}
        </code>
        <span className="text-c-text2 flex-1 truncate" style={{ fontSize: '13px' }}>
          {prefix.name || '–'}
        </span>
        <span
          className="font-semibold tabular-nums"
          style={{
            fontSize: '11px',
            color: prefix.utilization >= 90 ? 'var(--c-danger)' : 'var(--c-warning)',
          }}
        >
          {prefix.utilization.toFixed(0)}%
        </span>
      </div>
      <UtilizationBar value={prefix.utilization} showLabel={false} height={2} />
    </div>
  )
}
