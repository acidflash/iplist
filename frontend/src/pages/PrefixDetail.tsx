import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Network, ChevronRight, Server } from 'lucide-react'
import { getPrefix, createAddress, updateAddress, deleteAddress } from '../api/client'
import type { Prefix, IPAddress, Status } from '../types'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { UtilizationBar } from '../components/UtilizationBar'
import { useAuth } from '../context/AuthContext'

interface AddrForm {
  address: string; hostname: string; dns_name: string
  description: string; status: Status
}
const emptyForm: AddrForm = { address: '', hostname: '', dns_name: '', description: '', status: 'active' }

export function PrefixDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [prefix, setPrefix] = useState<Prefix | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<IPAddress | null>(null)
  const [form, setForm] = useState<AddrForm>(emptyForm)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const p = await getPrefix(parseInt(id))
    setPrefix(p)
  }, [id])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }
  const openEdit = (a: IPAddress) => {
    setEditing(a)
    setForm({ address: a.address, hostname: a.hostname, dns_name: a.dns_name, description: a.description, status: a.status })
    setError(''); setShowModal(true)
  }
  const handleDelete = async (a: IPAddress) => {
    if (!confirm(`Ta bort ${a.address}?`)) return
    await deleteAddress(a.id); load()
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try {
      const payload = { ...form, prefix_id: prefix!.id }
      editing ? await updateAddress(editing.id, payload) : await createAddress(payload)
      setShowModal(false); load()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Något gick fel')
    }
  }

  if (!prefix) return (
    <div className="p-6" style={{ color: 'var(--c-text-3)', fontSize: '14px' }}>Laddar…</div>
  )

  const addresses = prefix.addresses ?? []
  const children = prefix.children ?? []

  return (
    <div className="p-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5" style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
        <button
          onClick={() => navigate('/prefixes')}
          className="flex items-center gap-1.5 hover:text-c-text transition-colors"
          style={{ color: 'var(--c-text-3)' }}
        >
          <ArrowLeft size={14} /> Prefix
        </button>
        <ChevronRight size={12} />
        <code className="font-ip" style={{ color: 'var(--c-accent)', fontSize: '13px' }}>{prefix.prefix}</code>
      </div>

      {/* Header */}
      <div
        className="rounded-lg p-4 mb-5 flex items-start justify-between gap-4"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-sub)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <code className="font-ip font-semibold" style={{ fontSize: '18px', color: 'var(--c-accent)' }}>
              {prefix.prefix}
            </code>
            {prefix.name && (
              <span style={{ fontSize: '15px', color: 'var(--c-text-2)' }}>{prefix.name}</span>
            )}
            <StatusBadge status={prefix.status} />
          </div>
          {prefix.description && (
            <p style={{ fontSize: '14px', color: 'var(--c-text-2)' }}>{prefix.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 flex-wrap" style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
            {prefix.vlan && (
              <span
                className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-ip"
                style={{
                  fontSize: '12.5px',
                  background: 'oklch(66% 0.18 295 / 0.10)',
                  border: '1px solid oklch(66% 0.18 295 / 0.25)',
                  color: 'var(--c-purple)',
                }}
              >
                VLAN {prefix.vlan.vid} · {prefix.vlan.name}
              </span>
            )}
            <span>{prefix.total_ips} IP-adresser totalt</span>
            <span>{prefix.used_ips} använda</span>
          </div>
          {prefix.total_ips > 0 && (
            <div className="mt-3 max-w-xs">
              <UtilizationBar value={prefix.utilization} />
            </div>
          )}
        </div>
      </div>

      {/* Child prefixes */}
      {children.length > 0 && (
        <section className="mb-5">
          <h2 className="font-medium mb-2" style={{ fontSize: '13px', color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Underprefix
          </h2>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border-sub)' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
                  {['Prefix', 'Namn', 'VLAN', 'Status', 'Utnyttjande'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium"
                      style={{ fontSize: '12px', color: 'var(--c-text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ background: 'var(--c-base)' }}>
                {children.map(child => (
                  <tr
                    key={child.id}
                    className="group cursor-pointer"
                    style={{ borderBottom: '1px solid var(--c-border-sub)' }}
                    onClick={() => navigate(`/prefixes/${child.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td className="px-4 py-2.5">
                      <code className="font-ip" style={{ fontSize: '13.5px', color: 'var(--c-accent)' }}>{child.prefix}</code>
                    </td>
                    <td className="px-4 py-2.5" style={{ fontSize: '14px', color: 'var(--c-text-2)' }}>
                      {child.name || <span style={{ color: 'var(--c-text-3)' }}>–</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {child.vlan
                        ? <span className="font-ip" style={{ fontSize: '12.5px', color: 'var(--c-purple)' }}>{child.vlan.vid} · {child.vlan.name}</span>
                        : <span style={{ color: 'var(--c-text-3)' }}>–</span>}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={child.status} /></td>
                    <td className="px-4 py-2.5 w-40"><UtilizationBar value={child.utilization} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* IP Addresses */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium" style={{ fontSize: '13px', color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            IP-adresser <span style={{ color: 'var(--c-text-3)', fontWeight: 400, marginLeft: 6 }}>{addresses.length}</span>
          </h2>
          {isAdmin && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
              <Plus size={14} /> Lägg till IP
            </button>
          )}
        </div>

        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border-sub)' }}>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
                {['IP-adress', 'Hostname', 'DNS', 'Beskrivning', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium"
                    style={{ fontSize: '12px', color: 'var(--c-text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ background: 'var(--c-base)' }}>
              {addresses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Server size={26} style={{ color: 'var(--c-border)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '14px', color: 'var(--c-text-3)' }}>Inga IP-adresser i detta prefix</p>
                  </td>
                </tr>
              )}
              {addresses.map(a => (
                <tr key={a.id} className="group"
                  style={{ borderBottom: '1px solid var(--c-border-sub)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-raised)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td className="px-4 py-2.5">
                    <code className="font-ip" style={{ fontSize: '13.5px', color: 'var(--c-accent)' }}>{a.address}</code>
                  </td>
                  <td className="px-4 py-2.5" style={{ fontSize: '14px', color: 'var(--c-text)' }}>
                    {a.hostname || <span style={{ color: 'var(--c-text-3)' }}>–</span>}
                  </td>
                  <td className="px-4 py-2.5" style={{ fontSize: '14px', color: 'var(--c-text-2)' }}>
                    {a.dns_name || <span style={{ color: 'var(--c-text-3)' }}>–</span>}
                  </td>
                  <td className="px-4 py-2.5" style={{ fontSize: '14px', color: 'var(--c-text-2)' }}>
                    {a.description || <span style={{ color: 'var(--c-text-3)' }}>–</span>}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconBtn onClick={() => openEdit(a)} hoverColor="var(--c-accent)"><Pencil size={13} /></IconBtn>
                        <IconBtn onClick={() => handleDelete(a)} hoverColor="var(--c-danger)"><Trash2 size={13} /></IconBtn>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <Modal title={editing ? 'Redigera IP-adress' : `Lägg till i ${prefix.prefix}`} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="lbl">IP-adress *</label>
              <input required type="text" placeholder="10.10.1.100"
                value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="ctrl mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl">Hostname</label>
                <input type="text" placeholder="server01"
                  value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))}
                  className="ctrl" />
              </div>
              <div>
                <label className="lbl">DNS-namn</label>
                <input type="text" placeholder="server01.example.com"
                  value={form.dns_name} onChange={e => setForm(f => ({ ...f, dns_name: e.target.value }))}
                  className="ctrl mono" />
              </div>
            </div>
            <div>
              <label className="lbl">Beskrivning</label>
              <input type="text" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="ctrl" />
            </div>
            <div>
              <label className="lbl">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                className="ctrl">
                <option value="active">Active</option>
                <option value="reserved">Reserved</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
            {error && (
              <p className="rounded-md px-3 py-2" style={{ fontSize: '13px', color: 'var(--c-danger)', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.25)' }}>
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Avbryt</button>
              <button type="submit" className="btn-primary">{editing ? 'Spara' : 'Lägg till'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function IconBtn({ onClick, hoverColor, children }: { onClick: () => void; hoverColor: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded"
      style={{ color: 'var(--c-text-3)', transition: 'color 100ms, background 100ms' }}
      onMouseEnter={e => { e.currentTarget.style.color = hoverColor; e.currentTarget.style.background = 'var(--c-raised)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-3)'; e.currentTarget.style.background = '' }}>
      {children}
    </button>
  )
}
