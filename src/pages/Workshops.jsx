import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast, Avatar, ComunaInput } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './Workshops.module.css'

const DIAS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
const HORAS = Array.from({length:24},(_,i)=>`${String(i).padStart(2,'0')}:00`)
const TIPOS_VEHICULO = ['Auto','Camioneta','SUV','Furgón','Camión','4x4','Deportivo']
const TIPOS_PRECIO = ['montaje','balanceo','otros']

// ── WorkshopForm ──────────────────────────────────────────────
function WorkshopForm({ workshop, onClose, onSaved }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('identificacion')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const [form, setForm] = useState({
    razon_social:       workshop?.razon_social       || '',
    nombre_comercial:   workshop?.nombre_comercial   || '',
    rut:                workshop?.rut                || '',
    encargado_nombre:   workshop?.encargado_nombre   || '',
    encargado_email:    workshop?.encargado_email    || '',
    encargado_phone:    workshop?.encargado_phone    || '',
    finanzas_nombre:    workshop?.finanzas_nombre    || '',
    finanzas_email:     workshop?.finanzas_email     || '',
    finanzas_phone:     workshop?.finanzas_phone     || '',
    direccion:          workshop?.direccion          || '',
    comuna:             workshop?.comuna             || '',
    comunas_adicionales:workshop?.comunas_adicionales|| [],
    latitud:            workshop?.latitud            || '',
    longitud:           workshop?.longitud           || '',
    maps_url:           workshop?.maps_url           || '',
    puestos:            workshop?.puestos            || 1,
    turnos_por_puesto:  workshop?.turnos_por_puesto  || 1,
    aro_min:            workshop?.aro_min            || 13,
    aro_max:            workshop?.aro_max            || 22,
    instala_runflat:    workshop?.instala_runflat    || false,
    tipos_vehiculo:     workshop?.tipos_vehiculo     || [],
    marcas_neumaticos:  workshop?.marcas_neumaticos  || [],
    todas_marcas:       workshop?.todas_marcas       !== false,
  })

  const [schedules, setSchedules] = useState(
    DIAS.map(dia => {
      const existing = workshop?.schedules?.find(s=>s.dia===dia)
      return {
        dia,
        activo:      existing?.activo      || false,
        hora_inicio: existing?.hora_inicio || '09:00',
        hora_fin:    existing?.hora_fin    || '18:00',
        horas:       existing?.horas       || [],
      }
    })
  )

  const [services, setServices]   = useState(workshop?.services || [])
  const [prices, setPrices]       = useState(workshop?.prices || [])
  const [newService, setNewService] = useState({ nombre:'', descripcion:'' })
  const [newPrice, setNewPrice]   = useState({ tipo:'montaje', descripcion:'', aro_min:'', aro_max:'', precio:'' })
  const [comunaInput, setComunaInput] = useState('')

  const { data: filterOptions={} } = useQuery({
    queryKey: ['catalog-filter-options'],
    queryFn: () => api.get('/catalog/filter-options'),
  })

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const toggleVehiculo = (v) => {
    const arr = form.tipos_vehiculo || []
    set('tipos_vehiculo', arr.includes(v) ? arr.filter(x=>x!==v) : [...arr,v])
  }

  const toggleMarca = (b) => {
    const arr = form.marcas_neumaticos || []
    set('marcas_neumaticos', arr.includes(b) ? arr.filter(x=>x!==b) : [...arr,b])
  }

  const toggleHora = (diaIdx, hora) => {
    setSchedules(ss => ss.map((s,i) => {
      if (i !== diaIdx) return s
      const horas = s.horas || []
      return { ...s, horas: horas.includes(hora) ? horas.filter(h=>h!==hora) : [...horas,hora].sort() }
    }))
  }

  const setHorarioRango = (diaIdx, inicio, fin) => {
    setSchedules(ss => ss.map((s,i) => {
      if (i !== diaIdx) return s
      const horas = HORAS.filter(h => h >= inicio && h <= fin)
      return { ...s, hora_inicio: inicio, hora_fin: fin, horas }
    }))
  }

  const saveAll = async () => {
    if (!form.nombre_comercial) return showToast('Nombre comercial requerido')
    setSaving(true)
    try {
      let wid = workshop?.id
      if (wid) {
        await api.put(`/workshops/${wid}`, form)
      } else {
        const w = await api.post('/workshops', form)
        wid = w.id
      }
      // Guardar horarios
      await api.put(`/workshops/${wid}/schedules`, { schedules })
      // Guardar servicios nuevos
      for (const s of services.filter(s=>!s.id)) {
        await api.post(`/workshops/${wid}/services`, s)
      }
      // Guardar precios nuevos
      for (const p of prices.filter(p=>!p.id)) {
        await api.post(`/workshops/${wid}/prices`, p)
      }
      qc.invalidateQueries(['workshops'])
      onSaved()
      onClose()
    } catch(e) {
      showToast('Error: ' + e.message)
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
    <div className={styles.formOverlay}>
      <div className={styles.formModal}>
        {/* Header */}
        <div className={styles.formHeader}>
          <h2 className={styles.formTitle}>{workshop?.id ? 'Editar taller' : 'Nuevo taller'}</h2>
          <div className={styles.formHeaderActions}>
            <Button onClick={saveAll} loading={saving} disabled={!form.nombre_comercial}>
              💾 Guardar taller
            </Button>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.formTabs}>
          {TABS.map(t=>(
            <button key={t.id} className={`${styles.formTab} ${tab===t.id?styles.formTabActive:''}`}
              onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className={styles.formBody}>
          {/* IDENTIFICACIÓN */}
          {tab==='identificacion' && (
            <div className={styles.tabPane}>
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
            <div className={styles.tabPane}>
              <div className={styles.contactSection}>
                <div className={styles.contactTitle}>👤 Encargado de Taller</div>
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
              <div className={styles.contactSection}>
                <div className={styles.contactTitle}>💼 Encargado de Finanzas</div>
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
            </div>
          )}

          {/* UBICACIÓN */}
          {tab==='ubicacion' && (
            <div className={styles.tabPane}>
              <div className={styles.formGrid}>
                <div className={styles.formField} style={{gridColumn:'1/-1'}}>
                  <label>Dirección</label>
                  <input className={styles.input} value={form.direccion} onChange={e=>set('direccion',e.target.value)} placeholder="Av. Ejemplo 1234, local 5"/>
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
                  <div className={styles.tagInput}>
                    <div className={styles.tagsList}>
                      {(form.comunas_adicionales||[]).map((c,i)=>(
                        <span key={i} className={styles.tag}>
                          {c}
                          <button onClick={()=>set('comunas_adicionales',(form.comunas_adicionales||[]).filter((_,j)=>j!==i))}>✕</button>
                        </span>
                      ))}
                    </div>
                    <div className={styles.tagInputRow}>
                      <input className={styles.input} placeholder="Agregar comuna..." value={comunaInput} onChange={e=>setComunaInput(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'&&comunaInput.trim()){ set('comunas_adicionales',[...(form.comunas_adicionales||[]),comunaInput.trim()]); setComunaInput('') }}}/>
                      <button className={styles.addTagBtn} onClick={()=>{ if(comunaInput.trim()){ set('comunas_adicionales',[...(form.comunas_adicionales||[]),comunaInput.trim()]); setComunaInput('') }}}>+</button>
                    </div>
                  </div>
                </div>
              </div>
              {form.maps_url && (
                <div className={styles.mapsPreview}>
                  <a href={form.maps_url} target="_blank" rel="noopener noreferrer" className={styles.mapsLink}>
                    🗺️ Ver en Google Maps
                  </a>
                </div>
              )}
            </div>
          )}

          {/* CAPACIDADES */}
          {tab==='capacidades' && (
            <div className={styles.tabPane}>
              <div className={styles.capSection}>
                <div className={styles.capTitle}>🏗️ Infraestructura</div>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label>Puestos de instalación</label>
                    <input className={styles.input} type="number" min="1" value={form.puestos} onChange={e=>set('puestos',e.target.value)}/>
                  </div>
                  <div className={styles.formField}>
                    <label>Turnos por puesto</label>
                    <input className={styles.input} type="number" min="1" value={form.turnos_por_puesto} onChange={e=>set('turnos_por_puesto',e.target.value)}/>
                  </div>
                </div>
                <div className={styles.capInfo}>
                  Capacidad máxima: <strong>{(form.puestos||1) * (form.turnos_por_puesto||1)} instalaciones/turno</strong>
                </div>
              </div>

              <div className={styles.capSection}>
                <div className={styles.capTitle}>🔧 Tipos de vehículo</div>
                <div className={styles.checkGrid}>
                  {TIPOS_VEHICULO.map(v=>(
                    <label key={v} className={styles.checkItem}>
                      <input type="checkbox" checked={(form.tipos_vehiculo||[]).includes(v)} onChange={()=>toggleVehiculo(v)}/>
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.capSection}>
                <div className={styles.capTitle}>🏷️ Rangos de aro</div>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label>Aro mínimo</label>
                    <input className={styles.input} type="number" min="10" max="30" value={form.aro_min} onChange={e=>set('aro_min',e.target.value)}/>
                  </div>
                  <div className={styles.formField}>
                    <label>Aro máximo</label>
                    <input className={styles.input} type="number" min="10" max="30" value={form.aro_max} onChange={e=>set('aro_max',e.target.value)}/>
                  </div>
                </div>
              </div>

              <div className={styles.capSection}>
                <div className={styles.capTitle}>🏷️ Marcas de neumáticos</div>
                <label className={styles.checkItem} style={{marginBottom:10}}>
                  <input type="checkbox" checked={form.todas_marcas} onChange={e=>set('todas_marcas',e.target.checked)}/>
                  <strong>Instala todas las marcas</strong>
                </label>
                {!form.todas_marcas && (
                  <div className={styles.checkGrid}>
                    {(filterOptions.brands||[]).map(b=>(
                      <label key={b} className={styles.checkItem}>
                        <input type="checkbox" checked={(form.marcas_neumaticos||[]).includes(b)} onChange={()=>toggleMarca(b)}/>
                        {b}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.capSection}>
                <label className={styles.checkItem}>
                  <input type="checkbox" checked={form.instala_runflat} onChange={e=>set('instala_runflat',e.target.checked)}/>
                  <strong>Instala neumáticos Runflat</strong>
                </label>
              </div>
            </div>
          )}

          {/* HORARIOS */}
          {tab==='horarios' && (
            <div className={styles.tabPane}>
              <div className={styles.horariosGrid}>
                {schedules.map((s,i)=>(
                  <div key={s.dia} className={`${styles.diaCard} ${s.activo?styles.diaActivo:''}`}>
                    <div className={styles.diaHeader}>
                      <label className={styles.checkItem}>
                        <input type="checkbox" checked={s.activo}
                          onChange={e=>setSchedules(ss=>ss.map((x,j)=>j===i?{...x,activo:e.target.checked}:x))}/>
                        <strong className={styles.diaNombre}>{s.dia.charAt(0).toUpperCase()+s.dia.slice(1)}</strong>
                      </label>
                    </div>
                    {s.activo && (
                      <>
                        <div className={styles.rangoRow}>
                          <select className={styles.selectSm} value={s.hora_inicio}
                            onChange={e=>setHorarioRango(i,e.target.value,s.hora_fin)}>
                            {HORAS.map(h=><option key={h}>{h}</option>)}
                          </select>
                          <span>a</span>
                          <select className={styles.selectSm} value={s.hora_fin}
                            onChange={e=>setHorarioRango(i,s.hora_inicio,e.target.value)}>
                            {HORAS.map(h=><option key={h}>{h}</option>)}
                          </select>
                        </div>
                        <div className={styles.horasGrid}>
                          {HORAS.filter(h=>h>=s.hora_inicio&&h<=s.hora_fin).map(h=>(
                            <button key={h}
                              className={`${styles.horaBtn} ${(s.horas||[]).includes(h)?styles.horaOn:''}`}
                              onClick={()=>toggleHora(i,h)}>{h}</button>
                          ))}
                        </div>
                        <div className={styles.diaStats}>
                          {(s.horas||[]).length} hora{(s.horas||[]).length!==1?'s':''} habilitada{(s.horas||[]).length!==1?'s':''}
                          · {(s.horas||[]).length * (form.puestos||1) * (form.turnos_por_puesto||1)} cupos/día
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
            <div className={styles.tabPane}>
              <div className={styles.servicesList}>
                {services.map((s,i)=>(
                  <div key={i} className={styles.serviceItem}>
                    <div>
                      <div className={styles.serviceName}>{s.nombre}</div>
                      {s.descripcion && <div className={styles.serviceDesc}>{s.descripcion}</div>}
                    </div>
                    <button className={styles.delBtn} onClick={()=>setServices(ss=>ss.filter((_,j)=>j!==i))}>🗑️</button>
                  </div>
                ))}
                {services.length===0 && <div className={styles.emptyServices}>Sin servicios adicionales</div>}
              </div>
              <div className={styles.addServiceForm}>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label>Nombre del servicio</label>
                    <input className={styles.input} value={newService.nombre} onChange={e=>setNewService(s=>({...s,nombre:e.target.value}))} placeholder="Ej: Alineación, Equilibrado..."/>
                  </div>
                  <div className={styles.formField}>
                    <label>Descripción</label>
                    <input className={styles.input} value={newService.descripcion} onChange={e=>setNewService(s=>({...s,descripcion:e.target.value}))} placeholder="Descripción opcional"/>
                  </div>
                </div>
                <Button size="sm" onClick={()=>{ if(newService.nombre){ setServices(ss=>[...ss,{...newService}]); setNewService({nombre:'',descripcion:''}) }}} disabled={!newService.nombre}>
                  + Agregar servicio
                </Button>
              </div>
            </div>
          )}

          {/* PRECIOS */}
          {tab==='precios' && (
            <div className={styles.tabPane}>
              {['montaje','balanceo','otros'].map(tipo=>(
                <div key={tipo} className={styles.precioSection}>
                  <div className={styles.precioTitle}>
                    {tipo==='montaje'?'🔧 Montaje':tipo==='balanceo'?'⚖️ Balanceo':'📋 Otros servicios'}
                  </div>
                  <table className={styles.precioTable}>
                    <thead>
                      <tr><th>Descripción</th><th>Aro desde</th><th>Aro hasta</th><th style={{textAlign:'right'}}>Precio</th><th></th></tr>
                    </thead>
                    <tbody>
                      {prices.filter(p=>p.tipo===tipo).map((p,i)=>(
                        <tr key={i}>
                          <td className={styles.precioDesc}>{p.descripcion}</td>
                          <td className={styles.precioAro}>{p.aro_min||'—'}</td>
                          <td className={styles.precioAro}>{p.aro_max||'—'}</td>
                          <td className={styles.precioVal}>{fmt.currency(p.precio)}</td>
                          <td><button className={styles.delBtn} onClick={()=>setPrices(pp=>pp.filter((_,j)=>pp.indexOf(p)!==j))}>🗑️</button></td>
                        </tr>
                      ))}
                      {prices.filter(p=>p.tipo===tipo).length===0 && (
                        <tr><td colSpan={5} className={styles.precioEmpty}>Sin precios para {tipo}</td></tr>
                      )}
                    </tbody>
                  </table>
                  <div className={styles.addPrecioRow}>
                    <input className={styles.input} style={{flex:2}} placeholder="Descripción (ej: Neumáticos hasta 18&quot;)"
                      value={newPrice.tipo===tipo?newPrice.descripcion:''} onChange={e=>setNewPrice({tipo,descripcion:e.target.value,aro_min:newPrice.aro_min,aro_max:newPrice.aro_max,precio:newPrice.precio})}/>
                    <input className={styles.input} style={{width:80}} type="number" placeholder="Aro min" value={newPrice.tipo===tipo?newPrice.aro_min:''} onChange={e=>setNewPrice(p=>({...p,tipo,aro_min:e.target.value}))}/>
                    <input className={styles.input} style={{width:80}} type="number" placeholder="Aro max" value={newPrice.tipo===tipo?newPrice.aro_max:''} onChange={e=>setNewPrice(p=>({...p,tipo,aro_max:e.target.value}))}/>
                    <input className={styles.input} style={{width:110,textAlign:'right'}} type="number" placeholder="Precio $" value={newPrice.tipo===tipo?newPrice.precio:''} onChange={e=>setNewPrice(p=>({...p,tipo,precio:e.target.value}))}/>
                    <Button size="sm" onClick={()=>{
                      if(newPrice.descripcion&&newPrice.precio&&newPrice.tipo===tipo){
                        setPrices(pp=>[...pp,{...newPrice}])
                        setNewPrice({tipo:'montaje',descripcion:'',aro_min:'',aro_max:'',precio:''})
                      }
                    }} disabled={!newPrice.descripcion||!newPrice.precio||newPrice.tipo!==tipo}>+</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Workshops() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [toast, setToast]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const handleDelete = async (e, w) => {
    e.stopPropagation()
    setConfirmDelete(w)
  }

  const confirmDeleteTaller = async () => {
    try {
      await api.delete(`/workshops/${confirmDelete.id}`)
      setConfirmDelete(null)
      refetch()
      showToast('✓ Taller eliminado')
    } catch(e) {
      showToast('Error: ' + e.message)
    }
  }

  const { data: workshops=[], isLoading, refetch } = useQuery({
    queryKey: ['workshops', search],
    queryFn: () => api.get('/workshops' + (search?`?search=${search}`:'')),
  })

  const openEdit = (w) => navigate(`/workshops/${w.id}/edit`)

  return (
    <div className={styles.page}>
      <Header
        onSearch={setSearch}
        actions={<Button size="sm" onClick={()=>navigate('/workshops/new')}>➕ Nuevo taller</Button>}
      />
      <div className={styles.content}>
        <div className={styles.statsRow}>
          <div className={styles.stat}><span className={styles.statN}>{workshops.length}</span><span className={styles.statL}>Talleres activos</span></div>
          <div className={styles.stat}><span className={styles.statN}>{workshops.reduce((s,w)=>s+(parseInt(w.puestos)||0),0)}</span><span className={styles.statL}>Puestos totales</span></div>
          <div className={styles.stat}><span className={styles.statN}>{workshops.filter(w=>w.instala_runflat).length}</span><span className={styles.statL}>Instalan Runflat</span></div>
        </div>

        {isLoading ? <div className={styles.loading}><Spinner/></div> :
        workshops.length===0 ? <Empty icon="🔧" title="Sin talleres" subtitle='Click en "Nuevo taller" para agregar'/> : (
          <div className={styles.grid}>
            {workshops.map(w=>(
              <div key={w.id} className={styles.card} onClick={()=>openEdit(w)}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.cardName}>{w.nombre_comercial}</div>
                    {w.razon_social && w.razon_social!==w.nombre_comercial && <div className={styles.cardRazon}>{w.razon_social}</div>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    {w.instala_runflat && <span className={styles.runflatTag}>Runflat</span>}
                    <button className={styles.deleteBtn} onClick={(e)=>handleDelete(e,w)} title="Eliminar taller">🗑️</button>
                  </div>
                </div>
                {w.comuna && <div className={styles.cardComuna}>📍 {w.comuna}</div>}
                <div className={styles.cardStats}>
                  <span>🏗️ {w.puestos} puesto{w.puestos!==1?'s':''}</span>
                  <span>🔄 {w.turnos_por_puesto} turno{w.turnos_por_puesto!==1?'s':''}/puesto</span>
                  <span>⏰ {w.dias_activos||0} día{w.dias_activos!==1?'s':''}/sem</span>
                </div>
                <div className={styles.cardFooter}>
                  {w.aro_min && <span className={styles.aroTag}>Aro {w.aro_min}–{w.aro_max}</span>}
                  {w.todas_marcas ? <span className={styles.marcaTag}>Todas las marcas</span> :
                    <span className={styles.marcaTag}>{(w.marcas_neumaticos||[]).length} marcas</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && <WorkshopForm onClose={()=>setShowForm(false)} onSaved={()=>{refetch();showToast('✓ Taller creado')}}/>}
      {editing  && <WorkshopForm workshop={editing} onClose={()=>setEditing(null)} onSaved={()=>{refetch();showToast('✓ Taller actualizado')}}/>}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}

      {confirmDelete && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmIcon}>🗑️</div>
            <div className={styles.confirmTitle}>¿Eliminar taller?</div>
            <div className={styles.confirmMsg}>Se eliminará <strong>{confirmDelete.nombre_comercial}</strong> y todos sus datos. Esta acción no se puede deshacer.</div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={()=>setConfirmDelete(null)}>Cancelar</button>
              <button className={styles.confirmDel} onClick={confirmDeleteTaller}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
