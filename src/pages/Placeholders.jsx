import Header from '@/components/layout/Header'
import { Empty } from '@/components/ui'
import styles from './Placeholder.module.css'

export function Reports() {
  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.center}>
        <Empty icon="📊" title="Reportes" subtitle="Análisis de ventas por canal, período y vendedor — próximamente" />
      </div>
    </div>
  )
}

export function Calendar() {
  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.center}>
        <Empty icon="📅" title="Calendario" subtitle="Vista de citas y actividades — próximamente" />
      </div>
    </div>
  )
}

export function Settings() {
  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.center}>
        <Empty icon="⚙️" title="Configuración" subtitle="Ajustes del sistema — próximamente" />
      </div>
    </div>
  )
}
