import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Network } from 'lucide-react'
import { getPrefixes, createPrefix, updatePrefix, deletePrefix, getVLANs } from '../api/client'
import type { Prefix, VLAN, Status } from '../types'
import { Modal } from '../components/Modal'
import { UtilizationBar } from '../components/UtilizationBar'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { ExportMenu } from '../components/ExportMenu'
import { exportPrefixes } from '../utils/export'

interface FormData {
  prefix: string; name: string; description: string
  status: Status; parent_id: string; vlan_id: string
}
const emptyForm: FormData = {
  prefix: '', name: '', description: '', status: 'active', parent_id: '', vlan_id: ''
}

function buildTree(prefixes: Prefix[]): Prefix[] {
  const map = new Map<number, Prefix>(prefixes.map(p => [p.id, { ...p, children: [] }]))
  const roots: Prefix[] = []
  map.forEach(p => {
    if (p.parent_id && map.has(p.parent_id)) map.get(p.parent_id)!.children!.push(p)
    else roots.push(p)
  })
  return roots
}

function PrefixRow({
  prefix, depth, vlans, onEdit, onDelete,
}: {
  prefix: Prefix; depth: number; vlans: VLAN[]
  onEdit: (p: Prefix) => void; onDelete: (p: Prefix) => void
}) {
  const { isAdmin } = useAuth()
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = (prefix.children?.length ?? 0) > 0

  return (
    <>
      <tr
        className="group"
        style={{ borderBottom: '1px solid var(--c-border-sub)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-raised)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        <td className="px-4 py-2">
          <div className="flex items-center" style={{ paddingLeft: `${depth * 18}px` }}>
            {/* Tree guide */}
            {depth > 0 && (
              <div
                className="w-3 h-px flex-shrink-0 mr-1"
                style={{ background: 'var(--c-border)' }}
              />
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1.5 rounded transition-colors"
              style={{
                color: hasChildren ? 'var(--c-text-3)' : 'transparent',
                pointerEvents: hasChildren ? 'auto' : 'none',
              }}
            >
              {expanded
                ? <ChevronDown size={12} />
                : <ChevronRight size={12} />}
            </button>
            <Link
              to={`/prefixes/${prefix.id}`}
              className="font-ip hover:underline"
              style={{ fontSize: '13.5px', color: 'var(--c-accent)' }}
              onClick={e => e.stopPropagation()}
            >
              {prefix.prefix}
            </Link>
          </div>
        </td>
        <td className="px-4 py-2">
          <span className="text-c-text2" style={{ fontSize: '14px' }}>
            {prefix.name || <span style={{ color: 'var(--c-text-3)' }}>–</span>}
          </span>
        </td>
        <td className="px-4 py-2">
          {prefix.vlan ? (
            <span
              className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-ip"
              style={{
                fontSize: '12.5px',
                background: 'oklch(66% 0.18 295 / 0.10)',
                border: '1px solid oklch(66% 0.18 295 / 0.25)',
                color: 'var(--c-purple)',
              }}
            >
              {prefix.vlan.vid}&nbsp;·&nbsp;{prefix.vlan.name}
            </span>
          ) : <span style={{ color: 'var(--c-text-3)' }}>–</span>}
        </td>
        <td className="px-4 py-2"><StatusBadge status={prefix.status} /></td>
        <td className="px-4 py-2 w-40">
          <UtilizationBar value={prefix.utilization} />
        </td>
        <td className="px-4 py-2">
          <span className="font-ip tabular-nums text-c-text3" style={{ fontSize: '12.5px' }}>
            {prefix.used_ips}/{prefix.total_ips}
          </span>
        </td>
        <td className="px-3 py-2">
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {isAdmin && <ActionBtn onClick={() => onEdit(prefix)} accent>
              <Pencil size={13} />
            </ActionBtn>}
            {isAdmin && <ActionBtn onClick={() => onDelete(prefix)}>
              <Trash2 size={13} />
            </ActionBtn>}
          </div>
        </td>
      </tr>
      {expanded && prefix.children?.map(child => (
        <PrefixRow
          key={child.id} prefix={child} depth={depth + 1}
          vlans={vlans} onEdit={onEdit} onDelete={onDelete}
        />
      ))}
    </>
  )
}

function ActionBtn({ onClick, accent, children }: {
  onClick: () => void; accent?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded transition-colors"
      style={{ color: 'var(--c-text-3)' }}
      onMouseEnter={e => {
        e.currentTarget.style.color = accent ? 'var(--c-accent)' : 'var(--c-danger)'
        e.currentTarget.style.background = 'var(--c-raised)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--c-text-3)'
        e.currentTarget.style.background = ''
      }}
    >
      {children}
    </button>
  )
}

export function Prefixes() {
  const { isAdmin } = useAuth()
  const [prefixes, setPrefixes] = useState<Prefix[]>([])
  const [vlans, setVlans] = useState<VLAN[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Prefix | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const [p, v] = await Promise.all([getPrefixes(), getVLANs()])
    setPrefixes(p); setVlans(v)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }
  const openEdit = (p: Prefix) => {
    setEditing(p)
    setForm({
      prefix: p.prefix, name: p.name, description: p.description, status: p.status,
      parent_id: p.parent_id?.toString() ?? '', vlan_id: p.vlan_id?.toString() ?? '',
    })
    setError(''); setShowModal(true)
  }
  const handleDelete = async (p: Prefix) => {
    if (!confirm(`Ta bort ${p.prefix}?`)) return
    await deletePrefix(p.id); load()
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try {
      const payload = {
        prefix: form.prefix, name: form.name, description: form.description, status: form.status,
        parent_id: form.parent_id ? parseInt(form.parent_id) : null,
        vlan_id: form.vlan_id ? parseInt(form.vlan_id) : null,
      }
      editing ? await updatePrefix(editing.id, payload) : await createPrefix(payload)
      setShowModal(false); load()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Något gick fel')
    }
  }

  const filtered = prefixes.filter(p =>
    !search || p.prefix.includes(search) || p.name.toLowerCase().includes(search.toLowerCase())
  )
  const tree = buildTree(filtered)

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold text-c-text">Prefix</h1>
          <p className="text-c-text3 mt-0.5" style={{ fontSize: '12px' }}>
            {prefixes.length} prefix
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onExport={fmt => exportPrefixes(prefixes, fmt)} disabled={prefixes.length === 0} />
          {isAdmin && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
              <Plus size={14} /> Lägg till
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Sök prefix eller namn…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ctrl"
          style={{ width: '280px' }}
        />
      </div>

      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--c-border-sub)' }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
              {['Prefix', 'Namn', 'VLAN', 'Status', 'Utnyttjande', 'IPs', ''].map(h => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left font-medium"
                  style={{ fontSize: '12px', color: 'var(--c-text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ background: 'var(--c-base)' }}>
            {tree.length === 0 && (
              <tr>
                <td colSpan={7} className="py-14 text-center">
                  <Network size={28} style={{ color: 'var(--c-border)', margin: '0 auto 8px' }} />
                  <p className="text-c-text3" style={{ fontSize: '14px' }}>
                    {search ? 'Inga prefix matchar sökningen' : 'Lägg till ditt första prefix'}
                  </p>
                </td>
              </tr>
            )}
            {tree.map(p => (
              <PrefixRow
                key={p.id} prefix={p} depth={0}
                vlans={vlans} onEdit={openEdit} onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Redigera prefix' : 'Nytt prefix'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="lbl">CIDR *</label>
              <input required type="text" placeholder="10.0.0.0/24"
                value={form.prefix} onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
                className="ctrl mono" />
            </div>
            <div>
              <label className="lbl">Namn</label>
              <input type="text" placeholder="Kontor Stockholm"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="ctrl" />
            </div>
            <div>
              <label className="lbl">Beskrivning</label>
              <textarea rows={2}
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="ctrl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                  className="ctrl">
                  <option value="active">Active</option>
                  <option value="reserved">Reserved</option>
                  <option value="deprecated">Deprecated</option>
                </select>
              </div>
              <div>
                <label className="lbl">VLAN</label>
                <select value={form.vlan_id} onChange={e => setForm(f => ({ ...f, vlan_id: e.target.value }))}
                  className="ctrl">
                  <option value="">–</option>
                  {vlans.map(v => <option key={v.id} value={v.id}>{v.vid} · {v.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="lbl">
                Föräldra-prefix{' '}
                <span style={{ color: 'var(--c-text-3)', fontWeight: 400 }}>(auto om tomt)</span>
              </label>
              <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                className="ctrl">
                <option value="">– Auto –</option>
                {prefixes.filter(p => p.id !== editing?.id).map(p => (
                  <option key={p.id} value={p.id}>{p.prefix}{p.name ? ` · ${p.name}` : ''}</option>
                ))}
              </select>
            </div>
            {error && (
              <p
                className="rounded-md px-3 py-2"
                style={{ fontSize: '12px', color: 'var(--c-danger)', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.25)' }}
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Avbryt</button>
              <button type="submit" className="btn-primary">{editing ? 'Spara' : 'Skapa'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
