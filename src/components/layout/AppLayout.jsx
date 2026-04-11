import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import styles from './AppLayout.module.css'

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className={styles.layout}>
      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}
      <div className={`${styles.sidebarWrap} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <Sidebar onClose={() => setMobileOpen(false)} />
      </div>
      <div className={styles.main}>
        <div className={styles.mobileHeader}>
          <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}>☰</button>
          <div className={styles.mobileLogo}>⚡ LeadFlow</div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
