import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface AuthState {
  token: string
  username: string
  role: 'admin' | 'read'
}

interface AuthContextValue {
  auth: AuthState | null
  login: (token: string, username: string, role: string) => void
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'iplist_auth'

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(loadAuth)

  const login = useCallback((token: string, username: string, role: string) => {
    const state: AuthState = { token, username, role: role as 'admin' | 'read' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    setAuth(state)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setAuth(null)
  }, [])

  return (
    <AuthContext.Provider value={{ auth, login, logout, isAdmin: auth?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
