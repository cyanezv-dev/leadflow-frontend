import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Modal, Select } from '@/components/ui'
import api from '@/utils/api'
import styles from './Despachos.module.css'

const ESTADOS = ['PENDIENTE', 'EN_BODEGA', 'EN_TRANSITO', 'EN_REPARTO', 'ENTREGADO', 'FALLIDO', 'DEVUELTO']

const ESTADO_META = {
  PENDIENTE:   { label: 'Pendiente',    color: '#f59e0b', bg: '#fef3c7' },
  EN_BODEGA:   { label: 'En bodega',    color: '#6366f1', bg: '#ede9fe' },
  EN_TRANSITO: { label: 'En tránsito',  color: '#3b82f6', bg: '#dbeafe' },
  EN_REPARTO:  { label: 'En reparto',   color: '#8b5cf6', bg: '#ede9fe' },
  ENTREGADO:   { label: 'Entregado',    color: '#10b981', bg: '#d1fae5' },
  FALLIDO:     { label: 'Fallido',      color: '#ef4444', bg: '#fee2e2' },
  DEVUELTO:    { label: 'Devuelto',     color: '#f97316', bg: '#ffedd5' },
}

function EstadoBadge({ estado }) {
  const m = ESTADO_META[estado] || { label: estado, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span className={styles.badge} style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  )
}

