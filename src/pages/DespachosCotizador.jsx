import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Spinner, Modal, Input } from '@/components/ui'
import api from '@/utils/api'
import styles from './Despachos.module.css'

function MedidaSearch({ medidas, value, onChange }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen]   = useState(false)
  const ref = useRef(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Si el valor externo cambia (reset), limpiar
  useEffect(() => { if (!value) setQuery('') }, [value])

  const filtered = query.trim().length === 0
    ? medidas
    : medidas.filter(m => m.medida.toLowerCase().includes(query.toLowerCase().replace(/\s/g, '')))

  const select = (m) => {
    setQuery(m.medida)
    onChange(m.medida)
    setOpen(false)
  }

  const pasajero  = filtered.filter(m => m.categoria === 'pasajero')
  const camioneta = filtered.filter(m => m.categoria === 'camioneta')

  return (
    <div className={styles.medidaSearchWrap} ref={ref}>
      <input
        className={`${styles.input} ${value ? styles.inputSelected : ''}`}
        value={query}
        placeholder="Escribe para buscar: 205, R17, 225/45…"
        onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {value && (
        <span className={styles.medidaSeleccionada}>✓ {value}</span>
      )}
      {open && (
        <div className={styles.medidaDropdown}>
          {filtered.length === 0 ? (
            <div className={styles.medidaEmpty}>Sin resultados para "{query}"</div>
          ) : (
            <>
              {pasajero.length > 0 && (
                <div className={styles.medidaGroup}>
                  <div className={styles.medidaGroupLabel}>🚗 Pasajero</div>
                  {pasajero.map(m => (
                    <button key={m.medida} className={styles.medidaOption} onClick={() => select(m)}>
                      <strong>{m.medida}</strong>
                      <span className={styles.medidaOptionMeta}>{m.peso_real_kg} kg · {m.diam_ext_cm}cm ⌀</span>
                    </button>
                  ))}
                </div>
              )}
              {camioneta.length > 0 && (
                <div className={styles.medidaGroup}>
                  <div className={styles.medidaGroupLabel}>🚙 Camioneta / SUV</div>
                  {camioneta.map(m => (
                    <button key={m.medida} className={styles.medidaOption} onClick={() => select(m)}>
                      <strong>{m.medida}</strong>
                      <span className={styles.medidaOptionMeta}>{m.peso_real_kg} kg · {m.diam_ext_cm}cm ⌀</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const COURIERS_ICONS = {
  CHILEXPRESS: '🔵',
  STARKEN:     '🟠',
  BLUEX:       '🔷',
  CORREOS:     '🟡',
  ENVIAME:     '🟢',
}

function ResultadoCourier({ r }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.courierCard} ${!r.disponible ? styles.courierNoDisp : ''}`}>
      <div className={styles.courierHeader}>
        <span className={styles.courierIcon}>{COURIERS_ICONS[r.courier_codigo] || '📦'}</span>
        <div>
          <div className={styles.courierNombre}>{r.courier_nombre}</div>
          {!r.disponible && <div className={styles.courierMotivo}>{r.motivo_no_disp}</div>}
        </div>
        <div className={styles.courierTarifa}>
          {r.tarifa_total != null
            ? `$${Number(r.tarifa_total).toLocaleString('es-CL')}`
            : <span className={styles.tarifaPendiente}>Tarifa pendiente</span>
          }
        </div>
      </div>
      <button className={styles.cajaToggle} onClick={() => setOpen(v => !v)}>
        {open ? '▲' : '▼'} Ver dimensiones de caja
      </button>
      {open && (
        <div className={styles.cajaDetail}>
          <div className={styles.cajaGrid}>
            <div><span className={styles.cajaLabel}>Largo</span><strong>{r.caja.caja_largo_cm} cm</strong></div>
            <div><span className={styles.cajaLabel}>Ancho</span><strong>{r.caja.caja_ancho_cm} cm</strong></div>
            <div><span className={styles.cajaLabel}>Alto</span><strong>{r.caja.caja_alto_cm} cm</strong></div>
            <div><span className={styles.cajaLabel}>Volumen</span><strong>{r.caja.volumen_cm3?.toLocaleString('es-CL')} cm³</strong></div>
            <div><span className={styles.cajaLabel}>Peso real</span><strong>{r.caja.peso_real_total_kg} kg</strong></div>
            <div><span className={styles.cajaLabel}>Peso volumétrico</span><strong>{r.caja.peso_volumetrico_kg} kg</strong></div>
            <div className={styles.cajaDestacado}>
              <span className={styles.cajaLabel}>Peso cobrable</span>
              <strong>{r.caja.peso_cobrable_kg} kg</strong>
              <span className={styles.cajaSub}>max(real, volumétrico)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CrearDespachoModal({ cotizacion, onClose, onCreado }) {
  const [form, setForm] = useState({
    nombre_destinatario: '', telefono_destinatario: '',
    direccion_destino: '', comuna_destino: cotizacion.comuna_destino || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const crear = async () => {
    if (!form.nombre_destinatario || !form.direccion_destino || !form.comuna_destino)
      return setError('Completa nombre, dirección y comuna')
    setSaving(true)
    setError('')
    try {
      await api.post('/despachos/crear', { cotizacion_id: cotizacion.cotizacion_id, ...form })
      onCreado()
    } catch (e) {
      setError(e.response?.data?.error || 'Error al crear despacho')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Crear despacho — ${cotizacion.courier_nombre}`} onClose={onClose} width={480}>
      <div className={styles.formGrid}>
        <Input label="Nombre destinatario *" value={form.nombre_destinatario} onChange={e => set('nombre_destinatario', e.target.value)} placeholder="Juan Pérez" />
        <Input label="Teléfono" value={form.telefono_destinatario} onChange={e => set('telefono_destinatario', e.target.value)} placeholder="+56 9 1234 5678" />
        <Input label="Dirección *" value={form.direccion_destino} onChange={e => set('direccion_destino', e.target.value)} placeholder="Av. Principal 123, Dpto 4" />
        <Input label="Comuna *" value={form.comuna_destino} onChange={e => set('comuna_destino', e.target.value)} placeholder="Santiago" />
      </div>
      {error && <div className={styles.errorMsg}>{error}</div>}
      <div className={styles.modalFooter}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={crear} disabled={saving}>{saving ? 'Creando…' : 'Crear despacho'}</Button>
      </div>
    </Modal>
  )
}

export default function DespachosCotizador() {
  const [form, setForm] = useState({
    medida: '', cantidad: '4',
    comuna_origen: 'Santiago', comuna_destino: '',
  })
  const [resultados, setResultados] = useState(null)
  const [cotizando, setCotizando] = useState(false)
  const [error, setError] = useState('')
  const [crearModal, setCrearModal] = useState(null)
  const [creado, setCreado] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const { data: medidasData } = useQuery({
    queryKey: ['neumatico-dimensiones'],
    queryFn: () => api.get('/despachos/neumaticos/dimensiones').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const medidas = medidasData?.data || []

  const cotizar = async () => {
    if (!form.medida || !form.comuna_destino) return setError('Ingresa medida y comuna de destino')
    setCotizando(true); setError(''); setResultados(null)
    try {
      const { data: res } = await api.post('/despachos/cotizar', {
        medida: form.medida, cantidad: parseInt(form.cantidad),
        comuna_origen: form.comuna_origen, comuna_destino: form.comuna_destino,
      })
      setResultados(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Error al cotizar')
    } finally { setCotizando(false) }
  }

  return (
    <div className={styles.page}>
      <Header title="Cotizador de despacho" subtitle="Calcula dimensiones y compara couriers para neumáticos" />

      <div className={styles.cotizadorLayout}>
        {/* Formulario */}
        <div className={styles.cotizadorForm}>
          <div className={styles.sectionTitle}>📦 Datos del envío</div>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Medida del neumático *</label>
            <MedidaSearch
              medidas={medidas}
              value={form.medida}
              onChange={v => set('medida', v)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Cantidad</label>
            <div className={styles.cantidadBtns}>
              {[1,2,3,4].map(n => (
                <button
                  key={n}
                  className={`${styles.cantBtn} ${form.cantidad === String(n) ? styles.cantBtnActive : ''}`}
                  onClick={() => set('cantidad', String(n))}
                >{n}</button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Comuna origen</label>
            <input className={styles.input} value={form.comuna_origen} onChange={e => set('comuna_origen', e.target.value)} placeholder="Ej: Santiago" />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Comuna destino *</label>
            <input className={styles.input} value={form.comuna_destino} onChange={e => set('comuna_destino', e.target.value)} placeholder="Ej: Concepción" />
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <Button onClick={cotizar} disabled={cotizando} className={styles.btnCotizar}>
            {cotizando ? <><Spinner size="sm" /> Cotizando…</> : '🚚 Cotizar en todos los couriers'}
          </Button>
        </div>

        {/* Resultados */}
        <div className={styles.cotizadorResults}>
          {!resultados && !cotizando && (
            <div className={styles.cotizadorEmpty}>
              <div className={styles.cotizadorEmptyIcon}>📐</div>
              <p>Ingresa los datos y presiona <strong>Cotizar</strong> para ver dimensiones de caja y disponibilidad por courier.</p>
            </div>
          )}
          {cotizando && <Spinner />}
          {resultados && (
            <>
              <div className={styles.sectionTitle}>
                Resultados para <strong>{form.medida}</strong> × {form.cantidad} unidad(es)
              </div>
              <div className={styles.sectionSub}>
                {form.comuna_origen} → {form.comuna_destino}
              </div>

              {resultados.filter(r => r.disponible).map(r => (
                <div key={r.cotizacion_id} className={styles.courierGroup}>
                  <ResultadoCourier r={r} />
                  <Button
                    size="sm"
                    className={styles.btnCrear}
                    onClick={() => { setCreado(false); setCrearModal(r) }}
                  >
                    📋 Crear despacho con {r.courier_nombre}
                  </Button>
                </div>
              ))}

              {resultados.some(r => !r.disponible) && (
                <>
                  <div className={styles.noDispTitle}>No disponibles</div>
                  {resultados.filter(r => !r.disponible).map(r => (
                    <ResultadoCourier key={r.cotizacion_id} r={r} />
                  ))}
                </>
              )}
            </>
          )}
          {creado && (
            <div className={styles.successMsg}>✅ Despacho creado correctamente. Puedes verlo en la lista de Despachos.</div>
          )}
        </div>
      </div>

      {crearModal && (
        <CrearDespachoModal
          cotizacion={crearModal}
          onClose={() => setCrearModal(null)}
          onCreado={() => { setCrearModal(null); setCreado(true) }}
        />
      )}
    </div>
  )
}
