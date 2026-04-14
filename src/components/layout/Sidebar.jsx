import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { Avatar } from '@/components/ui'
import styles from './Sidebar.module.css'

const NAV = [
  { to: '/',              icon: '⊞',  label: 'Dashboard' },
  { to: '/attention',     icon: '🎧', label: 'Atención' },
  { to: '/leads',         icon: '👤', label: 'Leads' },
  { to: '/pipeline',      icon: '⋮⋮', label: 'Pipeline' },
  { to: '/contacts',      icon: '👥', label: 'Contactos' },
  { to: '/orders',        icon: '📦', label: 'Órdenes' },
  { to: '/catalog', icon: '🗂️', label: 'Catálogo', sub: [
    { to: '/catalog',             label: '📋 Ver catálogo' },
    { to: '/catalog-match',       label: '🔍 Match proveedor' },
    { to: '/families',            label: '🏷️ Familias y modelos' },
    { to: '/catalog-normalize',   label: '🔧 Normalizar datos' },
    { to: '/oem-codes',           label: '🏎️ Homologaciones OEM' },
    { to: '/competitor-prices',   label: '🏆 Competencia' },
    { to: '/inventory-sources',   label: '🏭 Fuentes de stock' },
  ]},
  { to: '/profitability', icon: '📊', label: 'Rentabilidad' },
  { to: '/price-lists',   icon: '🏷️', label: 'Listas de precios' },
  { to: '/business-rules', icon: '⚙️', label: 'Reglas negocio', sub: [
    { to: '/delivery-rules', label: '🚚 Tiempos de entrega' },
  ]},
  { to: '/workshops', icon: '🔧', label: 'Talleres', sub: [
    { to: '/workshops',           label: '📋 Ver talleres' },
    { to: '/workshops/new',       label: '➕ Nuevo taller' },
    { to: '/delivery-services',   label: '🚚 Servicios a domicilio' },
  ]},
  { to: '/calendar',      icon: '📅', label: 'Calendario' },
  { to: '/reports',       icon: '📈', label: 'Reportes' },
]

const BOTTOM_NAV = [
  { to: '/settings', icon: '⚙️', label: 'Configuración' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [quotesOpen, setQuotesOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const isQuotesActive = location.pathname.startsWith('/quotes')

  const handleNewQuote = (type) => {
    setQuotesOpen(false)
    navigate('/quotes/new', { state: { priceType: type } })
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>⚡</div>
        {!collapsed && <span className={styles.logoText}>LeadFlow</span>}
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV.map(item => item.sub ? (
          <div key={item.to} className={styles.submenuWrapper}>
            <NavLink to={item.sub[0].to} className={({isActive})=>`${styles.navItem} ${isActive?styles.active:''}`}>
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </NavLink>
            {!collapsed && (
              <div className={styles.submenu}>
                {item.sub.map(s=>(
                  <NavLink key={s.to} to={s.to} end className={({isActive})=>`${styles.subItem} ${isActive?styles.subActive:''}`}>
                    {s.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
          </NavLink>
        ))}

        {/* Cotizaciones con submenú */}
        <div className={styles.submenuWrapper}>
          <div
            className={`${styles.navItem} ${isQuotesActive ? styles.active : ''} ${styles.submenuTrigger}`}
            onClick={() => setQuotesOpen(v => !v)}
          >
            <span className={styles.navIcon}>📋</span>
            {!collapsed && (
              <>
                <span className={styles.navLabel}>Cotizaciones</span>
                <span className={styles.submenuArrow}>{quotesOpen ? '▾' : '▸'}</span>
              </>
            )}
          </div>

          {quotesOpen && !collapsed && (
            <div className={styles.submenu}>
              <NavLink to="/quotes" end className={({isActive}) => `${styles.subItem} ${isActive?styles.subActive:''}`}>
                <span>📋</span> Ver cotizaciones
              </NavLink>
              <button className={styles.subItem} onClick={()=>handleNewQuote('con_iva')}>
                <span>🧑</span> Nueva — Cliente final
              </button>
              <button className={styles.subItem} onClick={()=>handleNewQuote('sin_iva')}>
                <span>🏢</span> Nueva — Distribuidor
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom */}
      <div className={styles.bottom}>
        {BOTTOM_NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
          </NavLink>
        ))}

        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          <span className={styles.navIcon}>{collapsed ? '→' : '←'}</span>
          {!collapsed && <span className={styles.navLabel}>Colapsar</span>}
        </button>

        {user && (
          <div className={styles.userRow}>
            <Avatar name={user.name} size="sm" />
            {!collapsed && (
              <div className={styles.userInfo}>
                <div className={styles.userName}>{user.name}</div>
                <div className={styles.userRole}>{user.role}</div>
              </div>
            )}
            {!collapsed && (
              <button className={styles.logoutBtn} onClick={logout} title="Cerrar sesión">⎋</button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
