import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Prefixes } from './pages/Prefixes'
import { VLANs } from './pages/VLANs'
import { Addresses } from './pages/Addresses'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="prefixes" element={<Prefixes />} />
          <Route path="vlans" element={<VLANs />} />
          <Route path="addresses" element={<Addresses />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
