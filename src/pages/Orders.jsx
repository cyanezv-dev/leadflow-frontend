import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { Card, Spinner, Empty, Avatar } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './Orders.module.css'

const STATUS_COLORS = {
  confirmada: { color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  pendiente:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  entregada:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  cancelada:  { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
}

export default function Orders() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', search, filterStatus],
    queryFn: () => api.get('/orders' + (filterStatus ? `?status=${filterStatus}` : '')),
  })

  const filtered = orders.filter(o => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      o.nro_orden?.toLowerCase().includes(s) ||
      o.lead_name?.toLowerCase().includes(s) ||
      o.phone?.toLowerCase().includes(s) ||
      o.marca?.toLowerCase().includes(s) ||
      o.medida?.toLowerCase().includes(s) ||
      o.comuna?.toLowerCase().includes(s)
    )
  })

  const totalVentas = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0)
  const totalUnidades = orders.reduce((s, o) => s + parseInt(o.cantidad || 0), 0)

  return (
    <div className={styles.page}>
      <Header onSearch={setSearch} />

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statIcon} style={{ background: 'rgba(79,124,255,0.1)', color: '#4f7cff' }}>📦</div>
            <div>
              <div className={styles.statNum}>{orders.length}</div>
              <div className={styles.statLabel}>Total órdenes</div>
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statIcon} style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>✅</div>
            <div>
              <div className={styles.statNum}>{orders.filter(o => o.status === 'confirmada').length}</div>
              <div className={styles.statLabel}>Confirmadas</div>
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statIcon} style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>🔢</div>
            <div>
              <div className={styles.statNum}>{totalUnidades}</div>
              <div className={styles.statLabel}>Unidades vendidas</div>
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statIcon} style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>💰</div>
            <div>
              <div className={styles.statNum}>{fmt.currency(totalVentas)}</div>
              <div className={styles.statLabel}>Total ventas</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.toolbar}>
          <span className={styles.count}>{filtered.length} orden{filtered.length !== 1 ? 'es' : ''}</span>
          <div className={styles.filters}>
            {['', 'confirmada', 'pendiente', 'entregada', 'cancelada'].map(s => (
              <button
                key={s}
                className={`${styles.filterBtn} ${filterStatus === s ? styles.filterActive : ''}`}
                onClick={() => setFilterStatus(s)}
                style={filterStatus === s && s ? {
                  borderColor: STATUS_COLORS[s]?.color,
                  color: STATUS_COLORS[s]?.color,
                  background: STATUS_COLORS[s]?.bg,
                } : {}}
              >
                {s || 'Todas'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card className={styles.tableCard}>
          {isLoading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : filtered.length === 0 ? (
            <Empty icon="📦" title="Sin órdenes" subtitle="Las órdenes del agente aparecerán aquí automáticamente" />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>N° Orden</th>
                    <th>Canal</th>
                    <th>Contacto</th>
                    <th>Producto</th>
                    <th>Medida</th>
                    <th style={{ textAlign: 'center' }}>Cant.</th>
                    <th style={{ textAlign: 'right' }}>P. Unit.</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Servicio</th>
                    <th>Comuna</th>
                    <th>Fecha entrega</th>
                    <th>Estado</th>
                    <th>Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const st = STATUS_COLORS[o.status] || STATUS_COLORS.confirmada
                    return (
                      <tr
                        key={o.id}
                        className={styles.row}
                        onClick={() => o.lead_id && navigate(`/leads/${o.lead_id}`)}
                      >
                        <td>
                          <span className={styles.orderNum}>{o.nro_orden}</span>
                        </td>
                        <td>
                          <span className={styles.channelBadge} style={{background: o.channel==='WhatsApp'?'rgba(37,211,102,0.1)':o.channel==='Instagram'?'rgba(225,48,108,0.1)':'rgba(79,124,255,0.1)', color: o.channel==='WhatsApp'?'#25d366':o.channel==='Instagram'?'#e1306c':'#4f7cff'}}>{o.channel||'WhatsApp'}</span>
                        </td>
                        <td>
                          <div className={styles.contactCell}>
                            <Avatar name={o.lead_name || '?'} size="xs" />
                            <div>
                              <div className={styles.contactName}>{o.lead_name || '—'}</div>
                              {o.phone && <div className={styles.contactPhone}>{o.phone}</div>}
                            </div>
                          </div>
                        </td>
                        <td className={styles.product}>{o.marca} {o.modelo}</td>
                        <td className={styles.mono}>{o.medida || '—'}</td>
                        <td className={`${styles.mono} ${styles.center}`}>{o.cantidad || '—'}</td>
                        <td className={`${styles.mono} ${styles.right}`}>{fmt.currency(o.precio_unitario)}</td>
                        <td className={`${styles.mono} ${styles.right} ${styles.totalCol}`}>{fmt.currency(o.total)}</td>
                        <td className={styles.service}>{o.tipo_servicio || '—'}</td>
                        <td className={styles.comuna}>{o.comuna || '—'}</td>
                        <td className={styles.date}>{o.fecha_entrega || '—'}</td>
                        <td>
                          <span className={styles.statusBadge}
                            style={{ background: st.bg, color: st.color }}>
                            {o.status}
                          </span>
                        </td>
                        <td className={styles.date}>{fmt.timeAgo(o.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
