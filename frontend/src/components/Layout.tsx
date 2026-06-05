import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Network, Layers, Server } from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/prefixes', label: 'Prefix', icon: Network, end: false },
  { to: '/vlans', label: 'VLAN', icon: Layers, end: false },
  { to: '/addresses', label: 'IP-adresser', icon: Server, end: false },
]

export function Layout() {
  return (
    <div className="flex h-screen bg-c-base overflow-hidden">
      <aside
        className="w-52 flex flex-col flex-shrink-0 border-r"
        style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-sub)' }}
      >
        {/* Logo */}
        <div
          className="px-4 h-12 flex items-center gap-2.5 flex-shrink-0 border-b"
          style={{ borderColor: 'var(--c-border-sub)' }}
        >
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'oklch(62% 0.20 258 / 0.15)', border: '1px solid oklch(62% 0.20 258 / 0.3)' }}
          >
            <Network size={13} style={{ color: 'var(--c-accent)' }} />
          </div>
          <span className="font-semibold text-c-text text-sm tracking-tight">IPList</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-100 ${
                  isActive
                    ? 'text-c-accent'
                    : 'text-c-text3 hover:text-c-text2 hover:bg-c-raised'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'oklch(62% 0.20 258 / 0.10)',
              } : {}}
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} style={{ color: isActive ? 'var(--c-accent)' : undefined }} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: 'var(--c-border-sub)' }}
        >
          <p className="text-[11px] text-c-text3">IP Plan Manager</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-c-base">
        <Outlet />
      </main>
    </div>
  )
}
