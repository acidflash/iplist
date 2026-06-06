import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, ChevronRight, Server, ChevronsRight, Copy, Check } from 'lucide-react'
import { getPrefix, createAddress, updateAddress, deleteAddress, getSubnets, createPrefix, getVLANs } from '../api/client'
import type { Prefix, IPAddress, Status, SplitResponse, VLAN, NetworkInfo } from '../types'
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
  const [splitLen, setSplitLen] = useState<number | null>(null)
  const [splitResult, setSplitResult] = useState<SplitResponse | null>(null)
  const [splitLoading, setSplitLoading] = useState(false)
  const [splitKey, setSplitKey] = useState(0)

  const load = useCallback(async () => {
    if (!id) return
    const p = await getPrefix(parseInt(id))
    setPrefix(p)
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!id || splitLen === null) return
    setSplitLoading(true)
    getSubnets(parseInt(id), splitLen)
      .then(setSplitResult)
      .catch(() => setSplitResult(null))
      .finally(() => setSplitLoading(false))
  }, [id, splitLen, splitKey])

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

      {/* Network info */}
      {prefix.net_info && <NetworkInfoPanel info={prefix.net_info} cidr={prefix.prefix} />}

      {/* Subnet Calculator */}
      <SubnetCalculator
        prefix={prefix}
        splitLen={splitLen}
        onSplitLenChange={len => { setSplitLen(len); setSplitResult(null) }}
        splitResult={splitResult}
        splitLoading={splitLoading}
        isAdmin={isAdmin}
        onCreated={() => { load(); setSplitKey(k => k + 1) }}
      />

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
              <input required type="text" placeholder="192.168.1.10 eller 2001:db8::1"
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

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{ fontSize: '11px', color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 group/cf">
        <code className="font-ip" style={{ fontSize: '13px', color: 'var(--c-text)' }}>{value}</code>
        <button
          onClick={copy}
          className="opacity-0 group-hover/cf:opacity-100 transition-opacity rounded p-0.5"
          style={{ color: copied ? 'oklch(65% 0.18 145)' : 'var(--c-text-3)' }}
          title="Kopiera"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>
    </div>
  )
}

