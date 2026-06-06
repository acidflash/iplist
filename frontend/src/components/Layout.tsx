import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Network, Layers, Server, Users, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { LogoMark } from './Logo'
import { useT, langs } from '../i18n'

export function Layout() {
  const { auth, logout, isAdmin } = useAuth()
  const { t, lang, setLang } = useT()

  const nav = [
    { to: '/', label: t.nav.dashboard, icon: LayoutDashboard, end: true },
    { to: '/prefixes', label: t.nav.prefixes, icon: Network, end: false },
    { to: '/vlans', label: t.nav.vlans, icon: Layers, end: false },
    { to: '/addresses', label: t.nav.addresses, icon: Server, end: false },
    ...(isAdmin ? [{ to: '/users', label: t.nav.users, icon: Users, end: false }] : []),
  ]

  return (
    <div className="flex bg-c-base overflow-hidden" style={{ height: 'calc(100vh / 1.25)' }}>
      <aside
        className="w-52 flex flex-col flex-shrink-0 border-r"
        style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-sub)' }}
      >
        {/* Logo */}
        <div
          className="px-4 h-12 flex items-center gap-2.5 flex-shrink-0 border-b"
          style={{ borderColor: 'var(--c-border-sub)' }}
        >
          <LogoMark size={22} color="var(--c-accent)" />
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
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-[14px] font-medium transition-colors duration-100 ${
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

        {/* User footer */}
        <div
          className="px-3 py-3 border-t"
          style={{ borderColor: 'var(--c-border-sub)' }}
        >
          <div className="flex items-center gap-2 mb-2 px-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-semibold"
              style={{ background: 'oklch(62% 0.20 258 / 0.15)', color: 'var(--c-accent)', fontSize: '11px' }}
            >
              {auth?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium" style={{ fontSize: '13px', color: 'var(--c-text)' }}>
                {auth?.username}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>
                {auth?.role === 'admin' ? t.nav.admin : t.nav.reader}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors"
            style={{ fontSize: '13px', color: 'var(--c-text-3)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-raised)'; e.currentTarget.style.color = 'var(--c-text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--c-text-3)' }}
          >
            <LogOut size={14} /> {t.nav.logout}
          </button>

          {/* Version */}
          <div className="px-1 mt-2">
            <span style={{ fontSize: '10px', color: 'var(--c-text-3)', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
              {__APP_VERSION__}
            </span>
          </div>

          {/* Language switcher */}
          <div className="flex items-center gap-1 mt-1 px-1">
            {Object.keys(langs).map(code => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  border: `1px solid ${lang === code ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  color: lang === code ? 'var(--c-accent)' : 'var(--c-text-3)',
                  background: lang === code ? 'oklch(62% 0.20 258 / 0.10)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-c-base">
        <Outlet />
      </main>
    </div>
  )
}
