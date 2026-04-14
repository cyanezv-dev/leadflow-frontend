import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast, Modal, Input, Select } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './DeliveryServices.module.css'

const DIAS_SEMANA = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
const TIPOS = [
  { value: 'instalacion_domicilio', label: '🔧 Instalación a domicilio' },
  { value: 'despacho',              label: '🚚 Despacho de neumáticos' },
]

function toggleDia(current, dia) {
  const arr = (current || '').split(',').map(d => d.trim()).filter(Boolean)
  return arr.includes(dia) ? arr.filter(d => d !== dia).join(',') : [...arr, dia].join(',')
}

function ServiceModal({ svc, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre:          svc?.nombre          || '',
    descripcion:     svc?.descripcion     || '',
    tipo:            svc?.tipo            || 'instalacion_domicilio',
    radio_km:        svc?.radio_km        ?? 30,
    lat_base:        svc?.lat_base        || '',
    lng_base:        svc?.lng_base        || '',
    comunas:         svc?.comunas         || '',
    precio_base:     svc?.precio_base     ?? 0,
    precio_por_km:   svc?.precio_por_km   ?? 0,
    dias_disponibles:svc?.dias_disponibles|| 'lunes,martes,miércoles,jueves,viernes',
    hora_inicio:     svc?.hora_inicio     || '09:00',
    hora_fin:        svc?.hora_fin        || '18:00',
    notas:           svc?.notas           || '',
    activo:          svc?.activo          !== false,
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      if (svc?.id) await api.put(`/delivery-services/${svc.id}`, form)
      else         await api.post('/delivery-services', form)
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={svc?.id ? 'Editar servicio de instalación' : 'Nuevo servicio de instalación'}
      onClose={onClose}
      width={640}
    >
      {/* Sección principal */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>📋 Información general</div>
        <div className={styles.grid2}>
          <div style={{ gridColumn: '1/-1' }}>
            <Input label="Nombre del servicio *" placeholder="Ej: Instalación a domicilio RM"
              value={form.nombre} onChange={e => set('nombre', e.target.value)} />
          </div>
          <Select label="Tipo" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Input label="Radio de cobertura (km)" type="number" placeholder="30"
            value={form.radio_km} onChange={e => set('radio_km', e.target.value)} />
          <div style={{ gridColumn: '1/-1' }}>
            <Input label="Descripción" placeholder="Descripción del servicio"
              value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Precios */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>💰 Precios</div>
        <div className={styles.grid2}>
          <Input label="Precio base ($)" type="number" placeholder="15000"
            value={form.precio_base} onChange={e => set('precio_base', e.target.value)} />
          <Input label="Precio por km adicional ($)" type="number" placeholder="0"
            value={form.precio_por_km} onChange={e => set('precio_por_km', e.target.value)} />
        </div>
      </div>

      {/* Ubicación base */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>📍 Punto de origen (bodega / base)</div>
        <div className={styles.grid2}>
          <Input label="Latitud" type="number" placeholder="-33.4372" step="any"
            value={form.lat_base} onChange={e => set('lat_base', e.target.value)} />
          <Input label="Longitud" type="number" placeholder="-70.6506" step="any"
            value={form.lng_base} onChange={e => set('lng_base', e.target.value)} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
          Las coordenadas definen el punto desde donde se calcula el radio de cobertura. Puedes obtenerlas desde Google Maps (clic derecho → ¿Qué hay aquí?).
        </div>
      </div>

      {/* Disponibilidad */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>🗓️ Disponibilidad</div>
        <div className={styles.diasRow}>
          {DIAS_SEMANA.map(dia => {
            const activo = (form.dias_disponibles || '').split(',').map(d => d.trim()).includes(dia)
            return (
              <button
                key={dia}
                type="button"
                className={`${styles.diaBtn} ${activo ? styles.diaBtnOn : ''}`}
                onClick={() => set('dias_disponibles', toggleDia(form.dias_disponibles, dia))}
              >
                {dia.slice(0, 3)}
              </button>
            )
          })}
        </div>
        <div className={styles.grid2} style={{ marginTop: 10 }}>
          <Input label="Hora inicio" type="time" value={form.hora_inicio}
            onChange={e => set('hora_inicio', e.target.value)} />
          <Input label="Hora fin" type="time" value={form.hora_fin}
            onChange={e => set('hora_fin', e.target.value)} />
        </div>
      </div>

      {/* Notas */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>📝 Notas internas</div>
        <Input label="" placeholder="Restricciones, condiciones, zonas especiales..."
          value={form.notas} onChange={e => set('notas', e.target.value)} />
      </div>

      {/* Actions */}
      <div className={styles.modalFooter}>
        <label className={styles.activeToggle}>
          <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)} />
          Servicio activo
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving} disabled={!form.nombre.trim()}>
            {svc?.id ? '💾 Guardar' : '✓ Crear servicio'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function DeliveryServices() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['delivery-services'],
    queryFn: () => api.get('/delivery-services'),
  })

  const refresh = () => qc.invalidateQueries(['delivery-services'])

  const filtered = services.filter(s =>
    !search || s.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (s.descripcion || '').toLowerCase().includes(search.toLowerCase())
  )

  const toggleActivo = async (svc) => {
    await api.put(`/delivery-services/${svc.id}`, { ...svc, activo: !svc.activo })
    refresh()
  }

  const deleteSvc = async (id) => {
    if (!confirm('¿Eliminar este servicio?')) return
    await api.delete(`/delivery-services/${id}`)
    refresh()
    showToast('Servicio eliminado')
  }

  const tipoLabel = tipo => TIPOS.find(t => t.value === tipo)?.label || tipo

  return (
    <div className={styles.page}>
      <Header
        onSearch={setSearch}
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>➕ Nuevo servicio</Button>
        }
      />

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statN}>{services.filter(s => s.activo).length}</span>
            <span className={styles.statL}>Servicios activos</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statN}>{services.filter(s => s.tipo === 'instalacion_domicilio').length}</span>
            <span className={styles.statL}>Instalación domicilio</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statN}>{services.filter(s => s.tipo === 'despacho').length}</span>
            <span className={styles.statL}>Despacho</span>
          </div>
        </div>

        <Card className={styles.listCard}>
          {isLoading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : filtered.length === 0 ? (
            <Empty icon="🚚" title="Sin servicios" subtitle='Crea el primer servicio con "+ Nuevo servicio"' />
          ) : (
            <div className={styles.list}>
              {filtered.map(svc => (
                <div key={svc.id} className={`${styles.row} ${!svc.activo ? styles.rowInactive : ''}`}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{svc.nombre}</div>
                    <div className={styles.rowMeta}>
                      <span className={styles.tipoBadge}>{tipoLabel(svc.tipo)}</span>
                      <span className={styles.metaChip}>📍 Radio: {svc.radio_km ?? 30} km</span>
                      {svc.precio_base > 0 && (
                        <span className={styles.metaChip}>💰 {fmt.currency(svc.precio_base)}</span>
                      )}
                      {svc.precio_por_km > 0 && (
                        <span className={styles.metaChip}>+{fmt.currency(svc.precio_por_km)}/km</span>
                      )}
                      {(svc.lat_base && svc.lng_base) ? (
                        <span className={styles.metaChip} style={{ color: 'var(--green)' }}>
                          ✓ Coordenadas OK
                        </span>
                      ) : (
                        <span className={styles.metaChip} style={{ color: 'var(--orange)' }}>
                          ⚠️ Sin coordenadas
                        </span>
                      )}
                    </div>
                    {svc.descripcion && (
                      <div className={styles.rowDesc}>{svc.descripcion}</div>
                    )}
                    <div className={styles.rowDias}>
                      {DIAS_SEMANA.map(dia => {
                        const on = (svc.dias_disponibles || '').split(',').map(d => d.trim()).includes(dia)
                        return (
                          <span key={dia} className={`${styles.diaTag} ${on ? styles.diaTagOn : ''}`}>
                            {dia.slice(0, 3)}
                          </span>
                        )
                      })}
                      <span className={styles.horario}>{svc.hora_inicio} – {svc.hora_fin}</span>
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button className={styles.actionBtn} onClick={() => setEditing(svc)} title="Editar">✏️</button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => toggleActivo(svc)}
                      title={svc.activo ? 'Desactivar' : 'Activar'}
                    >
                      {svc.activo ? '👁️' : '🚫'}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.delBtn}`}
                      onClick={() => deleteSvc(svc.id)}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Info box */}
        <div className={styles.infoBox}>
          <div className={styles.infoTitle}>ℹ️ ¿Cómo funciona?</div>
          <ul className={styles.infoList}>
            <li>Los servicios de instalación a domicilio aparecen en la tienda cuando el cliente está dentro del radio de cobertura.</li>
            <li>Si no hay ningún taller disponible en 50 km, el sistema ofrece automáticamente los servicios de despacho activos.</li>
            <li>Las coordenadas del punto de origen son necesarias para calcular el radio de cobertura. Sin ellas el servicio se muestra siempre.</li>
          </ul>
        </div>
      </div>

      {showNew && (
        <ServiceModal
          onClose={() => setShowNew(false)}
          onSaved={() => { refresh(); showToast('Servicio creado') }}
        />
      )}
      {editing && (
        <ServiceModal
          svc={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { refresh(); showToast('Servicio actualizado') }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
