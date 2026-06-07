import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Pencil, Trash2, Layers, Upload } from 'lucide-react'
import { getVLANs, createVLAN, updateVLAN, deleteVLAN, importVLANs } from '../api/client'
import type { VLAN, Status } from '../types'
import { Modal } from '../components/Modal'
import { ImportModal } from '../components/ImportModal'
import { StatusBadge } from '../components/StatusBadge'
import { ExportMenu } from '../components/ExportMenu'
import { exportVLANs } from '../utils/export'
import { useT } from '../i18n'

interface FormData { vid: string; name: string; description: string; status: Status }
const emptyForm: FormData = { vid: '', name: '', description: '', status: 'active' }

export function VLANs() {
  const { isAdmin } = useAuth()
  const { t } = useT()
  const [vlans, setVlans] = useState<VLAN[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<VLAN | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => { setVlans(await getVLANs()) }, [])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }
  const openEdit = (v: VLAN) => {
    setEditing(v)
    setForm({ vid: v.vid.toString(), name: v.name, description: v.description, status: v.status })
    setError(''); setShowModal(true)
  }
  const handleDelete = async (v: VLAN) => {
    if (!confirm(t.vlans.confirmDelete(v.vid))) return
    await deleteVLAN(v.id); load()
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try {
      const payload = { vid: parseInt(form.vid), name: form.name, description: form.description, status: form.status }
      editing ? await updateVLAN(editing.id, payload) : await createVLAN(payload)
      setShowModal(false); load()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t.common.somethingWentWrong)
    }
  }

  const filtered = vlans.filter(v =>
    !search || v.vid.toString().includes(search) || v.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold text-c-text">{t.vlans.title}</h1>
          <p className="text-c-text3 mt-0.5" style={{ fontSize: '13px' }}>{t.vlans.count(vlans.length)}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onExport={fmt => exportVLANs(vlans, fmt)} disabled={vlans.length === 0} />
          {isAdmin && (
            <>
              <button
                onClick={() => setShowImport(true)}
                className="btn-ghost flex items-center gap-1.5"
                style={{ fontSize: '13px' }}
              >
                <Upload size={13} /> {t.importCSV.btn}
              </button>
              <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
                <Plus size={14} /> {t.common.add}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input type="text" placeholder={t.vlans.searchPlaceholder} value={search}
          onChange={e => setSearch(e.target.value)} className="ctrl" style={{ width: '280px' }} />
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border-sub)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
              {[t.vlans.colId, t.vlans.colName, t.vlans.colDesc, 'Status', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium"
                  style={{ fontSize: '12px', color: 'var(--c-text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ background: 'var(--c-base)' }}>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-14 text-center">
                  <Layers size={28} style={{ color: 'var(--c-border)', margin: '0 auto 8px' }} />
                  <p className="text-c-text3" style={{ fontSize: '14px' }}>
                    {search ? t.vlans.emptySearch : t.vlans.emptyAll}
                  </p>
                </td>
              </tr>
            )}
            {filtered.map(v => (
              <tr
                key={v.id}
                className="group"
                style={{ borderBottom: '1px solid var(--c-border-sub)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-raised)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td className="px-4 py-2.5">
                  <span
                    className="font-ip font-medium"
                    style={{
                      fontSize: '13.5px',
                      color: 'var(--c-purple)',
                      background: 'oklch(66% 0.18 295 / 0.10)',
                      border: '1px solid oklch(66% 0.18 295 / 0.22)',
                      borderRadius: '4px',
                      padding: '2px 7px',
                    }}
                  >
                    {v.vid}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-c-text font-medium" style={{ fontSize: '14px' }}>{v.name}</td>
                <td className="px-4 py-2.5 text-c-text2" style={{ fontSize: '14px' }}>{v.description || <span style={{ color: 'var(--c-text-3)' }}>–</span>}</td>
                <td className="px-4 py-2.5"><StatusBadge status={v.status} /></td>
                {isAdmin && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconBtn onClick={() => openEdit(v)} hoverColor="var(--c-accent)"><Pencil size={13} /></IconBtn>
                      <IconBtn onClick={() => handleDelete(v)} hoverColor="var(--c-danger)"><Trash2 size={13} /></IconBtn>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showImport && (
        <ImportModal
          what={t.vlans.title}
          formatHint="vid, name, description, status"
          exampleFile="/examples/vlans.csv"
          onImport={importVLANs}
          onDone={load}
          onClose={() => setShowImport(false)}
        />
      )}

      {showModal && (
        <Modal title={editing ? t.vlans.modalEdit : t.vlans.modalCreate} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="lbl">{t.vlans.vid} * <span style={{ color: 'var(--c-text-3)', fontWeight: 400 }}>({t.vlans.vidHint})</span></label>
              <input required type="number" min="1" max="4094" placeholder="100"
                value={form.vid} onChange={e => setForm(f => ({ ...f, vid: e.target.value }))} className="ctrl mono" />
            </div>
            <div>
              <label className="lbl">{t.vlans.colName} *</label>
              <input required type="text" placeholder="Management"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="ctrl" />
            </div>
            <div>
              <label className="lbl">{t.vlans.colDesc}</label>
              <textarea rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="ctrl" />
            </div>
            <div>
              <label className="lbl">{t.common.status}</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))} className="ctrl">
                <option value="active">{t.status.active}</option>
                <option value="reserved">{t.status.reserved}</option>
                <option value="deprecated">{t.status.deprecated}</option>
              </select>
            </div>
            {error && (
              <p className="rounded-md px-3 py-2" style={{ fontSize: '12px', color: 'var(--c-danger)', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.25)' }}>
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">{t.common.cancel}</button>
              <button type="submit" className="btn-primary">{editing ? t.common.save : t.common.create}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function IconBtn({ onClick, hoverColor, children }: { onClick: () => void; hoverColor: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded transition-colors"
      style={{ color: 'var(--c-text-3)' }}
      onMouseEnter={e => { e.currentTarget.style.color = hoverColor; e.currentTarget.style.background = 'var(--c-raised)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-3)'; e.currentTarget.style.background = '' }}
    >
      {children}
    </button>
  )
}
