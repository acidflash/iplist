import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Prefixes } from './pages/Prefixes'
import { PrefixDetail } from './pages/PrefixDetail'
import { VLANs } from './pages/VLANs'
import { Addresses } from './pages/Addresses'
import { Users } from './pages/Users'

function ProtectedRoutes() {
  const { auth } = useAuth()
  if (!auth) return <Navigate to="/login" replace />
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="prefixes" element={<Prefixes />} />
        <Route path="prefixes/:id" element={<PrefixDetail />} />
        <Route path="vlans" element={<VLANs />} />
        <Route path="addresses" element={<Addresses />} />
        <Route path="users" element={<Users />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginGuard />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function LoginGuard() {
  const { auth } = useAuth()
  if (auth) return <Navigate to="/" replace />
  return <Login />
}
