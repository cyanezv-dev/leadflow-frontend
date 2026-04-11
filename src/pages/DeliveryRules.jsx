import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Toast } from '@/components/ui'
import { ComunaInput } from '@/components/ui'
import api from '@/utils/api'
import styles from './DeliveryRules.module.css'

const HORAS_OPTIONS = [
  { value:24,   label:'24 hrs' },
  { value:48,   label:'48 hrs' },
  { value:72,   label:'72 hrs' },
  { value:96,   label:'96 hrs' },
  { value:120,  label:'120 hrs' },
  { value:144,  label:'144 hrs' },
  { value:168,  label:'168 hrs' },
  { value:192,  label:'192 hrs' },
  { value:216,  label:'216 hrs' },
  { value:240,  label:'240 hrs' },
  { value:264,  label:'264 hrs' },
  { value:null, label:'🚫 No despacha' },
]

const DIAS_SEMANA = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']

function HorasBadge({ horas }) {
  if (horas === null || horas === undefined)
    return <span className={styles.noEntrega}>🚫 No despacha</span>
  const color = horas<=48?'var(--green)':horas<=96?'var(--yellow)':'var(--red)'
  return <span className={styles.horasBadge} style={{color,borderColor:color}}>{horas} hrs hábiles</span>
}

function EditModal({ rule, onClose, onSaved }) {
  const [horas, setHoras] = useState(rule.horas_entrega ?? rule.horas_entrega)
  const [notas, setNotas] = useState(rule.notas||'')
  const [saving, setSaving] = useState(false)
  console.log('EditModal rule:', JSON.stringify(rule))
  const save = async () => {
    if (!rule?.id) { alert('Error: ID de regla no encontrado'); return }
    setSaving(true)
    try {
      await api.put('/delivery-rules/' + rule.id, { horas_entrega: horas, notas: notas, activo: true })
      onSaved()
      onClose()
    } catch(e) {
      alert('Error al guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>{rule.tipo==='region'?'🗺️':'📍'} {rule.nombre}</div>
            <div className={styles.modalSub}>{rule.tipo==='region'?'Regla regional':'Excepción por comuna'}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formField}>
            <label>Tiempo de entrega (horas hábiles)</label>
            <div className={styles.horasGrid}>
              {HORAS_OPTIONS.map(o=>(
                <button key={String(o.value)}
                  className={`${styles.horasOpt} ${horas===o.value?styles.horasOptOn:''}`}
                  onClick={()=>setHoras(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className={styles.formField}>
            <label>Notas internas</label>
            <textarea className={styles.textarea} rows={2} value={notas}
              onChange={e=>setNotas(e.target.value)} placeholder="Ej: Solo despacho los martes"/>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>💾 Guardar</Button>
        </div>
      </div>
    </div>
  )
}

function ComunaSearch({ onSelect }) {
  const [q, setQ]       = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(false)

  const search = async (val) => {
    setQ(val)
    setSelected(false)
    if (val.length < 2) { setResults([]); return }
    const token = localStorage.getItem('lf_token')
    const res = await fetch('/api/comunas?search=' + encodeURIComponent(val), {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    })
    const data = await res.json()
    setResults(data)
  }

  const pick = (c) => {
    setQ(c.comuna)
    setResults([])
    setSelected(true)
    onSelect(c)
  }

  return (
    <div>
      <input style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontFamily:'inherit',fontSize:13,padding:'8px 10px',width:'100%',boxSizing:'border-box',outline:'none'}}
        value={q} onChange={e=>search(e.target.value)} placeholder="Escribe el nombre de la comuna..."/>
      {results.length > 0 && !selected && (
        <div style={{background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:6,marginTop:4,maxHeight:180,overflowY:'auto'}}>
          {results.map(c=>(
            <div key={c.comuna_codigo}
              style={{padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid var(--border)'}}
              onClick={()=>pick(c)}
            >
              <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{c.comuna}</div>
              <div style={{fontSize:11,color:'var(--text3)'}}>{c.region}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddComunaModal({ onClose, onSaved }) {
  const [q, setQ]         = useState('')
  const [results, setResults] = useState([])
  const [comunaData, setComunaData] = useState(null)
  const comunaRef = useRef(null)
  const [horas, setHoras] = useState(72)
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  const search = async (val) => {
    setQ(val)
    if (val.length < 2) { setResults([]); return }
    const token = localStorage.getItem('lf_token')
    const res = await fetch('/api/comunas?search=' + encodeURIComponent(val), {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    })
    setResults(await res.json())
  }

  const pick = (c) => {
    comunaRef.current = c
    setComunaData(c)
    setQ(c.comuna)
    setResults([])
  }

  const save = async () => {
    const data = comunaData || comunaRef.current
    if (!data) { alert('Debes seleccionar una comuna primero'); return }
    setSaving(true)
    try {
      await api.post('/delivery-rules', { tipo:'comuna', codigo:data.comuna_codigo, nombre:data.comuna, horas_entrega:horas, notas })
      onSaved(); onClose()
    } catch(e) { alert('Error: '+e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>➕ Excepción por comuna</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formField}>
            <label>Buscar comuna</label>
            <input className={styles.input} value={q} onChange={e=>search(e.target.value)} placeholder="Escribe nombre de la comuna..."/>
            {results.length > 0 && (
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,maxHeight:160,overflowY:'auto',marginTop:2}}>
                {results.map(c=>(
                  <div key={c.comuna_codigo} style={{padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid var(--border)'}} onMouseDown={e=>{e.preventDefault();e.stopPropagation();pick(c)}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{c.comuna}</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{c.region}</div>
                  </div>
                ))}
              </div>
            )}
            {comunaData && <div className={styles.comunaInfo}>✅ {comunaData.comuna} — {comunaData.region}</div>}
          </div>
          <div className={styles.formField}>
            <label>Tiempo de entrega (horas hábiles)</label>
            <div className={styles.horasGrid}>
              {HORAS_OPTIONS.map(o=>(
                <button key={String(o.value)} className={`${styles.horasOpt} ${horas===o.value?styles.horasOptOn:''}`} onClick={()=>setHoras(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className={styles.formField}>
            <label>Notas</label>
            <textarea className={styles.textarea} rows={2} value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Motivo..."/>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>💾 Guardar excepción</Button>
        </div>
      </div>
    </div>
  )
}


export default function DeliveryRules() {
  const qc = useQueryClient()
  const [editing, setEditing]           = useState(null)
  const [addComuna, setAddComuna]       = useState(false)
  const [expandedRegion, setExpandedRegion] = useState(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [toast, setToast]               = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const { data: rules=[], isLoading, refetch } = useQuery({
    queryKey: ['delivery-rules'],
    queryFn: () => api.get('/delivery-rules'),
  })

  const { data: config={}, refetch: refetchConfig } = useQuery({
    queryKey: ['delivery-config'],
    queryFn: () => api.get('/delivery-config'),
  })

  const [localConfig, setLocalConfig] = useState({})
  const cfg = { ...config, ...localConfig }
  const setC = (k,v) => setLocalConfig(c=>({...c,[k]:v}))

  const saveConfig = async () => {
    setSavingConfig(true)
    try {
      await api.put('/delivery-config', localConfig)
      refetchConfig()
      setLocalConfig({})
      showToast('✓ Configuración guardada')
    } finally { setSavingConfig(false) }
  }

  const toggleDia = (dia) => {
    const dias = (cfg.dias_habiles||'').split(',').filter(Boolean)
    const next = dias.includes(dia) ? dias.filter(d=>d!==dia) : [...dias,dia]
    setC('dias_habiles', next.join(','))
  }

  const regions = rules.filter(r=>r.tipo==='region')
  const comunas = rules.filter(r=>r.tipo==='comuna')

  const deleteRule = async (id) => {
    if (!confirm('¿Eliminar esta excepción?')) return
    await api.delete(`/delivery-rules/${id}`)
    refetch()
    showToast('Excepción eliminada')
  }

  const { data: allComunas=[] } = useQuery({
    queryKey: ['comunas-by-region', expandedRegion],
    queryFn: () => api.get(`/comunas?region=${expandedRegion}`),
    enabled: !!expandedRegion,
  })

  return (
    <div className={styles.page}>
      <Header/>
      <div className={styles.content}>

        {/* Configuración general */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>⚙️ Configuración general</div>
              <div className={styles.cardSub}>Parámetros base para el cálculo de tiempos de entrega</div>
            </div>
            {Object.keys(localConfig).length > 0 && (
              <Button size="sm" onClick={saveConfig} loading={savingConfig}>💾 Guardar cambios</Button>
            )}
          </div>
          <div className={styles.configBody}>
            <div className={styles.configField}>
              <label>🕐 Hora de corte diaria</label>
              <div className={styles.configHint}>Pedidos antes de esta hora se procesan el mismo día</div>
              <select className={styles.select} value={cfg.hora_corte||'11:00'} onChange={e=>setC('hora_corte',e.target.value)}>
                {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(h=>(
                  <option key={h} value={h}>{h} hrs</option>
                ))}
              </select>
            </div>
            <div className={styles.configField}>
              <label>📅 Días hábiles de despacho</label>
              <div className={styles.configHint}>Días en que se procesan y despachan pedidos</div>
              <div className={styles.diasGrid2}>
                {DIAS_SEMANA.map(d => {
                  const isOn = (cfg.dias_habiles||'').includes(d)
                  return (
                    <button key={d} className={`${styles.diaBtn} ${isOn?styles.diaBtnOn:''}`}
                      onClick={()=>toggleDia(d)}>
                      {d.charAt(0).toUpperCase()+d.slice(1,3)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className={styles.configField} style={{gridColumn:'1/-1'}}>
              <label>💬 Mensaje de tiempo de entrega</label>
              <div className={styles.configHint}>Usa {'{horas}'} para insertar el tiempo calculado</div>
              <input className={styles.input} value={cfg.mensaje_entrega||''} onChange={e=>setC('mensaje_entrega',e.target.value)}/>
            </div>
          </div>
        </Card>

        {/* Regiones */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>🗺️ Tiempos por región</div>
              <div className={styles.cardSub}>Haz click en una región para ver y editar sus comunas</div>
            </div>
            <Button size="sm" onClick={()=>setAddComuna(true)}>➕ Excepción por comuna</Button>
          </div>
          {isLoading ? <div style={{padding:20}}><Spinner/></div> : (
            <div className={styles.regionsList}>
              {regions.map(r => {
                const comunasExcep = comunas.filter(c=>c.codigo.startsWith(r.codigo))
                const isExpanded = expandedRegion===r.codigo
                return (
                  <div key={r.id} className={styles.regionRow}>
                    <div className={styles.regionMain} onClick={()=>setExpandedRegion(isExpanded?null:r.codigo)}
                      style={{cursor:'pointer'}}>
                      <div className={styles.regionInfo}>
                        <span className={styles.regionArrow}>{isExpanded?'▼':'▶'}</span>
                        <span className={styles.regionName}>
                          {r.nombre.replace('Región del ','').replace('Región de la ','').replace('Región de ','').replace('Región ','').replace('Región','').trim()}
                        </span>
                        {comunasExcep.length>0 && (
                          <span className={styles.excepTag}>{comunasExcep.length} excepción{comunasExcep.length!==1?'es':''}</span>
                        )}
                      </div>
                      <div className={styles.regionActions} onClick={e=>e.stopPropagation()}>
                        <HorasBadge horas={r.horas_entrega}/>
                        <button className={styles.editBtn} onClick={()=>setEditing(r)}>✏️</button>
                      </div>
                    </div>

                    {/* Comunas expandidas */}
                    {isExpanded && (
                      <div className={styles.comunasExpand}>
                        <div className={styles.comunasExpandHeader}>
                          <span className={styles.comunasExpandTitle}>Comunas de {r.nombre.replace('Región del ','').replace('Región de la ','').replace('Región de ','')}</span>
                          <span className={styles.comunasExpandHint}>Las sin excepción heredan las {r.horas_entrega} hrs de la región</span>
                        </div>
                        <div className={styles.comunasExpandGrid}>
                          {allComunas.map(c => {
                            const excep = comunasExcep.find(e=>e.codigo===c.comuna_codigo)
                            return (
                              <div key={c.comuna_codigo} className={`${styles.comunaCell} ${excep?styles.comunaCellExcep:''}`}>
                                <span className={styles.comunaCellName}>{c.comuna}</span>
                                {excep ? (
                                  <div className={styles.comunaCellBadge}>
                                    <HorasBadge horas={excep.horas_entrega}/>
                                    <button className={styles.editBtnSm} onClick={()=>setEditing(excep)}>✏️</button>
                                    <button className={styles.delBtnSm} onClick={()=>deleteRule(excep.id)}>✕</button>
                                  </div>
                                ) : (
                                  <button className={styles.addExcepBtn} onClick={()=>{
                                    setAddComuna(true)
                                  }}>+ excepción</button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {editing && <EditModal rule={editing} onClose={()=>setEditing(null)} onSaved={()=>{refetch();showToast('✓ Guardado')}}/>}
      {addComuna && <AddComunaModal onClose={()=>setAddComuna(false)} onSaved={()=>{refetch();showToast('✓ Excepción agregada')}}/>}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
