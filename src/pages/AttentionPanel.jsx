import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast } from '@/components/ui'
import { fmt, withIva } from '@/utils/format'
import api from '@/utils/api'
import styles from './AttentionPanel.module.css'

// ── Modal Analizador de Neumático ────────────────────────────
function TireModal({ lead, onClose }) {
  const navigate = useNavigate()
  const fileRef  = useRef(null)
  const [image, setImage]         = useState(null)
  const [preview, setPreview]     = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult]       = useState(null)
  const [selected, setSelected]   = useState([])
  const [cantidad, setCantidad]   = useState(4)
  const [toast2, setToast2]       = useState('')
  const showT = msg => { setToast2(msg); setTimeout(()=>setToast2(''),3000) }

  const TIER_COLOR = { Premium:'#a78bfa', Conveniencia:'#60a5fa', Económico:'#34d399' }

  const handleFile = (file) => {
    if (!file) return
    setImage(file)
    setResult(null)
    setSelected([])
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const analyze = async () => {
    if (!image) return
    setAnalyzing(true)
    try {
      const fd = new FormData()
      fd.append('image', image)
      const token = localStorage.getItem('lf_token')
      const res = await fetch('/api/attention/analyze-tire', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
      if (data.productos?.length) setSelected([data.productos[0].id])
    } catch(e) { showT('Error: ' + e.message) }
    finally { setAnalyzing(false) }
  }

  const toggleSelect = id => setSelected(s => s.includes(id)?s.filter(x=>x!==id):[...s,id])

  const selectedProds = result?.productos?.filter(p=>selected.includes(p.id)) || []
  const tire = result?.tire_info
  const byTier = {}
  ;(result?.productos||[]).forEach(p => {
    const t = p.tier||'Económico'
    if(!byTier[t]) byTier[t]=[]
    byTier[t].push(p)
  })

  const goToQuote = () => {
    sessionStorage.setItem('tire_quote', JSON.stringify({ products: selectedProds, medida: tire?.medida, cantidad, lead_id: lead?.id }))
    navigate('/quotes/new')
    onClose()
  }

  return (
    <div className={styles.tireOverlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={styles.tireModal}>
        <div className={styles.tireModalHeader}>
          <div className={styles.tireModalTitle}>📸 Analizar neumático con IA</div>
          <button className={styles.tireClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.tireModalBody}>
          {/* Left: upload */}
          <div className={styles.tireLeft}>
            <div className={styles.tireDropZone} onClick={()=>fileRef.current?.click()}
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0])}}>
              {preview
                ? <img src={preview} className={styles.tirePreview} alt=""/>
                : <div className={styles.tireDropContent}>
                    <div style={{fontSize:40}}>📷</div>
                    <div className={styles.tireDropText}>Arrastra o haz click para subir foto</div>
                    <div className={styles.tireDropHint}>Foto del flanco o neumático completo</div>
                  </div>
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
              onChange={e=>handleFile(e.target.files[0])}/>
            <div className={styles.tireUploadRow}>
              <Button onClick={analyze} loading={analyzing} disabled={!image}>
                {analyzing?'🔍 Analizando...':'🤖 Analizar con IA'}
              </Button>
              {preview && <Button variant="ghost" onClick={()=>{setImage(null);setPreview(null);setResult(null)}}>🗑️</Button>}
            </div>

            {/* Datos detectados */}
            {tire && (
              <div className={styles.tireData}>
                <div className={styles.tireMedidaBig}>{tire.medida || '—'}</div>
                <div className={styles.tireDataGrid}>
                  {tire.marca && <div className={styles.tireDataItem}><span>Marca</span><strong>{tire.marca}</strong></div>}
                  {tire.modelo && <div className={styles.tireDataItem}><span>Modelo</span><strong>{tire.modelo}</strong></div>}
                  {tire.indice_carga && <div className={styles.tireDataItem}><span>Carga</span><strong>{tire.indice_carga}</strong></div>}
                  {tire.indice_velocidad && <div className={styles.tireDataItem}><span>Vel.</span><strong>{tire.indice_velocidad}</strong></div>}
                  {tire.runflat && <div className={styles.tireDataItem}><span>Runflat</span><strong>{tire.runflat}</strong></div>}
                  {tire.condicion && <div className={styles.tireDataItem}><span>Estado</span><strong style={{color:tire.condicion==='nuevo'?'var(--green)':tire.condicion==='desgastado'?'var(--red)':'var(--yellow)'}}>{tire.condicion}</strong></div>}
                </div>
                {tire.notas && <div className={styles.tireNotas}>💡 {tire.notas}</div>}
                <div className={styles.tireConf} style={{color:tire.confianza>=80?'var(--green)':tire.confianza>=60?'var(--yellow)':'var(--red)'}}>
                  Confianza: {tire.confianza}%
                </div>
              </div>
            )}
          </div>

          {/* Right: products */}
          <div className={styles.tireRight}>
            {!result ? (
              <div className={styles.tireEmpty}>Sube una foto y analiza para ver alternativas</div>
            ) : result.productos?.length === 0 ? (
              <div className={styles.tireEmpty}>Sin productos para <strong>{tire?.medida}</strong></div>
            ) : (
              <>
                <div className={styles.tireProdsHeader}>
                  <span>{result.productos.length} productos para <strong>{tire?.medida}</strong></span>
                  <div className={styles.tireCantRow}>
                    <span>Cant:</span>
                    <input className={styles.tireCantInput} type="number" min="1" max="8"
                      value={cantidad} onChange={e=>setCantidad(parseInt(e.target.value)||4)}/>
                  </div>
                </div>
                <div className={styles.tireProdsList}>
                  {['Premium','Conveniencia','Económico'].map(tier => {
                    const items = byTier[tier]||[]
                    if (!items.length) return null
                    return (
                      <div key={tier}>
                        <div className={styles.tireTierLabel} style={{color:TIER_COLOR[tier]}}>{tier}</div>
                        {items.map(p => {
                          const precio = Math.round(parseFloat(p.price_normal||0)*1.19)
                          const isSel = selected.includes(p.id)
                          return (
                            <div key={p.id} className={`${styles.tireProd} ${isSel?styles.tireProdSel:''}`}
                              onClick={()=>toggleSelect(p.id)}>
                              <div className={`${styles.tireCheck} ${isSel?styles.tireCheckOn:''}`}>{isSel&&'✓'}</div>
                              {p.photo_url && <img src={p.photo_url} className={styles.tireProdPhoto} alt="" onError={e=>e.target.style.display='none'}/>}
                              <div className={styles.tireProdInfo}>
                                <div className={styles.tireProdBrand}>{p.brand}</div>
                                <div className={styles.tireProdName}>{p.name}</div>
                                <div className={styles.tireProdStock} style={{color:p.stock>0?'var(--green)':'var(--red)'}}>{p.stock>0?`${p.stock} disp.`:'Sin stock'}</div>
                              </div>
                              <div className={styles.tireProdPrices}>
                                <div className={styles.tireProdUnit}>{fmt.currency(precio)}/und</div>
                                <div className={styles.tireProdTotal}>{fmt.currency(precio*cantidad)}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
                {selected.length > 0 && (
                  <div className={styles.tireQuoteBar}>
                    <span>{selected.length} producto{selected.length!==1?'s':''} · ×{cantidad} und</span>
                    <Button onClick={goToQuote}>📄 Generar cotización</Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {toast2 && <Toast message={toast2} onClose={()=>setToast2('')}/>}
      </div>
    </div>
  )
}


// ── Buscador de leads ─────────────────────────────────────────
function LeadSearch({ onSelect }) {
  const [q, setQ] = useState('')
  const { data={} } = useQuery({
    queryKey: ['leads-search', q],
    queryFn: () => api.get(`/leads?search=${q}&limit=8`),
    enabled: q.length > 1,
  })
  const leads = Array.isArray(data) ? data : (data.leads || [])

  return (
    <div className={styles.searchBox}>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>🔍</span>
        <input className={styles.searchInput} placeholder="Buscar cliente por nombre o teléfono..."
          value={q} onChange={e=>setQ(e.target.value)} autoFocus/>
      </div>
      {leads.length > 0 && (
        <div className={styles.searchDrop}>
          {leads.map(l=>(
            <div key={l.id} className={styles.searchItem} onClick={()=>{ onSelect(l); setQ('') }}>
              <div className={styles.searchName}>{l.name} {l.last_name||''}</div>
              <div className={styles.searchMeta}>{l.phone} · {l.channel||'—'} · {l.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Panel izquierdo: Cliente + Conversación ───────────────────
function ClientPanel({ lead, onChangeLead }) {
  const { data: detail={} } = useQuery({
    queryKey: ['lead-detail-attention', lead.id],
    queryFn: () => api.get(`/leads/${lead.id}`),
  })
  const activities = (detail.activities||[]).filter(a=>a.channel==='WhatsApp').slice(-20)

  return (
    <div className={styles.leftPanel}>
      {/* Perfil */}
      <Card className={styles.profileCard}>
        <div className={styles.profileTop}>
          <div className={styles.profileAvatar}>{(lead.name||'?')[0].toUpperCase()}</div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>{lead.name} {lead.last_name||''}</div>
            <div className={styles.profilePhone}>{lead.phone}</div>
            <div className={styles.profileMeta}>
              <span className={styles.channelBadge}>{lead.channel||'Web'}</span>
              <span className={styles.statusBadge}>{lead.status}</span>
            </div>
          </div>
          <button className={styles.changeBtn} onClick={onChangeLead}>↩️</button>
        </div>
        {lead.email && <div className={styles.profileEmail}>✉️ {lead.email}</div>}
        {detail.orders?.length > 0 && (
          <div className={styles.prevOrders}>
            <div className={styles.prevTitle}>📦 Órdenes previas</div>
            {detail.orders.slice(0,2).map(o=>(
              <div key={o.id} className={styles.prevOrder}>
                {o.marca} {o.modelo} {o.medida} ×{o.cantidad} — {fmt.currency(o.total)}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Conversación WhatsApp */}
      <Card className={styles.chatCard}>
        <div className={styles.chatTitle}>💬 Conversación WhatsApp</div>
        <div className={styles.chatMessages}>
          {activities.length === 0 ? (
            <div className={styles.chatEmpty}>Sin mensajes registrados</div>
          ) : activities.map((a,i)=>(
            <div key={i} className={`${styles.msg} ${a.direction==='outbound'?styles.msgOut:styles.msgIn}`}>
              <div className={styles.msgBubble}>{a.content}</div>
              <div className={styles.msgTime}>{fmt.timeAgo(a.created_at)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── Panel central: IA + Productos ─────────────────────────────
function CenterPanel({ lead, summary, loadingSummary, onSummaryLoad }) {
  const [medida, setMedida] = useState(summary?.medida||'')
  const [cantidad, setCantidad] = useState(summary?.cantidad||4)

  useEffect(()=>{
    if (summary?.medida) setMedida(summary.medida)
    if (summary?.cantidad) setCantidad(summary.cantidad)
  }, [summary])

  const { data: productData={}, isLoading: loadingProducts } = useQuery({
    queryKey: ['attention-products', medida],
    queryFn: () => api.get(`/catalog?active=true&search=${encodeURIComponent(medida)}&limit=30`),
    enabled: medida.length > 3,
  })

  const products = productData.products || []
  const byTier = { Premium:[], Conveniencia:[], Económico:[] }
  products.forEach(p => {
    const tier = p.custom_fields?.tier || 'Económico'
    if (byTier[tier]) byTier[tier].push(p)
  })

  const urgencyColor = { alta:'var(--red)', media:'var(--yellow)', baja:'var(--green)' }

  return (
    <div className={styles.centerPanel}>
      {/* Resumen IA */}
      <Card className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <div className={styles.summaryTitle}>🤖 Resumen IA</div>
          <Button size="sm" onClick={()=>onSummaryLoad(true)} loading={loadingSummary}>
            {summary ? '🔄 Actualizar' : '✨ Analizar'}
          </Button>
        </div>
        {loadingSummary ? (
          <div className={styles.summaryLoading}><Spinner/> Analizando conversación...</div>
        ) : summary ? (
          <div className={styles.summaryContent}>
            <p className={styles.summaryText}>{summary.resumen}</p>
            <div className={styles.summaryTags}>
              {summary.urgencia && <span className={styles.urgTag} style={{color:urgencyColor[summary.urgencia]}}>
                ⚡ Urgencia {summary.urgencia}
              </span>}
              {summary.medida && <span className={styles.infoTag}>📏 {summary.medida}</span>}
              {summary.cantidad && <span className={styles.infoTag}>×{summary.cantidad}</span>}
              {summary.marca_preferida && <span className={styles.infoTag}>🏷️ {summary.marca_preferida}</span>}
              {summary.presupuesto && <span className={styles.infoTag}>💰 {summary.presupuesto}</span>}
            </div>
            {summary.accion_recomendada && (
              <div className={styles.accionBox}>
                <strong>Acción recomendada:</strong> {summary.accion_recomendada}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.summaryEmpty}>Haz click en "Analizar" para obtener un resumen con IA</div>
        )}
      </Card>

      {/* Búsqueda por medida */}
      <Card className={styles.productsCard}>
        <div className={styles.productsHeader}>
          <div className={styles.productsTitle}>🔍 Productos por medida</div>
          <div className={styles.medidaRow}>
            <input className={styles.medidaInput} placeholder="Ej: 205/55 R16" value={medida}
              onChange={e=>setMedida(e.target.value)}/>
            <input className={styles.cantInput} type="number" min="1" max="8" value={cantidad}
              onChange={e=>setCantidad(parseInt(e.target.value)||4)}/>
            <span className={styles.cantLabel}>und</span>
          </div>
        </div>

        {loadingProducts ? <div className={styles.productsLoading}><Spinner/></div> :
        medida.length < 4 ? <div className={styles.productsEmpty}>Ingresa una medida para ver productos disponibles</div> :
        products.length === 0 ? <div className={styles.productsEmpty}>Sin productos para esta medida</div> : (
          <div className={styles.tiersList}>
            {Object.entries(byTier).map(([tier, items]) => items.length === 0 ? null : (
              <div key={tier} className={styles.tierGroup}>
                <div className={styles.tierTitle} style={{
                  color: tier==='Premium'?'#a78bfa':tier==='Conveniencia'?'#60a5fa':'#34d399'
                }}>{tier}</div>
                {items.slice(0,2).map(p=>{
                  const precio = Math.round(parseFloat(p.price_normal||0)*1.19)
                  const total  = precio * cantidad
                  return (
                    <div key={p.id} className={styles.productRow}>
                      <div className={styles.productInfo}>
                        <div className={styles.productName}>{p.brand} — {p.name}</div>
                        <div className={styles.productMedida}>{p.custom_fields?.medida}</div>
                      </div>
                      <div className={styles.productPrices}>
                        <div className={styles.productUnit}>{fmt.currency(precio)}/und</div>
                        <div className={styles.productTotal}>{fmt.currency(total)} ×{cantidad}</div>
                      </div>
                      <div className={styles.productStock}>
                        <span style={{color:p.stock>0?'var(--green)':'var(--red)',fontSize:11,fontWeight:700}}>
                          {p.stock>0?`${p.stock} disp.`:'Sin stock'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Panel derecho: Talleres + Costos + Acciones ───────────────
function RightPanel({ lead, summary, products, cantidad, clientLat, clientLng, clientAddr, setClientAddr, setClientLat, setClientLng }) {
  const navigate = useNavigate()
  const leadRef = useRef(lead)
  useEffect(() => { leadRef.current = lead }, [lead])
  const [fecha, setFecha]           = useState(new Date().toISOString().slice(0,10))

  const [selectedWorkshop, setSelectedWorkshop] = useState(null)
  const [selectedHora, setSelectedHora] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [toast, setToast] = useState('')
  const [addrQuery, setAddrQuery] = useState('')
  const [addrSuggestions, setAddrSuggestions] = useState([])
  const [addrLoading, setAddrLoading] = useState(false)
  const [addrOpen, setAddrOpen] = useState(false)
  const addrTimer = useRef(null)
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  // Autocomplete via backend proxy (avoids API key browser restrictions)
  const searchAddr = (val) => {
    setAddrQuery(val)
    setAddrOpen(false)
    clearTimeout(addrTimer.current)
    if (val.length < 3) { setAddrSuggestions([]); return }
    addrTimer.current = setTimeout(async () => {
      setAddrLoading(true)
      try {
        const token = localStorage.getItem('lf_token')
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(val)}`, {
          headers: token ? { Authorization: 'Bearer ' + token } : {}
        })
        const data = await res.json()
        const sug = (data.suggestions || []).map(s => ({
          text: s.placePrediction?.text?.text || '',
          placeId: s.placePrediction?.placeId || '',
        })).filter(s => s.text)
        setAddrSuggestions(sug)
        setAddrOpen(sug.length > 0)
      } catch(e) { console.error('Places error:', e) }
      finally { setAddrLoading(false) }
    }, 350)
  }

  const selectAddr = async (sug) => {
    setAddrOpen(false)
    setAddrQuery(sug.text)
    try {
      const token = localStorage.getItem('lf_token')
      const res = await fetch(`/api/places/details?place_id=${sug.placeId}`, {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      })
      const data = await res.json()
      const addr = data.formattedAddress || sug.text
      const lat  = data.location?.latitude || null
      const lng  = data.location?.longitude || null
      setClientAddr(addr)
      setClientLat(lat)
      setClientLng(lng)
      if (leadRef.current?.id && addr) {
        try { await api.patch(`/leads/${leadRef.current.id}/address`, { address: addr, lat, lng }) }
        catch(err) { console.error('Error guardando dirección:', err) }
      }
    } catch(err) { console.error('Places details error:', err) }
  }

  const confirmManualAddr = (val) => {
    if (!val.trim()) return
    setClientAddr(val.trim())
    setAddrQuery('')
    setAddrSuggestions([])
  }

  const medida = summary?.medida || ''
  const aro = medida ? medida.match(/R(\d+)/i)?.[1] : null

  const { data: workshops=[], isLoading } = useQuery({
    queryKey: ['attention-workshops', fecha, aro, clientLat, clientLng],
    queryFn: () => api.get(`/attention/workshops?fecha=${fecha}&aro=${aro||''}&lat=${clientLat}&lng=${clientLng}`),
    enabled: !!clientLat && !!clientLng,
  })

  const workshopsCercanos = workshops.filter(w => w.distancia_km === null || w.distancia_km <= 100)
  const workshopsConCupos = workshopsCercanos.filter(w=>w.cupos_disponibles>0)

  const precioNeumaticos = selectedProduct
    ? Math.round(parseFloat(selectedProduct.price_normal||0)*1.19) * (cantidad||4)
    : 0
  const precioMontaje   = selectedWorkshop ? (parseFloat(selectedWorkshop.precio_montaje||0) * (cantidad||4)) : 0
  const precioBalanceo  = selectedWorkshop ? (parseFloat(selectedWorkshop.precio_balanceo||0) * (cantidad||4)) : 0
  const totalFinal      = precioNeumaticos + precioMontaje + precioBalanceo

  const crearCotizacion = () => {
    navigate(`/leads/${lead.id}`)
    showToast('Redirigiendo al lead para crear cotización...')
  }

  return (
    <div className={styles.rightPanel}>
      {/* Ubicación del cliente */}
      <Card className={styles.locationCard}>
        <div className={styles.locationTitle}>📍 Ubicación del cliente</div>
        {!clientAddr ? (
          <div style={{position:'relative'}}>
            <div style={{position:'relative',display:'flex',alignItems:'center'}}>
              <span style={{position:'absolute',left:10,color:'#9ca3af',pointerEvents:'none',fontSize:13}}>🔍</span>
              <input
                className={styles.locationInput}
                placeholder="Buscar dirección..."
                value={addrQuery}
                autoComplete="off"
                onChange={e => searchAddr(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setAddrOpen(false) }}
                onBlur={() => setTimeout(() => setAddrOpen(false), 200)}
                onFocus={() => addrSuggestions.length > 0 && setAddrOpen(true)}
              />
              {addrLoading && <span style={{position:'absolute',right:10,fontSize:11,color:'#9ca3af'}}>...</span>}
            </div>
            {addrOpen && addrSuggestions.length > 0 && (
              <div className={styles.addrDrop}>
                {addrSuggestions.map((s,i) => (
                  <div key={i} className={styles.addrItem} onMouseDown={() => selectAddr(s)}>
                    📍 {s.text}
                  </div>
                ))}
              </div>
            )}
            <input
              className={styles.locationFallback}
              placeholder="O escribe la dirección manualmente y presiona Enter..."
              style={{marginTop:6}}
              onKeyDown={e => { if (e.key === 'Enter') confirmManualAddr(e.target.value) }}
            />
          </div>
        ) : (
          <div className={styles.clientAddr}>
            <span>📍 {clientAddr}</span>
            <button className={styles.clearAddr} onClick={() => {
              setClientAddr('')
              setClientLat(null)
              setClientLng(null)
              setAddrQuery('')
              setAddrSuggestions([])
            }}>✕</button>
          </div>
        )}
      </Card>

      {/* Talleres */}
      <Card className={styles.workshopsCard}>
        <div className={styles.workshopsHeader}>
          <div className={styles.workshopsTitle}>🔧 Talleres disponibles</div>
          <input type="date" className={styles.dateInput} value={fecha} onChange={e=>setFecha(e.target.value)}/>
        </div>
        {isLoading ? <Spinner/> :
        !clientLat ? <div className={styles.wsEmpty}>📍 Ingresa la ubicación del cliente para ver talleres cercanos</div> :
        workshopsCercanos.length === 0 ? <div className={styles.wsEmpty}>Sin talleres en un radio de 100 km</div> : (
          <div className={styles.workshopsList}>
            {workshopsCercanos.slice(0,8).map(w=>(
              <div key={w.id}
                className={`${styles.workshopItem} ${selectedWorkshop?.id===w.id?styles.wsSelected:''}`}
                onClick={()=>{ setSelectedWorkshop(w); setSelectedHora(null) }}>
                <div className={styles.wsInfo}>
                  <div className={styles.wsTop}>
                    <div className={styles.wsName}>{w.nombre_comercial}</div>
                    {w.distancia_km !== null && <span className={styles.wsDist}>📍 {w.distancia_km} km</span>}
                  </div>
                  <div className={styles.wsComuna}>📍 {w.comuna}</div>
                  {w.cupos_disponibles > 0 ? (
                    <div className={styles.wsCupos}>✅ {w.cupos_disponibles} cupos disponibles</div>
                  ) : (
                    <div className={styles.wsNoCupos}>❌ Sin cupos para esta fecha</div>
                  )}
                </div>
                <div className={styles.wsPrices}>
                  {w.precio_montaje && <div className={styles.wsPrice}>Montaje: {fmt.currency(w.precio_montaje)}</div>}
                  {w.precio_balanceo && <div className={styles.wsPrice}>Balanceo: {fmt.currency(w.precio_balanceo)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Horarios del taller seleccionado */}
        {selectedWorkshop && selectedWorkshop.horarios_disponibles?.length > 0 && (
          <div className={styles.horariosSection}>
            <div className={styles.horariosTitle}>🕐 Horarios disponibles — {selectedWorkshop.nombre_comercial}</div>
            <div className={styles.horariosGrid}>
              {selectedWorkshop.horarios_disponibles.map(h=>(
                <button key={h} className={`${styles.horaBtn} ${selectedHora===h?styles.horaOn:''}`}
                  onClick={()=>setSelectedHora(h)}>{h}</button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Resumen de costos */}
      <Card className={styles.costsCard}>
        <div className={styles.costsTitle}>💰 Resumen de costos</div>
        <div className={styles.costsList}>
          <div className={styles.costRow}>
            <span>Neumáticos ×{cantidad||4}</span>
            <span>{precioNeumaticos > 0 ? fmt.currency(precioNeumaticos) : '—'}</span>
          </div>
          <div className={styles.costRow}>
            <span>Montaje ×{cantidad||4}</span>
            <span>{precioMontaje > 0 ? fmt.currency(precioMontaje) : '—'}</span>
          </div>
          <div className={styles.costRow}>
            <span>Balanceo ×{cantidad||4}</span>
            <span>{precioBalanceo > 0 ? fmt.currency(precioBalanceo) : '—'}</span>
          </div>
          <div className={styles.costTotal}>
            <span>TOTAL</span>
            <span>{totalFinal > 0 ? fmt.currency(totalFinal) : '—'}</span>
          </div>
        </div>
        {!selectedWorkshop && <div className={styles.costsHint}>Selecciona un taller para ver el costo de instalación</div>}
        {!selectedProduct && <div className={styles.costsHint}>Selecciona un producto en el panel central</div>}
      </Card>

      {/* Acciones */}
      <Card className={styles.actionsCard}>
        <div className={styles.actionsTitle}>⚡ Acciones rápidas</div>
        <div className={styles.actionsList}>
          <Button onClick={crearCotizacion} style={{width:'100%'}}>
            📄 Crear cotización
          </Button>
          <Button variant="ghost" style={{width:'100%'}} onClick={()=>navigate(`/leads/${lead.id}`)}>
            👤 Ver lead completo
          </Button>
          {selectedWorkshop && selectedHora && (
            <Button variant="ghost" style={{width:'100%'}} onClick={()=>showToast('Agendamiento próximamente')}>
              📅 Agendar instalación — {selectedHora}
            </Button>
          )}
        </div>
      </Card>

      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}


// ── Main ──────────────────────────────────────────────────────
export default function AttentionPanel() {
  const navigate = useNavigate()
  const [showTireModal, setShowTireModal] = useState(false)
  const [lead, setLead]         = useState(null)
  const [clientLat, setClientLat]   = useState(null)
  const [clientLng, setClientLng]   = useState(null)
  const [clientAddr, setClientAddr] = useState('')
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const loadSummary = async (force = false) => {
    if (!lead) return
    setLoadingSummary(true)
    try {
      const data = await api.post('/attention/summary', { lead_id: lead.id, force })
      setSummary(data)
    } catch(e) {
      showToast('Error al analizar: ' + e.message)
    } finally { setLoadingSummary(false) }
  }

  // Auto-cargar resumen al seleccionar lead (usa caché del día)
  useEffect(() => {
    if (lead) { 
      setSummary(null)
      loadSummary(false)
      setClientAddr('')
      setClientLat(null)
      setClientLng(null)
    }
  }, [lead?.id])

  return (
    <div className={styles.page}>
      <Header/>
      <div className={styles.content}>
        {!lead ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>🎧</div>
            <div className={styles.welcomeTitle}>Panel de Atención al Cliente</div>
            <div className={styles.welcomeSub}>Busca un cliente para comenzar</div>
            <LeadSearch onSelect={l=>{ setLead(l); setSummary(null) }}/>
          </div>
        ) : (
          <>
            {/* Barra superior con buscador */}
            <div className={styles.topBar}>
              <div className={styles.topBarLeft}>
                <span className={styles.topBarLabel}>Cliente activo:</span>
                <strong className={styles.topBarName}>{lead.name} {lead.last_name||''}</strong>
                <span className={styles.topBarPhone}>{lead.phone}</span>
              </div>
              <LeadSearch onSelect={l=>{ setLead(l); setSummary(null) }}/>
            </div>

            {/* Accesos rápidos */}
            <div className={styles.quickAccess}>
              <div className={styles.quickCard} onClick={()=>setShowTireModal(true)}>
                <span className={styles.quickIcon}>📸</span>
                <div>
                  <div className={styles.quickTitle}>Analizar neumático</div>
                  <div className={styles.quickSub}>Sube una foto y detecta la medida con IA</div>
                </div>
              </div>
            </div>

            {/* 3 columnas */}
            <div className={styles.panels}>
              <ClientPanel lead={lead} onChangeLead={()=>{ setLead(null); setSummary(null) }}/>
              <CenterPanel lead={lead} summary={summary} loadingSummary={loadingSummary} onSummaryLoad={(force)=>loadSummary(force)}/>
              <RightPanel lead={lead} summary={summary} cantidad={summary?.cantidad||4} clientLat={clientLat} clientLng={clientLng} clientAddr={clientAddr} setClientAddr={setClientAddr} setClientLat={setClientLat} setClientLng={setClientLng}/>
            </div>
          </>
        )}
      </div>
      {showTireModal && <TireModal lead={lead} onClose={()=>setShowTireModal(false)} />}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