function NetworkInfoPanel({ info, cidr }: { info: NetworkInfo; cidr: string }) {
  const isIPv4 = info.version === 4
  const prefixLen = parseInt(cidr.split('/')[1])
  const hostBits = (isIPv4 ? 32 : 128) - prefixLen

  const formatTotal = (s: string) => {
    // For small numbers (≤ 2^53), use locale formatting
    if (s.length <= 15) return parseInt(s).toLocaleString('sv-SE')
    // For large IPv6 counts, show as 2^N
    return `2^${hostBits}`
  }

  return (
    <section className="mb-5">
      <h2
        className="font-medium mb-2"
        style={{ fontSize: '13px', color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        Nätverksinformation
      </h2>
      <div
        className="rounded-lg px-5 py-4"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-sub)' }}
      >
        {isIPv4 ? (
          <div className="grid gap-x-10 gap-y-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            <CopyField label="Nätverksadress" value={info.network} />
            <CopyField label="Broadcast" value={info.broadcast!} />
            <CopyField label="Nätmask" value={info.netmask!} />
            <CopyField label="Wildcard-mask" value={info.wildcard!} />
            <CopyField label="Första host" value={info.first_host} />
            <CopyField label="Sista host" value={info.last_host} />
            <div className="flex flex-col gap-0.5">
              <span style={{ fontSize: '11px', color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Användbara hostar
              </span>
              <span className="font-ip tabular-nums" style={{ fontSize: '13px', color: 'var(--c-text)' }}>
                {formatTotal(info.total_hosts)}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid gap-x-10 gap-y-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            <CopyField label="Första adress" value={info.first_host} />
            <CopyField label="Sista adress" value={info.last_host} />
            <div className="flex flex-col gap-0.5">
              <span style={{ fontSize: '11px', color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Totalt antal adresser
              </span>
              <span className="font-ip" style={{ fontSize: '13px', color: 'var(--c-text)' }}>
                {formatTotal(info.total_hosts)}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

interface CreateSubnetForm {
  name: string; description: string; status: Status; vlan_id: string
}
const emptyCreateForm: CreateSubnetForm = { name: '', description: '', status: 'active', vlan_id: '' }

function SubnetCalculator({
  prefix, splitLen, onSplitLenChange, splitResult, splitLoading, isAdmin, onCreated,
}: {
  prefix: Prefix
  splitLen: number | null
  onSplitLenChange: (len: number) => void
  splitResult: SplitResponse | null
  splitLoading: boolean
  isAdmin: boolean
  onCreated: () => void
}) {
  const [creating, setCreating] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<CreateSubnetForm>(emptyCreateForm)
  const [createError, setCreateError] = useState('')
  const [vlans, setVlans] = useState<VLAN[]>([])

  useEffect(() => {
    if (isAdmin) getVLANs().then(setVlans).catch(() => {})
  }, [isAdmin])

  const openCreate = (subnet: string) => {
    setCreating(subnet)
    setCreateForm(emptyCreateForm)
    setCreateError('')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    try {
      await createPrefix({
        prefix: creating!,
        name: createForm.name,
        description: createForm.description,
        status: createForm.status,
        parent_id: prefix.id,
        vlan_id: createForm.vlan_id ? parseInt(createForm.vlan_id) : null,
      })
      setCreating(null)
      onCreated()
    } catch (err: unknown) {
      setCreateError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Något gick fel')
    }
  }

  const parts = prefix.prefix.split('/')
  const currentLen = parseInt(parts[1])
  const isIPv6 = prefix.prefix.includes(':')
  const maxLen = isIPv6 ? 128 : 32

  if (currentLen >= maxLen) return null

  const options: number[] = []
  for (let i = currentLen + 1; i <= maxLen; i++) options.push(i)

  const effectiveSplitLen = splitLen ?? (currentLen + 1)

  return (
    <section className="mb-5">
      <h2
        className="font-medium mb-2"
        style={{ fontSize: '13px', color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        Subnätskalkylator
      </h2>
      <div
        className="rounded-lg p-4"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-sub)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <code className="font-ip" style={{ fontSize: '13.5px', color: 'var(--c-accent)' }}>{prefix.prefix}</code>
          <ChevronsRight size={14} style={{ color: 'var(--c-text-3)' }} />
          <div className="flex items-center gap-2">
            <label style={{ fontSize: '13px', color: 'var(--c-text-2)' }}>Dela upp i</label>
            <select
              value={effectiveSplitLen}
              onChange={e => onSplitLenChange(parseInt(e.target.value))}
              className="ctrl"
              style={{ width: 'auto', padding: '3px 8px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
            >
              {options.map(n => <option key={n} value={n}>/{n}</option>)}
            </select>
          </div>
          {splitLen === null && (
            <button
              onClick={() => onSplitLenChange(currentLen + 1)}
              className="btn-primary"
              style={{ fontSize: '12px', padding: '4px 12px' }}
            >
              Beräkna
            </button>
          )}
        </div>

        {splitLoading && (
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>Beräknar…</p>
        )}

        {splitResult && !splitLoading && (
          <>
            <p style={{ fontSize: '12px', color: 'var(--c-text-3)', marginBottom: '10px' }}>
              {splitResult.truncated
                ? `Visar ${splitResult.subnets.length} av ${splitResult.total_count} subnät`
                : `${splitResult.total_count} subnät`}
              {' · '}{splitResult.subnets[0]?.hosts} värdar per subnät
            </p>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border-sub)' }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: 'var(--c-base)', borderBottom: '1px solid var(--c-border)' }}>
                    {['Subnät', `Värdar${isIPv6 ? '' : ' (användbara)'}`, 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-2 text-left font-medium"
                        style={{ fontSize: '11.5px', color: 'var(--c-text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {splitResult.subnets.map(s => (
                    <tr key={s.subnet} className="group" style={{ borderBottom: '1px solid var(--c-border-sub)', background: 'var(--c-surface)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-surface)')}>
                      <td className="px-4 py-2">
                        {s.prefix_id ? (
                          <Link to={`/prefixes/${s.prefix_id}`}>
                            <code className="font-ip hover:underline" style={{ fontSize: '13px', color: 'var(--c-accent)' }}>
                              {s.subnet}
                            </code>
                          </Link>
                        ) : (
                          <code className="font-ip" style={{ fontSize: '13px', color: 'var(--c-text)' }}>{s.subnet}</code>
                        )}
                      </td>
                      <td className="px-4 py-2 font-ip tabular-nums" style={{ fontSize: '13px', color: 'var(--c-text-2)' }}>
                        {s.hosts}
                      </td>
                      <td className="px-4 py-2">
                        {s.allocated ? (
                          <span
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5"
                            style={{ fontSize: '11.5px', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.22)', color: 'var(--c-danger)' }}
                          >
                            Allokerat
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5"
                            style={{ fontSize: '11.5px', background: 'oklch(65% 0.18 145 / 0.10)', border: '1px solid oklch(65% 0.18 145 / 0.22)', color: 'oklch(65% 0.18 145)' }}
                          >
                            Ledigt
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isAdmin && !s.allocated && (
                          <button
                            onClick={() => openCreate(s.subnet)}
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded px-2 py-0.5 transition-opacity"
                            style={{ fontSize: '11.5px', background: 'oklch(62% 0.20 258 / 0.12)', border: '1px solid oklch(62% 0.20 258 / 0.30)', color: 'var(--c-accent)' }}
                          >
                            <Plus size={11} /> Skapa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {creating && (
        <Modal title={`Skapa prefix ${creating}`} onClose={() => setCreating(null)}>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div>
              <label className="lbl">CIDR</label>
              <input
                type="text" value={creating} readOnly
                className="ctrl mono"
                style={{ opacity: 0.6, cursor: 'default' }}
              />
            </div>
            <div>
              <label className="lbl">Namn</label>
              <input type="text" placeholder="Kontor Stockholm"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="ctrl" autoFocus />
            </div>
            <div>
              <label className="lbl">Beskrivning</label>
              <textarea rows={2}
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                className="ctrl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl">Status</label>
                <select value={createForm.status}
                  onChange={e => setCreateForm(f => ({ ...f, status: e.target.value as Status }))}
                  className="ctrl">
                  <option value="active">Active</option>
                  <option value="reserved">Reserved</option>
                  <option value="deprecated">Deprecated</option>
                </select>
              </div>
              <div>
                <label className="lbl">VLAN</label>
                <select value={createForm.vlan_id}
                  onChange={e => setCreateForm(f => ({ ...f, vlan_id: e.target.value }))}
                  className="ctrl">
                  <option value="">–</option>
                  {vlans.map(v => <option key={v.id} value={v.id}>{v.vid} · {v.name}</option>)}
                </select>
              </div>
            </div>
            {createError && (
              <p className="rounded-md px-3 py-2"
                style={{ fontSize: '13px', color: 'var(--c-danger)', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.25)' }}>
                {createError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCreating(null)} className="btn-ghost">Avbryt</button>
              <button type="submit" className="btn-primary">Skapa prefix</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
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
