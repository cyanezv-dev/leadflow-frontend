import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Card, Spinner, Empty } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './InventorySources.module.css'

// ── Constantes ────────────────────────────────────────────────
const TIPOS = [
  { key: 'bodega',             label: 'Bodega Propia',          icon: '🏭', color: '#34d399', prioridad: 10 },
  { key: 'sucursal',           label: 'Sucursal',               icon: '🏪', color: '#60a5fa', prioridad: 20 },
  { key: 'taller',             label: 'Taller con Stock',        icon: '🔧', color: '#fb923c', prioridad: 30 },
  { key: 'proveedor',          label: 'Proveedor (Virtual)',     icon: '📦', color: '#a78bfa', prioridad: 40 },
  { key: 'taller_instalacion', label: 'Taller Solo Instalación', icon: '⚙️', color: '#fbbf24', prioridad: 50 },
]

function getTipo(key) {
  return TIPOS.find(t => t.key === key) || { label: key, icon: '📦', color: '#888' }
}

const FORM_EMPTY = {
  product_id: '', tipo: 'bodega', nombre: '', ubicacion: '', comuna: '',
  cantidad: 0, tiempo_entrega_horas: 24, prioridad: 50,
  permite_instalacion: false, permite_retiro: false, permite_despacho: true,
  activo: true, notas: ''
}

