import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Toast, ComunaInput } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './WorkshopForm.module.css'

const DIAS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
const HORAS = Array.from({length:24},(_,i)=>`${String(i).padStart(2,'0')}:00`)
const TIPOS_VEHICULO = ['Auto','Camioneta','SUV','Furgón','Camión','4x4','Deportivo']

export default function WorkshopNew() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const { id }       = useParams()
  const isEdit       = !!id

  const { data: existing } = useQuery({
    queryKey: ['workshop-detail', id],
    queryFn: () => api.get(`/workshops/${id}`),
    enabled: isEdit,
  })

  const [tab, setTab]     = useState('identificacion')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const [form, setForm] = useState({
    razon_social:'', nombre_comercial:'', rut:'',
    encargado_nombre:'', encargado_email:'', encargado_phone:'',
    finanzas_nombre:'', finanzas_email:'', finanzas_phone:'',
    direccion:'', comuna:'', comunas_adicionales:[], latitud:'', longitud:'', maps_url:'',
    puestos:1, turnos_por_puesto:1, aro_min:13, aro_max:22,
    instala_runflat:false, tipos_vehiculo:[], marcas_neumaticos:[], todas_marcas:true,
  })

  const [schedules, setSchedules] = useState(
    DIAS.map(dia=>({ dia, activo:false, hora_inicio:'09:00', hora_fin:'18:00', horas:[] }))
  )
  const [services, setServices] = useState([])
  const [prices, setPrices]     = useState({})
  const [newService, setNewService] = useState({ nombre:'', descripcion:'' })
  const [comunaInput, setComunaInput] = useState('')

  // Load existing data when editing
  useEffect(() => {
    if (existing) {
      setForm({
        razon_social:       existing.razon_social       || '',
        nombre_comercial:   existing.nombre_comercial   || '',
        rut:                existing.rut                || '',
        encargado_nombre:   existing.encargado_nombre   || '',
        encargado_email:    existing.encargado_email    || '',
        encargado_phone:    existing.encargado_phone    || '',
        finanzas_nombre:    existing.finanzas_nombre    || '',
        finanzas_email:     existing.finanzas_email     || '',
        finanzas_phone:     existing.finanzas_phone     || '',
        direccion:          existing.direccion          || '',
        comuna:             existing.comuna             || '',
        comunas_adicionales:existing.comunas_adicionales|| [],
        latitud:            existing.latitud            || '',
        longitud:           existing.longitud           || '',
        maps_url:           existing.maps_url           || '',
        puestos:            existing.puestos            || 1,
        turnos_por_puesto:  existing.turnos_por_puesto  || 1,
        aro_min:            existing.aro_min            || 13,
        aro_max:            existing.aro_max            || 22,
        instala_runflat:    existing.instala_runflat    || false,
        tipos_vehiculo:     existing.tipos_vehiculo     || [],
        marcas_neumaticos:  existing.marcas_neumaticos  || [],
        todas_marcas:       existing.todas_marcas       !== false,
      })
      if (existing.schedules?.length) {
        setSchedules(DIAS.map(dia => {
          const s = existing.schedules.find(x=>x.dia===dia)
          return s ? { dia, activo:s.activo, hora_inicio:s.hora_inicio, hora_fin:s.hora_fin, horas:s.horas||[] }
                   : { dia, activo:false, hora_inicio:'09:00', hora_fin:'18:00', horas:[] }
        }))
      }
      if (existing.services?.length) setServices(existing.services)
      if (existing.prices?.length) {
        const map = {}
        existing.prices.forEach(p => {
          if (p.aro_min) map[`${p.tipo}-${p.aro_min}`] = String(p.precio)
        })
        setPrices(map)
      }
    }
  }, [existing?.id])

  // Google Places Autocomplete
  useEffect(() => {
    const initPlaces = () => {
      const container = document.getElementById('places-container')
      if (!container || !window.google?.maps?.places?.PlaceAutocompleteElement) return
      
      // Clear container
      container.innerHTML = ''
      
      const placeAutocomplete = new window.google.maps.places.PlaceAutocompleteElement({
        types: ['address'],
        componentRestrictions: { country: 'cl' }
      })
      placeAutocomplete.style.width = '100%'
      container.appendChild(placeAutocomplete)

      placeAutocomplete.addEventListener('gmp-placeselect', async (e) => {
        const place = e.placePrediction.toPlace()
        await place.fetchFields({ fields: ['displayName','formattedAddress','location','addressComponents'] })
        
        const addr = place.formattedAddress || ''
        set('direccion', addr)
        // Also update the visible input directly
        const visibleInput = document.getElementById('direccion-display')
        if (visibleInput) visibleInput.value = addr
        set('latitud', place.location?.lat() || '')
        set('longitud', place.location?.lng() || '')
        
        const components = place.addressComponents || []
        const locality = components.find(c => c.types.includes('locality'))
        const sublocality = components.find(c => c.types.includes('sublocality'))
        if (locality) set('comuna', locality.longText)
        else if (sublocality) set('comuna', sublocality.longText)
        
        if (place.location) {
          set('maps_url', `https://www.google.com/maps?q=${place.location.lat()},${place.location.lng()}`)
        }
      })
    }

    // Load Google Maps script dynamically if not loaded
    if (window.google?.maps?.places) {
      initPlaces()
    } else {
      // Remove existing script if any
      const existing = document.getElementById('google-maps-script')
      if (!existing) {
        const script = document.createElement('script')
          script.id = 'google-maps-script'
          script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_KEY}&libraries=places`
          script.onload = initPlaces
          document.head.appendChild(script)
      } else {
        // Script exists, wait for it
        existing.addEventListener('load', initPlaces)
      }
    }
  }, [tab])

  const { data: filterOptions={} } = useQuery({
    queryKey: ['catalog-filter-options'],
    queryFn: () => api.get('/catalog/filter-options'),
  })

  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const toggleVehiculo = v => {
    const arr = form.tipos_vehiculo||[]
    set('tipos_vehiculo', arr.includes(v)?arr.filter(x=>x!==v):[...arr,v])
  }
  const toggleMarca = b => {
    const arr = form.marcas_neumaticos||[]
    set('marcas_neumaticos', arr.includes(b)?arr.filter(x=>x!==b):[...arr,b])
  }
  const toggleHora = (diaIdx, hora) => {
    setSchedules(ss=>ss.map((s,i)=>{
      if(i!==diaIdx) return s
      const horas=s.horas||[]
      return {...s, horas:horas.includes(hora)?horas.filter(h=>h!==hora):[...horas,hora].sort()}
    }))
  }
  const setHorarioRango = (diaIdx, inicio, fin) => {
    setSchedules(ss=>ss.map((s,i)=>{
      if(i!==diaIdx) return s
      const horas=HORAS.filter(h=>h>=inicio&&h<=fin)
      return {...s, hora_inicio:inicio, hora_fin:fin, horas}
    }))
  }

  const saveAll = async () => {
    if (!form.nombre_comercial) return showToast('Nombre comercial requerido')
    setSaving(true)
    try {
      let wid = id
      // Guardar datos principales
      if (wid) {
        await api.put(`/workshops/${wid}`, form)
      } else {
        const w = await api.post('/workshops', form)
        wid = w.id
      }
      // Guardar horarios siempre
      await api.put(`/workshops/${wid}/schedules`, { schedules })
      // Guardar servicios nuevos
      for (const s of services.filter(s=>!s.id))
        await api.post(`/workshops/${wid}/services`, s)
      // Guardar precios por aro
      const aros = Array.from(
        { length: (form.aro_max||22) - (form.aro_min||13) + 1 },
        (_, i) => (form.aro_min||13) + i
      )
      const pricesArr = []
      for (const tipo of ['montaje','balanceo']) {
        for (const aro of aros) {
          const precio = prices[`${tipo}-${aro}`]
          if (precio) pricesArr.push({ tipo, aro, precio: parseFloat(precio) })
        }
      }
      await api.put(`/workshops/${wid}/prices`, { prices: pricesArr })
      queryClient.invalidateQueries({ queryKey: ['workshop-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['workshops'] })
      showToast('✓ Taller guardado correctamente')
      setTimeout(()=>navigate('/workshops'), 800)
    } catch(e) {
      console.error('Error guardando taller:', e)
      showToast('Error: '+e.message+'. Intenta nuevamente.')
    } finally { setSaving(false) }
  }

  const TABS = [
    { id:'identificacion', label:'🏢 Identificación' },
    { id:'contactos',      label:'👤 Contactos' },
    { id:'ubicacion',      label:'📍 Ubicación' },
    { id:'capacidades',    label:'⚙️ Capacidades' },
    { id:'horarios',       label:'🕐 Horarios' },
    { id:'servicios',      label:'🔧 Servicios' },
    { id:'precios',        label:'💰 Precios' },
  ]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={()=>navigate('/workshops')}>← Volver</button>
        <h1 className={styles.title}>{isEdit ? 'Editar taller' : 'Nuevo taller'}</h1>
        <div className={styles.headerActions}>
          <Button variant="ghost" onClick={()=>navigate('/workshops')}>Cancelar</Button>
          <Button onClick={saveAll} loading={saving} disabled={!form.nombre_comercial}>
            💾 Guardar taller
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(t=>(
          <button key={t.id} className={`${styles.tab} ${tab===t.id?styles.tabActive:''}`}
            onClick={()=>setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.tabPane}>

          {/* IDENTIFICACIÓN */}
          {tab==='identificacion' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🏢 Datos del taller</div>
              <div className={styles.formGrid}>
                <div className={styles.formField} style={{gridColumn:'1/-1'}}>
                  <label>Nombre Comercial *</label>
                  <input className={styles.input} value={form.nombre_comercial} onChange={e=>set('nombre_comercial',e.target.value)} placeholder="Ej: Taller El Neumático"/>
                </div>
                <div className={styles.formField}>
                  <label>Razón Social</label>
                  <input className={styles.input} value={form.razon_social} onChange={e=>set('razon_social',e.target.value)} placeholder="Razón social legal"/>
                </div>
                <div className={styles.formField}>
                  <label>RUT</label>
                  <input className={styles.input} value={form.rut} onChange={e=>set('rut',e.target.value)} placeholder="76.123.456-7"/>
                </div>
              </div>
            </div>
          )}

          {/* CONTACTOS */}
          {tab==='contactos' && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>👤 Encargado de Taller</div>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label>Nombre y Apellido</label>
                    <input className={styles.input} value={form.encargado_nombre} onChange={e=>set('encargado_nombre',e.target.value)} placeholder="Juan Pérez"/>
                  </div>
                  <div className={styles.formField}>
                    <label>Teléfono</label>
                    <input className={styles.input} value={form.encargado_phone} onChange={e=>set('encargado_phone',e.target.value)} placeholder="+56 9 1234 5678"/>
                  </div>
                  <div className={styles.formField} style={{gridColumn:'1/-1'}}>
                    <label>Email</label>
                    <input className={styles.input} type="email" value={form.encargado_email} onChange={e=>set('encargado_email',e.target.value)} placeholder="encargado@taller.cl"/>
                  </div>
                </div>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>💼 Encargado de Finanzas</div>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label>Nombre y Apellido</label>
                    <input className={styles.input} value={form.finanzas_nombre} onChange={e=>set('finanzas_nombre',e.target.value)} placeholder="María González"/>
                  </div>
                  <div className={styles.formField}>
                    <label>Teléfono</label>
                    <input className={styles.input} value={form.finanzas_phone} onChange={e=>set('finanzas_phone',e.target.value)} placeholder="+56 9 1234 5678"/>
                  </div>
                  <div className={styles.formField} style={{gridColumn:'1/-1'}}>
                    <label>Email</label>
                    <input className={styles.input} type="email" value={form.finanzas_email} onChange={e=>set('finanzas_email',e.target.value)} placeholder="finanzas@taller.cl"/>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* UBICACIÓN */}
          {tab==='ubicacion' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>📍 Ubicación del taller</div>
              <div className={styles.formGrid}>
                <div className={styles.formField} style={{gridColumn:'1/-1'}}>
                  <label>Dirección</label>
                  <div id="places-container" style={{width:'100%'}}></div>
                  <input id="direccion-display" className={styles.input} 
                    value={form.direccion}
                    onChange={e=>set('direccion',e.target.value)}
                    placeholder="Dirección seleccionada aparecerá aquí..."
                    style={{marginTop:6}}/>
                  {form.latitud && (
                    <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                      📍 {form.latitud}, {form.longitud}
                      {form.maps_url && <a href={form.maps_url} target="_blank" rel="noopener noreferrer" style={{marginLeft:8,color:'var(--accent)'}}>Ver mapa →</a>}
                    </div>
                  )}
                </div>
                <div className={styles.formField}>
                  <label>Comuna principal</label>
                  <ComunaInput value={form.comuna} onChange={(val)=>set('comuna',val)} placeholder="Buscar comuna..." className={styles.input}/>
                </div>
                <div className={styles.formField}>
                  <label>URL Google Maps</label>
                  <input className={styles.input} value={form.maps_url} onChange={e=>set('maps_url',e.target.value)} placeholder="https://maps.google.com/..."/>
                </div>
                <div className={styles.formField}>
                  <label>Latitud</label>
                  <input className={styles.input} type="number" step="0.0000001" value={form.latitud} onChange={e=>set('latitud',e.target.value)} placeholder="-33.4569"/>
                </div>
                <div className={styles.formField}>
                  <label>Longitud</label>
                  <input className={styles.input} type="number" step="0.0000001" value={form.longitud} onChange={e=>set('longitud',e.target.value)} placeholder="-70.6483"/>
                </div>
                <div className={styles.formField} style={{gridColumn:'1/-1'}}>
                  <label>Comunas adicionales que atiende</label>
                  <div className={styles.tagsList}>
                    {(form.comunas_adicionales||[]).map((c,i)=>(
                      <span key={i} className={styles.tag}>{c}
                        <button onClick={()=>set('comunas_adicionales',(form.comunas_adicionales||[]).filter((_,j)=>j!==i))}>✕</button>
                      </span>
                    ))}
                  </div>
                  <div className={styles.tagInputRow}>
                    <ComunaInput value={comunaInput} onChange={(val)=>{ set('comunas_adicionales',[...(form.comunas_adicionales||[]),val]); setComunaInput('') }} placeholder="Buscar y agregar comuna..." className={styles.input}/>
                    <button className={styles.addTagBtn} onClick={()=>{ if(comunaInput.trim()){ set('comunas_adicionales',[...(form.comunas_adicionales||[]),comunaInput.trim()]); setComunaInput('') }}}>+</button>
                  </div>
                </div>
              </div>
              {form.maps_url && (
                <a href={form.maps_url} target="_blank" rel="noopener noreferrer" className={styles.mapsLink}>🗺️ Ver en Google Maps</a>
              )}
            </div>
          )}

          {/* CAPACIDADES */}
          {tab==='capacidades' && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>🏗️ Infraestructura</div>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label>Puestos de instalación</label>
                    <input className={styles.input} type="number" min="1" value={form.puestos} onChange={e=>set('puestos',parseInt(e.target.value)||1)}/>
                  </div>
                  <div className={styles.formField}>
                    <label>Turnos por puesto</label>
                    <input className={styles.input} type="number" min="1" value={form.turnos_por_puesto} onChange={e=>set('turnos_por_puesto',parseInt(e.target.value)||1)}/>
                  </div>
                </div>
                <div className={styles.capInfo}>
                  Capacidad máxima: <strong>{(form.puestos||1)*(form.turnos_por_puesto||1)} instalaciones por turno</strong>
                </div>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>🚗 Tipos de vehículo</div>
                <div className={styles.checkGrid}>
                  {TIPOS_VEHICULO.map(v=>(
                    <label key={v} className={styles.checkItem}>
                      <input type="checkbox" checked={(form.tipos_vehiculo||[]).includes(v)} onChange={()=>toggleVehiculo(v)}/>{v}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>📏 Rango de aros</div>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label>Aro mínimo</label>
                    <input className={styles.input} type="number" min="10" max="30" value={form.aro_min} onChange={e=>set('aro_min',parseInt(e.target.value)||13)}/>
                  </div>
                  <div className={styles.formField}>
                    <label>Aro máximo</label>
                    <input className={styles.input} type="number" min="10" max="30" value={form.aro_max} onChange={e=>set('aro_max',parseInt(e.target.value)||22)}/>
                  </div>
                </div>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>🏷️ Marcas de neumáticos</div>
                <label className={styles.checkItem} style={{marginBottom:12}}>
                  <input type="checkbox" checked={form.todas_marcas} onChange={e=>set('todas_marcas',e.target.checked)}/>
                  <strong>Instala todas las marcas</strong>
                </label>
                {!form.todas_marcas && (
                  <div className={styles.checkGrid}>
                    {(filterOptions.brands||[]).map(b=>(
                      <label key={b} className={styles.checkItem}>
                        <input type="checkbox" checked={(form.marcas_neumaticos||[]).includes(b)} onChange={()=>toggleMarca(b)}/>{b}
                      </label>
                    ))}
                  </div>
                )}
                <label className={styles.checkItem} style={{marginTop:12}}>
                  <input type="checkbox" checked={form.instala_runflat} onChange={e=>set('instala_runflat',e.target.checked)}/>
                  <strong>Instala neumáticos Runflat</strong>
                </label>
              </div>
            </>
          )}

          {/* HORARIOS */}
          {tab==='horarios' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🕐 Horarios de atención</div>
              <div className={styles.horariosGrid}>
                {schedules.map((s,i)=>(
                  <div key={s.dia} className={`${styles.diaCard} ${s.activo?styles.diaActivo:''}`}>
                    <div className={styles.diaHeader}>
                      <label className={styles.checkItem}>
                        <input type="checkbox" checked={s.activo}
                          onChange={e=>setSchedules(ss=>ss.map((x,j)=>j===i?{...x,activo:e.target.checked}:x))}/>
                        <strong>{s.dia.charAt(0).toUpperCase()+s.dia.slice(1)}</strong>
                      </label>
                    </div>
                    {s.activo && (
                      <>
                        <div className={styles.rangoRow}>
                          <select className={styles.selectSm} value={s.hora_inicio} onChange={e=>setHorarioRango(i,e.target.value,s.hora_fin)}>
                            {HORAS.map(h=><option key={h}>{h}</option>)}
                          </select>
                          <span className={styles.rangoA}>a</span>
                          <select className={styles.selectSm} value={s.hora_fin} onChange={e=>setHorarioRango(i,s.hora_inicio,e.target.value)}>
                            {HORAS.map(h=><option key={h}>{h}</option>)}
                          </select>
                        </div>
                        <div className={styles.horasGrid}>
                          {HORAS.filter(h=>h>=s.hora_inicio&&h<=s.hora_fin).map(h=>(
                            <button key={h} className={`${styles.horaBtn} ${(s.horas||[]).includes(h)?styles.horaOn:''}`}
                              onClick={()=>toggleHora(i,h)}>{h}</button>
                          ))}
                        </div>
                        <div className={styles.diaStats}>
                          {(s.horas||[]).length} horas · {(s.horas||[]).length*(form.puestos||1)*(form.turnos_por_puesto||1)} cupos/día
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SERVICIOS */}
          {tab==='servicios' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🔧 Servicios adicionales</div>
              <div className={styles.servicesList}>
                {services.map((s,i)=>(
                  <div key={i} className={styles.serviceItem}>
                    <div>
                      <div className={styles.serviceName}>{s.nombre}</div>
                      {s.descripcion&&<div className={styles.serviceDesc}>{s.descripcion}</div>}
                    </div>
                    <button className={styles.delBtn} onClick={()=>setServices(ss=>ss.filter((_,j)=>j!==i))}>🗑️</button>
                  </div>
                ))}
                {services.length===0&&<div className={styles.emptyNote}>Sin servicios adicionales aún</div>}
              </div>
              <div className={styles.addForm}>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label>Nombre del servicio</label>
                    <input className={styles.input} value={newService.nombre} onChange={e=>setNewService(s=>({...s,nombre:e.target.value}))} placeholder="Ej: Alineación, Equilibrado..."/>
                  </div>
                  <div className={styles.formField}>
                    <label>Descripción</label>
                    <input className={styles.input} value={newService.descripcion} onChange={e=>setNewService(s=>({...s,descripcion:e.target.value}))} placeholder="Opcional"/>
                  </div>
                </div>
                <Button size="sm" onClick={()=>{
                  if(newService.nombre){ setServices(ss=>[...ss,{...newService}]); setNewService({nombre:'',descripcion:''}) }
                }} disabled={!newService.nombre}>+ Agregar servicio</Button>
              </div>
            </div>
          )}

          {/* PRECIOS */}
          {tab==='precios' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>💰 Valores de instalación</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
                {['montaje','balanceo'].map(tipo=>(
                  <div key={tipo} className={styles.precioSection}>
                    <div className={styles.precioTitle}>
                      {tipo==='montaje'?'🔧 Montaje':'⚖️ Balanceo'}
                    </div>
                    <table className={styles.precioTable}>
                      <thead>
                        <tr><th>Aro</th><th style={{textAlign:'right'}}>Precio c/IVA</th></tr>
                      </thead>
                      <tbody>
                        {Array.from({length:(form.aro_max||22)-(form.aro_min||13)+1},(_,i)=>(form.aro_min||13)+i).map(aro=>(
                          <tr key={aro}>
                            <td>Aro {aro}</td>
                            <td>
                              <input
                                className={styles.input}
                                type="number"
                                placeholder="$"
                                style={{textAlign:'right',margin:0}}
                                value={prices[`${tipo}-${aro}`]||''}
                                onChange={e=>setPrices(p=>({...p,[`${tipo}-${aro}`]:e.target.value}))}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {toast&&<Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
