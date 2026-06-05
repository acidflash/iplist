import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users as UsersIcon, ShieldCheck, Eye } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser, type UserData } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/Modal'

interface CreateForm { username: string; password: string; role: string }
interface EditForm { password: string; role: string }

export function Users() {
  const { auth } = useAuth()
  const [users, setUsers] = useState<UserData[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<UserData | null>(null)
  const [createForm, setCreateForm] = useState<CreateForm>({ username: '', password: '', role: 'read' })
  const [editForm, setEditForm] = useState<EditForm>({ password: '', role: 'read' })
  const [error, setError] = useState('')

  const load = useCallback(async () => { setUsers(await getUsers()) }, [])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setCreateForm({ username: '', password: '', role: 'read' }); setError(''); setShowCreate(true) }
  const openEdit = (u: UserData) => { setEditing(u); setEditForm({ password: '', role: u.role }); setError('') }
  const handleDelete = async (u: UserData) => {
    if (!confirm(`Ta bort användare ${u.username}?`)) return
    try { await deleteUser(u.id); load() } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Kunde inte ta bort')
    }
  }
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try { await createUser(createForm); setShowCreate(false); load() } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Något gick fel')
    }
  }
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    const payload: { password?: string; role?: string } = { role: editForm.role }
    if (editForm.password) payload.password = editForm.password
    try { await updateUser(editing!.id, payload); setEditing(null); load() } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Något gick fel')
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold text-c-text">Användare</h1>
          <p className="text-c-text3 mt-0.5" style={{ fontSize: '13px' }}>{users.length} användare</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> Lägg till
        </button>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border-sub)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
              {['Användare', 'Roll', 'Skapad', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium"
                  style={{ fontSize: '12px', color: 'var(--c-text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ background: 'var(--c-base)' }}>
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="py-14 text-center">
                  <UsersIcon size={28} style={{ color: 'var(--c-border)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '14px', color: 'var(--c-text-3)' }}>Inga användare</p>
                </td>
              </tr>
            )}
            {users.map(u => (
              <tr key={u.id} className="group"
                style={{ borderBottom: '1px solid var(--c-border-sub)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-raised)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                      style={{ background: 'oklch(62% 0.20 258 / 0.12)', color: 'var(--c-accent)', fontSize: '12px' }}>
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontSize: '14px', color: 'var(--c-text)', fontWeight: 500 }}>{u.username}</span>
                      {u.username === auth?.username && (
                        <span className="ml-2 rounded px-1.5 py-0.5" style={{ fontSize: '11px', background: 'oklch(62% 0.20 258 / 0.12)', color: 'var(--c-accent)' }}>
                          du
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-3" style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
                  {new Date(u.created_at).toLocaleDateString('sv-SE')}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconBtn onClick={() => openEdit(u)} hoverColor="var(--c-accent)"><Pencil size={13} /></IconBtn>
                    <IconBtn onClick={() => handleDelete(u)} hoverColor="var(--c-danger)"><Trash2 size={13} /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal title="Ny användare" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div>
              <label className="lbl">Användarnamn *</label>
              <input required type="text" value={createForm.username}
                onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                className="ctrl" placeholder="johndoe" />
            </div>
            <div>
              <label className="lbl">Lösenord *</label>
              <input required type="password" value={createForm.password}
                onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                className="ctrl" />
            </div>
            <div>
              <label className="lbl">Roll</label>
              <div className="flex gap-3 mt-1">
                <RoleOption value="admin" current={createForm.role} label="Administratör" desc="Full åtkomst"
                  icon={ShieldCheck} onChange={r => setCreateForm(f => ({ ...f, role: r }))} />
                <RoleOption value="read" current={createForm.role} label="Läsare" desc="Kan bara läsa"
                  icon={Eye} onChange={r => setCreateForm(f => ({ ...f, role: r }))} />
              </div>
            </div>
            {error && <ErrorMsg msg={error} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Avbryt</button>
              <button type="submit" className="btn-primary">Skapa</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title={`Redigera ${editing.username}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleEdit} className="space-y-3.5">
            <div>
              <label className="lbl">Nytt lösenord <span style={{ color: 'var(--c-text-3)', fontWeight: 400 }}>(lämna tomt för att behålla)</span></label>
              <input type="password" value={editForm.password}
                onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                className="ctrl" />
            </div>
            <div>
              <label className="lbl">Roll</label>
              <div className="flex gap-3 mt-1">
                <RoleOption value="admin" current={editForm.role} label="Administratör" desc="Full åtkomst"
                  icon={ShieldCheck} onChange={r => setEditForm(f => ({ ...f, role: r }))} />
                <RoleOption value="read" current={editForm.role} label="Läsare" desc="Kan bara läsa"
                  icon={Eye} onChange={r => setEditForm(f => ({ ...f, role: r }))} />
              </div>
            </div>
            {error && <ErrorMsg msg={error} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Avbryt</button>
              <button type="submit" className="btn-primary">Spara</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin'
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5"
      style={{
        fontSize: '12.5px', fontWeight: 500,
        background: isAdmin ? 'oklch(62% 0.20 258 / 0.12)' : 'oklch(68% 0.145 145 / 0.12)',
        border: `1px solid ${isAdmin ? 'oklch(62% 0.20 258 / 0.3)' : 'oklch(68% 0.145 145 / 0.3)'}`,
        color: isAdmin ? 'var(--c-accent)' : 'var(--c-success)',
      }}>
      {isAdmin ? <ShieldCheck size={11} /> : <Eye size={11} />}
      {isAdmin ? 'Admin' : 'Läsare'}
    </span>
  )
}

function RoleOption({ value, current, label, desc, icon: Icon, onChange }: {
  value: string; current: string; label: string; desc: string
  icon: typeof ShieldCheck; onChange: (v: string) => void
}) {
  const active = current === value
  return (
    <button type="button" onClick={() => onChange(value)}
      className="flex-1 flex items-start gap-2.5 p-3 rounded-lg text-left transition-colors"
      style={{
        border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: active ? 'oklch(62% 0.20 258 / 0.08)' : 'var(--c-base)',
      }}>
      <Icon size={16} style={{ color: active ? 'var(--c-accent)' : 'var(--c-text-3)', marginTop: 1, flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: '13px', fontWeight: 500, color: active ? 'var(--c-text)' : 'var(--c-text-2)' }}>{label}</p>
        <p style={{ fontSize: '12px', color: 'var(--c-text-3)' }}>{desc}</p>
      </div>
    </button>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="rounded-md px-3 py-2"
      style={{ fontSize: '13px', color: 'var(--c-danger)', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.25)' }}>
      {msg}
    </p>
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
