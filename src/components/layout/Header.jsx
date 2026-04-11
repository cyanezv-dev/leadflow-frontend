import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './Header.module.css'

const PAGE_TITLES = {
  '/':          { title: 'Dashboard', sub: 'Resumen de tu pipeline' },
  '/leads':     { title: 'Leads', sub: 'Gestiona tus prospectos' },
  '/pipeline':  { title: 'Pipeline', sub: 'Vista kanban del embudo' },
  '/quotes':    { title: 'Cotizaciones', sub: 'Presupuestos y propuestas' },
  '/calendar':  { title: 'Calendario', sub: 'Citas y actividades' },
  '/reports':   { title: 'Reportes', sub: 'Análisis y métricas' },
  '/settings':  { title: 'Configuración', sub: 'Ajustes del sistema' },
}

export default function Header({ onSearch, actions }) {
  const location = useLocation()
  const [search, setSearch] = useState('')

  const pathKey = '/' + location.pathname.split('/')[1]
  const page = PAGE_TITLES[pathKey] || { title: 'LeadFlow', sub: '' }

  const handleSearch = (e) => {
    setSearch(e.target.value)
    onSearch?.(e.target.value)
  }

  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <h1 className={styles.title}>{page.title}</h1>
        <span className={styles.sub}>{page.sub}</span>
      </div>

      <div className={styles.right}>
        {onSearch && (
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              className={styles.search}
              placeholder="Buscar..."
              value={search}
              onChange={handleSearch}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => { setSearch(''); onSearch(''); }}>
                ✕
              </button>
            )}
          </div>
        )}

        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  )
}