// ── Modal de fuente ───────────────────────────────────────────
function SourceModal({ source, products, onClose, onSave }) {
  const [form, setForm] = useState(source ? {
    product_id: source.product_id, tipo: source.tipo, nombre: source.nombre,
    ubicacion: source.ubicacion || '', comuna: source.comuna || '',
    cantidad: source.cantidad, tiempo_entrega_horas: source.tiempo_entrega_horas,
    prioridad: source.prioridad,
    permite_instalacion: source.permite_instalacion,
    permite_retiro: source.permite_retiro,
    permite_despacho: source.permite_despacho,
    activo: source.activo, notas: source.notas || ''
  } : { ...FORM_EMPTY })

  const [saving, setSaving] = useState(false)
  const [prodSearch, setProdSearch] = useState(source?.product_name || '')

  const filteredProds = (products || []).filter(p =>
    p.name?.toLowerCase().includes(prodSearch.toLowerCase()) ||
    p.brand?.toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 8)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.product_id || !form.nombre) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{source ? 'Editar fuente' : 'Nueva fuente de disponibilidad'}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {/* Producto */}
          <div className={styles.field}>
            <label>Producto *</label>
            <input className={styles.input} placeholder="Buscar producto..."
              value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
            {prodSearch.length > 1 && filteredProds.length > 0 && (
              <div className={styles.dropdown}>
                {filteredProds.map(p => (
                  <div key={p.id} className={`${styles.dropItem} ${form.product_id === p.id ? styles.dropActive : ''}`}
                    onClick={() => { set('product_id', p.id); setProdSearch(`${p.brand} ${p.name}`) }}>
                    <span className={styles.dropName}>{p.brand} {p.name}</span>
                    <span className={styles.dropStock}>Stock: {p.stock}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tipo */}
          <div className={styles.field}>
            <label>Tipo de fuente *</label>
            <div className={styles.tipoGrid}>
              {TIPOS.map(t => (
                <button key={t.key}
                  className={`${styles.tipoBtn} ${form.tipo === t.key ? styles.tipoBtnActive : ''}`}
                  style={form.tipo === t.key ? { borderColor: t.color, background: t.color + '18', color: t.color } : {}}
                  onClick={() => set('tipo', t.key)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label>Nombre *</label>
              <input className={styles.input} placeholder="Ej: Bodega Santiago Centro"
                value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Comuna</label>
              <input className={styles.input} placeholder="Ej: Las Condes"
                value={form.comuna} onChange={e => set('comuna', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Cantidad disponible</label>
              <input className={styles.input} type="number" min="0"
                value={form.cantidad} onChange={e => set('cantidad', parseInt(e.target.value) || 0)} />
            </div>
            <div className={styles.field}>
              <label>Tiempo entrega (horas)</label>
              <input className={styles.input} type="number" min="1"
                value={form.tiempo_entrega_horas} onChange={e => set('tiempo_entrega_horas', parseInt(e.target.value) || 24)} />
            </div>
            <div className={styles.field}>
              <label>Prioridad comercial (1–100)</label>
              <input className={styles.input} type="number" min="1" max="100"
                value={form.prioridad} onChange={e => set('prioridad', parseInt(e.target.value) || 50)} />
              <span className={styles.hint}>Menor número = mayor prioridad dentro del tipo</span>
            </div>
            <div className={styles.field}>
              <label>Dirección / Referencia</label>
              <input className={styles.input} placeholder="Dirección física"
                value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)} />
            </div>
          </div>

          {/* Capacidades */}
          <div className={styles.field}>
            <label>Capacidades</label>
            <div className={styles.checkRow}>
              {[
                { key: 'permite_despacho',    label: '📦 Permite despacho' },
                { key: 'permite_retiro',      label: '🏪 Permite retiro en tienda' },
                { key: 'permite_instalacion', label: '🔧 Permite instalación' },
              ].map(c => (
                <label key={c.key} className={styles.checkLabel}>
                  <input type="checkbox" checked={form[c.key]}
                    onChange={e => set(c.key, e.target.checked)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label>Notas internas</label>
              <input className={styles.input} placeholder="Notas opcionales"
                value={form.notas} onChange={e => set('notas', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Estado</label>
              <label className={styles.checkLabel} style={{ marginTop: 8 }}>
                <input type="checkbox" checked={form.activo}
                  onChange={e => set('activo', e.target.checked)} />
                Fuente activa
              </label>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.saveBtn}
            disabled={saving || !form.product_id || !form.nombre}
            onClick={handleSave}>
            {saving ? 'Guardando...' : source ? 'Guardar cambios' : 'Crear fuente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function InventorySources() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['inventory-sources', filterTipo],
    queryFn: () => api.get('/inventory-sources' + (filterTipo ? `?tipo=${filterTipo}` : '')),
  })

  const { data: summary = [] } = useQuery({
    queryKey: ['inventory-sources-summary'],
    queryFn: () => api.get('/inventory-sources/summary'),
  })

  const { data: catalogData = {} } = useQuery({
    queryKey: ['catalog-for-sources'],
    queryFn: () => api.get('/catalog?active=true&limit=500'),
  })
  const products = catalogData.products || []

  const createMutation = useMutation({
    mutationFn: data => api.post('/inventory-sources', data),
    onSuccess: () => { qc.invalidateQueries(['inventory-sources']); qc.invalidateQueries(['inventory-sources-summary']); showToast('✓ Fuente creada'); setShowModal(false) },
    onError: e => showToast('Error: ' + e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/inventory-sources/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['inventory-sources']); showToast('✓ Fuente actualizada'); setEditing(null) },
    onError: e => showToast('Error: ' + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/inventory-sources/${id}`),
    onSuccess: () => { qc.invalidateQueries(['inventory-sources']); qc.invalidateQueries(['inventory-sources-summary']); showToast('✓ Fuente eliminada') },
    onError: e => showToast('Error: ' + e.message),
  })

  const migrateMutation = useMutation({
    mutationFn: () => api.post('/inventory-sources/migrate', {}),
    onSuccess: d => { qc.invalidateQueries(['inventory-sources']); qc.invalidateQueries(['inventory-sources-summary']); showToast(`✓ Migrados ${d.migrated} productos al stock de bodega`) },
    onError: e => showToast('Error: ' + e.message),
  })

  const filtered = sources.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.nombre?.toLowerCase().includes(q) ||
      s.product_name?.toLowerCase().includes(q) ||
      s.product_brand?.toLowerCase().includes(q) ||
      s.comuna?.toLowerCase().includes(q)
  })

  const stockTotal = summary.reduce((s, r) => s + parseInt(r.stock_total || 0), 0)

  return (
    <div className={styles.page}>
      <Header onSearch={setSearch} actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.migrateBtn}
            onClick={() => { if (window.confirm('¿Migrar stock existente de productos a Bodega Principal?')) migrateMutation.mutate() }}
            disabled={migrateMutation.isPending}>
            {migrateMutation.isPending ? 'Migrando...' : '⬆️ Migrar stock actual'}
          </button>
          <button className={styles.newBtn} onClick={() => setShowModal(true)}>
            ➕ Nueva fuente
          </button>
        </div>
      } />

      <div className={styles.content}>
        {/* Resumen por tipo */}
        <div className={styles.summaryRow}>
          {TIPOS.map(t => {
            const row = summary.find(s => s.tipo === t.key) || {}
            return (
              <div key={t.key} className={`${styles.summaryCard} ${filterTipo === t.key ? styles.summaryActive : ''}`}
                style={filterTipo === t.key ? { borderColor: t.color, background: t.color + '12' } : {}}
                onClick={() => setFilterTipo(prev => prev === t.key ? '' : t.key)}>
                <div className={styles.summaryIcon}>{t.icon}</div>
                <div className={styles.summaryLabel}>{t.label}</div>
                <div className={styles.summaryNum} style={{ color: t.color }}>
                  {parseInt(row.stock_total || 0).toLocaleString('es-CL')}
                </div>
                <div className={styles.summaryMeta}>
                  {row.fuentes_con_stock || 0} fuentes con stock · {row.total_fuentes || 0} total
                </div>
              </div>
            )
          })}
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <span className={styles.count}>{filtered.length} fuente{filtered.length !== 1 ? 's' : ''} · {stockTotal.toLocaleString('es-CL')} uds. totales</span>
          <div className={styles.filters}>
            <button className={`${styles.filterBtn} ${!filterTipo ? styles.filterActive : ''}`}
              onClick={() => setFilterTipo('')}>Todas</button>
            {TIPOS.map(t => (
              <button key={t.key}
                className={`${styles.filterBtn} ${filterTipo === t.key ? styles.filterActive : ''}`}
                style={filterTipo === t.key ? { borderColor: t.color, color: t.color, background: t.color + '18' } : {}}
                onClick={() => setFilterTipo(prev => prev === t.key ? '' : t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <Card className={styles.tableCard}>
          {isLoading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : filtered.length === 0 ? (
            <Empty icon="📦" title="Sin fuentes de disponibilidad"
              subtitle='Usa "Migrar stock actual" para importar el stock existente, o agrega fuentes manualmente' />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Fuente</th>
                    <th>Producto</th>
                    <th>Comuna</th>
                    <th style={{ textAlign: 'center' }}>Cantidad</th>
                    <th style={{ textAlign: 'center' }}>Entrega</th>
                    <th style={{ textAlign: 'center' }}>Prioridad</th>
                    <th>Capacidades</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const tipo = getTipo(s.tipo)
                    return (
                      <tr key={s.id} className={styles.row}>
                        <td>
                          <span className={styles.tipoBadge}
                            style={{ background: tipo.color + '18', color: tipo.color }}>
                            {tipo.icon} {tipo.label}
                          </span>
                        </td>
                        <td>
                          <div className={styles.sourceName}>{s.nombre}</div>
                          {s.ubicacion && <div className={styles.sourceSub}>{s.ubicacion}</div>}
                        </td>
                        <td>
                          <div className={styles.productName}>{s.product_brand} {s.product_name}</div>
                        </td>
                        <td className={styles.meta}>{s.comuna || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={s.cantidad > 0 ? styles.stockOk : styles.stockNo}>
                            {s.cantidad}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }} className={styles.meta}>
                          {s.tiempo_entrega_horas < 24
                            ? `${s.tiempo_entrega_horas}h`
                            : `${Math.round(s.tiempo_entrega_horas / 24)}d`}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={styles.prioridadBadge}>{s.prioridad}</span>
                        </td>
                        <td>
                          <div className={styles.capRow}>
                            {s.permite_despacho    && <span className={styles.cap} title="Despacho">📦</span>}
                            {s.permite_retiro      && <span className={styles.cap} title="Retiro">🏪</span>}
                            {s.permite_instalacion && <span className={styles.cap} title="Instalación">🔧</span>}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={s.activo ? styles.activeTag : styles.inactiveTag}>
                            {s.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <button className={styles.editBtn}
                              onClick={() => setEditing(s)}>✏️</button>
                            <button className={styles.delBtn}
                              onClick={() => { if (window.confirm('¿Eliminar esta fuente?')) deleteMutation.mutate(s.id) }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Info priorización */}
        <Card className={styles.infoCard}>
          <div className={styles.infoTitle}>⚡ Lógica de priorización comercial</div>
          <div className={styles.infoGrid}>
            {TIPOS.map((t, i) => (
              <div key={t.key} className={styles.infoItem}>
                <span className={styles.infoNum} style={{ background: t.color + '20', color: t.color }}>
                  {i + 1}
                </span>
                <span>{t.icon} <strong>{t.label}</strong> — prioridad base {t.prioridad}</span>
              </div>
            ))}
          </div>
          <div className={styles.infoNote}>
            El agente IA y las cotizaciones priorizan automáticamente la fuente con menor número de prioridad que tenga stock disponible.
            Dentro del mismo tipo, el campo "Prioridad comercial" desempata (1 = mayor prioridad).
          </div>
        </Card>
      </div>

      {(showModal || editing) && (
        <SourceModal
          source={editing}
          products={products}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={data => editing
            ? updateMutation.mutateAsync({ id: editing.id, data })
            : createMutation.mutateAsync(data)
          }
        />
      )}

      {toast && (
        <div className={styles.toast}>{toast}</div>
      )}
    </div>
  )
}
