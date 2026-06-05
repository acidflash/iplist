import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Server } from 'lucide-react'
import { getAddresses, createAddress, updateAddress, deleteAddress, getPrefixes } from '../api/client'
import type { IPAddress, Prefix, Status } from '../types'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'

interface FormData {
  address: string; hostname: string; dns_name: string
  description: string; status: Status; prefix_id: string
}
const emptyForm: FormData = { address: '', hostname: '', dns_name: '', description: '', status: 'active', prefix_id: '' }

export function Addresses() {
  const [addresses, setAddresses] = useState<IPAddress[]>([])
  const [prefixes, setPrefixes] = useState<Prefix[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<IPAddress | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [error, setError] = useState('')
  const [filterPrefix, setFilterPrefix] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const params: { prefix_id?: number; status?: string } = {}
    if (filterPrefix) params.prefix_id = parseInt(filterPrefix)
    if (filterStatus) params.status = filterStatus
    const [a, p] = await Promise.all([getAddresses(params), getPrefixes()])
    setAddresses(a); setPrefixes(p)
  }, [filterPrefix, filterStatus])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }
  const openEdit = (a: IPAddress) => {
    setEditing(a)
    setForm({ address: a.address, hostname: a.hostname, dns_name: a.dns_name, description: a.description, status: a.status, prefix_id: a.prefix_id?.toString() ?? '' })
    setError(''); setShowModal(true)
  }
  const handleDelete = async (a: IPAddress) => {
    if (!confirm(`Ta bort ${a.address}?`)) return
    await deleteAddress(a.id); load()
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try {
      const payload = { address: form.address, hostname: form.hostname, dns_name: form.dns_name, description: form.description, status: form.status, prefix_id: form.prefix_id ? parseInt(form.prefix_id) : null }
      editing ? await updateAddress(editing.id, payload) : await createAddress(payload)
      setShowModal(false); load()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Något gick fel')
    }
  }

  const prefixMap = new Map(prefixes.map(p => [p.id, p]))
  const filtered = addresses.filter(a =>
    !search || a.address.includes(search) || a.hostname.toLowerCase().includes(search.toLowerCase()) || a.dns_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold text-c-text">IP-adresser</h1>
          <p className="text-c-text3 mt-0.5" style={{ fontSize: '12px' }}>{addresses.length} adresser</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> Lägg till
        </button>
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <input type="text" placeholder="Sök IP, hostname, DNS…" value={search}
          onChange={e => setSearch(e.target.value)} className="ctrl" style={{ width: '260px' }} />
        <select value={filterPrefix} onChange={e => setFilterPrefix(e.target.value)}
          className="ctrl" style={{ width: 'auto' }}>
          <option value="">Alla prefix</option>
          {prefixes.map(p => <option key={p.id} value={p.id}>{p.prefix}{p.name ? ` · ${p.name}` : ''}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="ctrl" style={{ width: 'auto' }}>
          <option value="">Alla statusar</option>
          <option value="active">Active</option>
          <option value="reserved">Reserved</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border-sub)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
              {['IP-adress', 'Hostname', 'DNS', 'Prefix', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium"
                  style={{ fontSize: '11px', color: 'var(--c-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ background: 'var(--c-base)' }}>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-14 text-center">
                  <Server size={28} style={{ color: 'var(--c-border)', margin: '0 auto 8px' }} />
                  <p className="text-c-text3" style={{ fontSize: '13px' }}>
                    {search || filterPrefix || filterStatus ? 'Inga adresser matchar filtret' : 'Lägg till din första IP-adress'}
                  </p>
                </td>
              </tr>
            )}
            {filtered.map(a => {
              const prefix = a.prefix_id ? prefixMap.get(a.prefix_id) : null
              return (
                <tr key={a.id} className="group"
                  style={{ borderBottom: '1px solid var(--c-border-sub)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-raised)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td className="px-4 py-2.5">
                    <code className="font-ip text-c-accent" style={{ fontSize: '12.5px' }}>{a.address}</code>
                  </td>
                  <td className="px-4 py-2.5 text-c-text" style={{ fontSize: '13px' }}>{a.hostname || <span style={{ color: 'var(--c-text-3)' }}>–</span>}</td>
                  <td className="px-4 py-2.5 text-c-text2" style={{ fontSize: '13px' }}>{a.dns_name || <span style={{ color: 'var(--c-text-3)' }}>–</span>}</td>
                  <td className="px-4 py-2.5">
                    {prefix
                      ? <code className="font-ip text-c-text3" style={{ fontSize: '11.5px', background: 'var(--c-raised)', border: '1px solid var(--c-border)', borderRadius: '4px', padding: '2px 6px' }}>{prefix.prefix}</code>
                      : <span style={{ color: 'var(--c-text-3)' }}>–</span>}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconBtn onClick={() => openEdit(a)} hoverColor="var(--c-accent)"><Pencil size={13} /></IconBtn>
                      <IconBtn onClick={() => handleDelete(a)} hoverColor="var(--c-danger)"><Trash2 size={13} /></IconBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Redigera IP-adress' : 'Ny IP-adress'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="lbl">IP-adress *</label>
              <input required type="text" placeholder="10.0.0.1"
                value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="ctrl mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl">Hostname</label>
                <input type="text" placeholder="server01"
                  value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))} className="ctrl" />
              </div>
              <div>
                <label className="lbl">DNS-namn</label>
                <input type="text" placeholder="server01.example.com"
                  value={form.dns_name} onChange={e => setForm(f => ({ ...f, dns_name: e.target.value }))} className="ctrl mono" />
              </div>
            </div>
            <div>
              <label className="lbl">Beskrivning</label>
              <input type="text" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="ctrl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))} className="ctrl">
                  <option value="active">Active</option>
                  <option value="reserved">Reserved</option>
                  <option value="deprecated">Deprecated</option>
                </select>
              </div>
              <div>
                <label className="lbl">Prefix <span style={{ color: 'var(--c-text-3)', fontWeight: 400 }}>(auto)</span></label>
                <select value={form.prefix_id} onChange={e => setForm(f => ({ ...f, prefix_id: e.target.value }))} className="ctrl">
                  <option value="">– Auto –</option>
                  {prefixes.map(p => <option key={p.id} value={p.id}>{p.prefix}</option>)}
                </select>
              </div>
            </div>
            {error && (
              <p className="rounded-md px-3 py-2" style={{ fontSize: '12px', color: 'var(--c-danger)', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.25)' }}>
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
