import { useState, type FormEvent } from 'react'
import { Network } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

export function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post('/api/v1/auth/login', { username, password })
      login(data.token, data.username, data.role)
    } catch {
      setError('Fel användarnamn eller lösenord')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--c-base)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-sub)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'oklch(62% 0.20 258 / 0.15)', border: '1px solid oklch(62% 0.20 258 / 0.3)' }}
          >
            <Network size={16} style={{ color: 'var(--c-accent)' }} />
          </div>
          <span className="font-semibold" style={{ fontSize: '16px' }}>IPList</span>
        </div>

        <h1 className="font-semibold mb-1" style={{ fontSize: '18px' }}>Logga in</h1>
        <p className="mb-6" style={{ fontSize: '14px', color: 'var(--c-text-3)' }}>
          Ange dina inloggningsuppgifter
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="lbl">Användarnamn</label>
            <input
              required
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="ctrl"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="lbl">Lösenord</label>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="ctrl"
            />
          </div>

          {error && (
            <p
              className="rounded-md px-3 py-2"
              style={{ fontSize: '13px', color: 'var(--c-danger)', background: 'oklch(62% 0.18 25 / 0.10)', border: '1px solid oklch(62% 0.18 25 / 0.25)' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Loggar in…' : 'Logga in'}
          </button>
        </form>
      </div>
    </div>
  )
}