function TrackingModal({ despacho, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['despacho-tracking', despacho.id],
    queryFn: () => api.get(`/despachos/${despacho.id}/tracking`),
  })

  const eventos = data?.data?.eventos || []

  return (
    <Modal title={`Tracking — ${despacho.courier_nombre || despacho.courier_codigo}`} onClose={onClose} width={560}>
      <div className={styles.trackHeader}>
        <div>
          <div className={styles.trackOT}>{despacho.orden_transporte_num || 'Sin OT asignado'}</div>
          <div className={styles.trackSub}>Destino: {despacho.nombre_destinatario} · {despacho.comuna_destino}</div>
        </div>
        <EstadoBadge estado={despacho.estado} />
      </div>

      {despacho.tracking_numero && (
        <div className={styles.trackNum}>
          📦 Tracking: <strong>{despacho.tracking_numero}</strong>
        </div>
      )}

      {isLoading ? <Spinner /> : eventos.length === 0 ? (
        <Empty icon="📭" title="Sin eventos de tracking aún" />
      ) : (
        <div className={styles.timeline}>
          {eventos.map((ev, i) => {
            const m = ESTADO_META[ev.estado_interno] || {}
            return (
              <div key={ev.id} className={`${styles.timelineItem} ${i === 0 ? styles.timelineFirst : ''}`}>
                <div className={styles.timelineDot} style={{ background: m.color || '#94a3b8' }} />
                <div className={styles.timelineContent}>
                  <div className={styles.timelineEstado} style={{ color: m.color }}>
                    {m.label || ev.estado_interno}
                    {ev.estado_courier && <span className={styles.timelineRaw}> ({ev.estado_courier})</span>}
                  </div>
                  {ev.descripcion && <div className={styles.timelineDesc}>{ev.descripcion}</div>}
                  {ev.ubicacion && <div className={styles.timelineLoc}>📍 {ev.ubicacion}</div>}
                  <div className={styles.timelineDate}>
                    {new Date(ev.evento_at).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

function EstadoModal({ despacho, onClose, onSaved }) {
  const qc = useQueryClient()
  const [estado, setEstado] = useState(despacho.estado)
  const [ot, setOt] = useState(despacho.orden_transporte_num || '')
  const [tracking, setTracking] = useState(despacho.tracking_numero || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/despachos/${despacho.id}/estado`, {
        estado, orden_transporte_num: ot || undefined, tracking_numero: tracking || undefined,
      })
      qc.invalidateQueries(['despachos'])
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Actualizar estado del despacho" onClose={onClose} width={440}>
      <div className={styles.formGrid}>
        <Select label="Estado" value={estado} onChange={e => setEstado(e.target.value)}>
          {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_META[s]?.label || s}</option>)}
        </Select>
        <div>
          <label className={styles.fieldLabel}>N° Orden de transporte</label>
          <input className={styles.input} value={ot} onChange={e => setOt(e.target.value)} placeholder="Ej: 1234567890" />
        </div>
        <div>
          <label className={styles.fieldLabel}>Número de tracking</label>
          <input className={styles.input} value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Código de seguimiento" />
        </div>
      </div>
      <div className={styles.modalFooter}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </Modal>
  )
}

export default function Despachos() {
  const qc = useQueryClient()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [trackingDespacho, setTrackingDespacho] = useState(null)
  const [estadoDespacho, setEstadoDespacho] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['despachos', filtroEstado],
    queryFn: () => {
      const q = filtroEstado ? `?estado=${filtroEstado}` : ''
      return api.get(`/despachos${q}`)
    },
  })

  const despachos = data?.data || []

  const stats = {
    total:      despachos.length,
    pendientes: despachos.filter(d => d.estado === 'PENDIENTE').length,
    transito:   despachos.filter(d => ['EN_TRANSITO','EN_REPARTO'].includes(d.estado)).length,
    entregados: despachos.filter(d => d.estado === 'ENTREGADO').length,
    fallidos:   despachos.filter(d => ['FALLIDO','DEVUELTO'].includes(d.estado)).length,
  }

  return (
    <div className={styles.page}>
      <Header title="Despachos" subtitle="Seguimiento de envíos por courier" />

      {/* Stats */}
      <div className={styles.stats}>
        {[
          { label: 'Total',       value: stats.total,      color: 'var(--text1)' },
          { label: 'Pendientes',  value: stats.pendientes, color: '#f59e0b' },
          { label: 'En tránsito', value: stats.transito,   color: '#3b82f6' },
          { label: 'Entregados',  value: stats.entregados, color: '#10b981' },
          { label: 'Fallidos',    value: stats.fallidos,   color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className={styles.toolbar}>
        <select className={styles.filterSelect} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_META[s]?.label || s}</option>)}
        </select>
        <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries(['despachos'])}>↺ Actualizar</Button>
      </div>

      {/* Lista */}
      {isLoading ? <Spinner /> : despachos.length === 0 ? (
        <Empty icon="🚚" title="No hay despachos" subtitle="Los despachos creados desde el cotizador aparecerán aquí." />
      ) : (
        <div className={styles.list}>
          {despachos.map(d => (
            <div key={d.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>
                  {d.nombre_destinatario || '—'}
                  <EstadoBadge estado={d.estado} />
                </div>
                <div className={styles.rowMeta}>
                  <span>🚚 {d.courier_nombre || d.courier_codigo}</span>
                  {d.orden_transporte_num && <span>OT: <strong>{d.orden_transporte_num}</strong></span>}
                  {d.tracking_numero && <span>📦 {d.tracking_numero}</span>}
                  <span>📍 {d.comuna_destino}</span>
                  {d.costo_final && <span>💰 ${Number(d.costo_final).toLocaleString('es-CL')}</span>}
                  <span className={styles.rowDate}>{new Date(d.created_at).toLocaleDateString('es-CL')}</span>
                </div>
                {d.direccion_destino && (
                  <div className={styles.rowAddr}>{d.direccion_destino}</div>
                )}
              </div>
              <div className={styles.rowActions}>
                <Button size="sm" variant="ghost" onClick={() => setTrackingDespacho(d)}>📍 Tracking</Button>
                <Button size="sm" variant="outline" onClick={() => setEstadoDespacho(d)}>✏️ Estado</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {trackingDespacho && (
        <TrackingModal despacho={trackingDespacho} onClose={() => setTrackingDespacho(null)} />
      )}
      {estadoDespacho && (
        <EstadoModal
          despacho={estadoDespacho}
          onClose={() => setEstadoDespacho(null)}
          onSaved={() => setEstadoDespacho(null)}
        />
      )}
    </div>
  )
}
