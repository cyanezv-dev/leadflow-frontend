import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { Card, Spinner, Empty, Avatar } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './Orders.module.css'

// ── Flujo de estados ──────────────────────────────────────────
const ESTADOS = [
  { key: 'pendiente_pago',      label: 'Pendiente de Pago',      icon: '⏳', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  { key: 'pagado',              label: 'Pagado',                  icon: '✅', color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  { key: 'comprado_proveedor',  label: 'Comprado a Proveedor',    icon: '🛒', color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  { key: 'retirar_proveedor',   label: 'Retirar en Proveedor',    icon: '🏭', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  { key: 'recepcion_bodega',    label: 'Recepción Bodega',        icon: '📥', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { key: 'preparacion_pedido',  label: 'Preparación del Pedido',  icon: '📦', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  { key: 'listo_despacho',      label: 'Listo para Despacho',     icon: '🚚', color: '#4f7cff', bg: 'rgba(79,124,255,0.12)'  },
  { key: 'entregado_taller',    label: 'Entregado en Taller',     icon: '🔧', color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  { key: 'despachado_domicilio',label: 'Despachado a Domicilio',  icon: '🏠', color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  { key: 'cancelada',           label: 'Cancelada',               icon: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
]

// Estados que son finales (no avanzan más)
const ESTADOS_FINALES = ['entregado_taller', 'despachado_domicilio', 'cancelada']

// Campos requeridos por estado destino
const CAMPOS_POR_ESTADO = {
  comprado_proveedor: [
    { key: 'oc_proveedor',        label: 'OC enviada al proveedor',    placeholder: 'Ej: OC-2024-001' },
    { key: 'nro_orden_proveedor', label: 'N° de orden del proveedor',  placeholder: 'N° que entrega el proveedor' },
  ],
  retirar_proveedor: [
    { key: 'factura_proveedor',   label: 'Orden de despacho / Factura proveedor', placeholder: 'N° factura o documento' },
  ],
  listo_despacho: 'despacho_especial',
  entregado_taller: 'entrega_final',
  despachado_domicilio: 'entrega_final',
}

function getEstado(key) {
  return ESTADOS.find(e => e.key === key) || ESTADOS[0]
}

function getIndexEstado(key) {
  const idx = ESTADOS.findIndex(e => e.key === key)
  return idx === -1 ? 0 : idx
}

function getSiguienteEstado(key) {
  const idx = getIndexEstado(key)
  const siguientes = ESTADOS.filter(e => !ESTADOS_FINALES.includes(e.key))
  const currentIdx = siguientes.findIndex(e => e.key === key)
  if (currentIdx === -1 || currentIdx >= siguientes.length - 1) return null
  return siguientes[currentIdx + 1]
}

// ── Panel de detalle / avance ─────────────────────────────────
function OrderPanel({ order, onClose, onUpdate }) {
  const [formData, setFormData] = useState({})
  const [tipoDespacho, setTipoDespacho] = useState(order.tipo_despacho || '')
  const [tipoEntrega, setTipoEntrega] = useState('')
  const [saving, setSaving] = useState(false)

  const estadoActual = getEstado(order.status)
  const siguienteEstado = getSiguienteEstado(order.status)
  const esFinal = ESTADOS_FINALES.includes(order.status)
  const camposRequeridos = siguienteEstado ? CAMPOS_POR_ESTADO[siguienteEstado.key] : null

  const idxActual = ESTADOS.filter(e => !ESTADOS_FINALES.includes(e.key))
    .findIndex(e => e.key === order.status)

  async function avanzar() {
    if (!siguienteEstado) return
    setSaving(true)
    try {
      const payload = { status: siguienteEstado.key, ...formData }
      if (camposRequeridos === 'despacho_especial') {
        payload.tipo_despacho = tipoDespacho
        payload.status = siguienteEstado.key
      }
      if (camposRequeridos === 'entrega_final') {
        payload.tipo_entrega = tipoEntrega
        payload.status = tipoEntrega === 'taller' ? 'entregado_taller' : 'despachado_domicilio'
      }
      await onUpdate(order.id, payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function cancelar() {
    setSaving(true)
    try {
      await onUpdate(order.id, { status: 'cancelada' })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const flujoLineal = ESTADOS.filter(e => !ESTADOS_FINALES.includes(e.key))
  const progreso = Math.round((idxActual / (flujoLineal.length - 1)) * 100)

  return (
    <div className={styles.panelOverlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        {/* Header panel */}
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelOrderNum}>{order.nro_orden}</div>
            <div className={styles.panelClient}>{order.lead_name || '—'} · {order.phone || ''}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Producto */}
        <div className={styles.panelSection}>
          <div className={styles.panelGrid}>
            <div className={styles.panelField}><span>Producto</span><strong>{order.marca} {order.modelo}</strong></div>
            <div className={styles.panelField}><span>Medida</span><strong>{order.medida || '—'}</strong></div>
            <div className={styles.panelField}><span>Cantidad</span><strong>{order.cantidad}</strong></div>
            <div className={styles.panelField}><span>Total</span><strong>{fmt.currency(order.total)}</strong></div>
            <div className={styles.panelField}><span>Servicio</span><strong>{order.tipo_servicio || '—'}</strong></div>
            <div className={styles.panelField}><span>Comuna</span><strong>{order.comuna || '—'}</strong></div>
          </div>
        </div>

        {/* Estado actual */}
        <div className={styles.panelSection}>
          <div className={styles.sectionTitle}>Estado actual</div>
          <div className={styles.estadoActual}
            style={{ background: estadoActual.bg, borderColor: estadoActual.color }}>
            <span>{estadoActual.icon}</span>
            <span style={{ color: estadoActual.color, fontWeight: 700 }}>{estadoActual.label}</span>
          </div>

          {/* Barra de progreso */}
          {!esFinal && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progreso}%` }} />
            </div>
          )}
        </div>

        {/* Datos ya registrados */}
        {(order.oc_proveedor || order.nro_orden_proveedor || order.factura_proveedor || order.nro_seguimiento) && (
          <div className={styles.panelSection}>
            <div className={styles.sectionTitle}>Datos de seguimiento</div>
            <div className={styles.panelGrid}>
              {order.oc_proveedor        && <div className={styles.panelField}><span>OC Proveedor</span><strong>{order.oc_proveedor}</strong></div>}
              {order.nro_orden_proveedor && <div className={styles.panelField}><span>N° Orden Proveedor</span><strong>{order.nro_orden_proveedor}</strong></div>}
              {order.factura_proveedor   && <div className={styles.panelField}><span>Factura / Despacho</span><strong>{order.factura_proveedor}</strong></div>}
              {order.tipo_despacho       && <div className={styles.panelField}><span>Tipo despacho</span><strong>{order.tipo_despacho}</strong></div>}
              {order.nro_seguimiento     && <div className={styles.panelField}><span>N° Seguimiento</span><strong>{order.nro_seguimiento}</strong></div>}
            </div>
          </div>
        )}

        {/* Avanzar estado */}
        {!esFinal && siguienteEstado && (
          <div className={styles.panelSection}>
            <div className={styles.sectionTitle}>Avanzar a: {siguienteEstado.icon} {siguienteEstado.label}</div>

            {/* Campos simples */}
            {Array.isArray(camposRequeridos) && camposRequeridos.map(campo => (
              <div key={campo.key} className={styles.inputGroup}>
                <label>{campo.label}</label>
                <input
                  type="text"
                  placeholder={campo.placeholder}
                  value={formData[campo.key] || ''}
                  onChange={e => setFormData(p => ({ ...p, [campo.key]: e.target.value }))}
                  className={styles.input}
                />
              </div>
            ))}

            {/* Despacho especial */}
            {camposRequeridos === 'despacho_especial' && (
              <>
                <div className={styles.inputGroup}>
                  <label>Tipo de transporte</label>
                  <div className={styles.btnGroup}>
                    <button
                      className={`${styles.optBtn} ${tipoDespacho === 'propio' ? styles.optBtnActive : ''}`}
                      onClick={() => setTipoDespacho('propio')}>
                      🚗 Transporte propio
                    </button>
                    <button
                      className={`${styles.optBtn} ${tipoDespacho === 'courier' ? styles.optBtnActive : ''}`}
                      onClick={() => setTipoDespacho('courier')}>
                      📮 Courier
                    </button>
                  </div>
                </div>
                {tipoDespacho === 'courier' && (
                  <div className={styles.inputGroup}>
                    <label>N° de recibo / tracking courier</label>
                    <input
                      type="text"
                      placeholder="Ingresa el número de seguimiento"
                      value={formData.nro_seguimiento || ''}
                      onChange={e => setFormData(p => ({ ...p, nro_seguimiento: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                )}
              </>
            )}

            {/* Entrega final */}
            {camposRequeridos === 'entrega_final' && (
              <div className={styles.inputGroup}>
                <label>Tipo de entrega</label>
                <div className={styles.btnGroup}>
                  <button
                    className={`${styles.optBtn} ${tipoEntrega === 'taller' ? styles.optBtnActive : ''}`}
                    onClick={() => setTipoEntrega('taller')}>
                    🔧 Entregado en Taller
                  </button>
                  <button
                    className={`${styles.optBtn} ${tipoEntrega === 'domicilio' ? styles.optBtnActive : ''}`}
                    onClick={() => setTipoEntrega('domicilio')}>
                    🏠 Despachado a Domicilio
                  </button>
                </div>
              </div>
            )}

            <button
              className={styles.advanceBtn}
              onClick={avanzar}
              disabled={saving ||
                (camposRequeridos === 'despacho_especial' && !tipoDespacho) ||
                (camposRequeridos === 'entrega_final' && !tipoEntrega)
              }
              style={{ background: siguienteEstado.color }}>
              {saving ? 'Guardando...' : `Avanzar → ${siguienteEstado.label}`}
            </button>
          </div>
        )}

        {/* Estado final */}
        {esFinal && (
          <div className={styles.panelSection}>
            <div className={styles.estadoActual} style={{ background: estadoActual.bg, borderColor: estadoActual.color }}>
              <span>{estadoActual.icon}</span>
              <span style={{ color: estadoActual.color }}>Orden {estadoActual.label.toLowerCase()} — proceso completado</span>
            </div>
          </div>
        )}

        {/* Cancelar orden */}
        {!esFinal && (
          <div className={styles.panelFooter}>
            <button className={styles.cancelOrderBtn} onClick={cancelar} disabled={saving}>
              Cancelar orden
            </button>
            <button className={styles.leadBtn} onClick={onClose}>
              Ver lead
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────
export default function Orders() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selected, setSelected] = useState(null)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', filterStatus],
    queryFn: () => api.get('/orders' + (filterStatus ? `?status=${filterStatus}` : '')),
  })

  const mutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/orders/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries(['orders']),
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

  const totalVentas   = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0)
  const totalUnidades = orders.reduce((s, o) => s + parseInt(o.cantidad || 0), 0)
  const pendientesPago = orders.filter(o => o.status === 'pendiente_pago' || o.status === 'pendiente').length
  const entregadas    = orders.filter(o => o.status === 'entregado_taller' || o.status === 'despachado_domicilio').length

  return (
    <div className={styles.page}>
      <Header onSearch={setSearch} />

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statIcon} style={{ background: 'rgba(79,124,255,0.1)', color: '#4f7cff' }}>📦</div>
            <div><div className={styles.statNum}>{orders.length}</div><div className={styles.statLabel}>Total órdenes</div></div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statIcon} style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>⏳</div>
            <div><div className={styles.statNum}>{pendientesPago}</div><div className={styles.statLabel}>Pendientes de pago</div></div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statIcon} style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>🔢</div>
            <div><div className={styles.statNum}>{totalUnidades}</div><div className={styles.statLabel}>Unidades vendidas</div></div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statIcon} style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>✅</div>
            <div><div className={styles.statNum}>{entregadas}</div><div className={styles.statLabel}>Entregadas</div></div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statIcon} style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>💰</div>
            <div><div className={styles.statNum}>{fmt.currency(totalVentas)}</div><div className={styles.statLabel}>Total ventas</div></div>
          </div>
        </div>

        {/* Filtros de estado */}
        <div className={styles.toolbar}>
          <span className={styles.count}>{filtered.length} orden{filtered.length !== 1 ? 'es' : ''}</span>
          <div className={styles.filters}>
            <button
              className={`${styles.filterBtn} ${filterStatus === '' ? styles.filterActive : ''}`}
              onClick={() => setFilterStatus('')}>Todas</button>
            {ESTADOS.map(e => (
              <button
                key={e.key}
                className={`${styles.filterBtn} ${filterStatus === e.key ? styles.filterActive : ''}`}
                onClick={() => setFilterStatus(e.key)}
                style={filterStatus === e.key ? { borderColor: e.color, color: e.color, background: e.bg } : {}}>
                {e.icon} {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
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
                    <th>Contacto</th>
                    <th>Producto</th>
                    <th>Medida</th>
                    <th style={{ textAlign: 'center' }}>Cant.</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Servicio</th>
                    <th>Comuna</th>
                    <th>Estado</th>
                    <th>Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const st = getEstado(o.status)
                    return (
                      <tr key={o.id} className={styles.row} onClick={() => setSelected(o)}>
                        <td><span className={styles.orderNum}>{o.nro_orden}</span></td>
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
                        <td className={`${styles.mono} ${styles.right} ${styles.totalCol}`}>{fmt.currency(o.total)}</td>
                        <td className={styles.service}>{o.tipo_servicio || '—'}</td>
                        <td className={styles.comuna}>{o.comuna || '—'}</td>
                        <td>
                          <span className={styles.statusBadge} style={{ background: st.bg, color: st.color }}>
                            {st.icon} {st.label}
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

      {/* Panel lateral */}
      {selected && (
        <OrderPanel
          order={selected}
          onClose={() => setSelected(null)}
          onUpdate={(id, data) => mutation.mutateAsync({ id, data })}
        />
      )}
    </div>
  )
}
