import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast, Modal, Input, Select } from '@/components/ui'
import { ComunaInput } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './DeliveryServices.module.css'

// ── Mapa de cobertura con Leaflet ────────────────────────────
function CoverageMap({ lat, lng, radioKm }) {
  const mapRef   = useRef(null)
  const leafRef  = useRef(null)   // instancia del mapa
  const circleRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    let mounted = true
    import('leaflet').then(L => {
      if (!mounted || !mapRef.current) return
      // Fix icono por defecto (problema conocido con Vite + Leaflet)
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!leafRef.current) {
        leafRef.current = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 18,
        }).addTo(leafRef.current)
      }

      const map = leafRef.current
      const hasCoords = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))
      const clat = hasCoords ? parseFloat(lat) : -33.45
      const clng = hasCoords ? parseFloat(lng) : -70.65
      const km   = parseFloat(radioKm) || 30

      // Limpiar capas anteriores
      if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null }
      if (circleRef.current) { map.removeLayer(circleRef.current); circleRef.current = null }

      if (hasCoords) {
        markerRef.current = L.marker([clat, clng]).addTo(map)
          .bindPopup('📍 Punto de origen').openPopup()
        circleRef.current = L.circle([clat, clng], {
          radius: km * 1000,
          color: '#2563eb',
          fillColor: '#2563eb',
          fillOpacity: 0.12,
          weight: 2,
        }).addTo(map)
        map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] })
      } else {
        map.setView([clat, clng], 10)
      }
    })
    return () => { mounted = false }
  }, [lat, lng, radioKm])

  useEffect(() => {
    return () => {
      if (leafRef.current) { leafRef.current.remove(); leafRef.current = null }
    }
  }, [])

  return (
    <div className={styles.mapWrap}>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} className={styles.mapEl} />
      {(!lat || !lng) && (
        <div className={styles.mapPlaceholder}>
          Ingresa las coordenadas del punto de origen para ver la zona de cobertura
        </div>
      )}
    </div>
  )
}

// ── Selector de comunas múltiples ────────────────────────────
function ComunasMultiSelect({ value, onChange }) {
  const comunas = value ? value.split('|').map(c => c.trim()).filter(Boolean) : []
  const [input, setInput] = useState('')

  const add = (nombre) => {
    if (!nombre || comunas.includes(nombre)) return
    onChange([...comunas, nombre].join('|'))
    setInput('')
  }
  const remove = (c) => onChange(comunas.filter(x => x !== c).join('|'))

  return (
    <div className={styles.comunasBox}>
      <div className={styles.comunasLabel}>Comunas que atiende</div>
      <div className={styles.comunasTags}>
        {comunas.length === 0 && (
          <span className={styles.comunasEmpty}>Sin comunas específicas (cubre por radio)</span>
        )}
        {comunas.map(c => (
          <span key={c} className={styles.comunaTag}>
            {c}
            <button type="button" className={styles.comunaTagDel} onClick={() => remove(c)}>×</button>
          </span>
        ))}
      </div>
      <ComunaInput
        value={input}
        placeholder="Buscar y agregar comuna..."
        onChange={(nombre) => { add(nombre); setInput('') }}
      />
      <div className={styles.comunasHint}>
        Si defines comunas, el servicio solo aparece en esas comunas además del radio de cobertura.
      </div>
    </div>
  )
}

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

      {/* Ubicación base + Mapa */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>📍 Punto de origen y zona de cobertura</div>
        <div className={styles.grid2}>
          <Input label="Latitud" type="number" placeholder="-33.4372" step="any"
            value={form.lat_base} onChange={e => set('lat_base', e.target.value)} />
          <Input label="Longitud" type="number" placeholder="-70.6506" step="any"
            value={form.lng_base} onChange={e => set('lng_base', e.target.value)} />
        </div>
        <div style={{ marginTop: 4, marginBottom: 10, fontSize: 11, color: 'var(--text3)' }}>
          Obtén las coordenadas desde Google Maps: clic derecho sobre el punto → "¿Qué hay aquí?".
        </div>
        <CoverageMap lat={form.lat_base} lng={form.lng_base} radioKm={form.radio_km} />
      </div>

      {/* Comunas específicas */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>🗺️ Comunas que atiende</div>
        <ComunasMultiSelect
          value={form.comunas}
          onChange={val => set('comunas', val)}
        />
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
                    {svc.comunas && (
                      <div className={styles.comunasRow}>
                        {svc.comunas.split('|').filter(Boolean).map(c => (
                          <span key={c} className={styles.comunaTagSm}>{c}</span>
                        ))}
                      </div>
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
