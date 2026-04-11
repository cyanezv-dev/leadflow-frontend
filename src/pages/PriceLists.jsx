import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast, Modal, Input } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './PriceLists.module.css'

// ── Modal crear/editar lista ──────────────────────────────────
function ListModal({ list, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: list?.name || '',
    description: list?.description || '',
    discount_pct: list?.discount_pct || 0,
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const save = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      if (list?.id) await api.put(`/price-lists/${list.id}`, form)
      else          await api.post('/price-lists', form)
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title={list?.id ? 'Editar lista' : 'Nueva lista de precios'} onClose={onClose} width={480}>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <Input label="Nombre de la lista *" placeholder="Ej: Lista Distribuidores Norte" value={form.name} onChange={e=>set('name',e.target.value)}/>
        <Input label="Descripción" placeholder="Descripción opcional" value={form.description} onChange={e=>set('description',e.target.value)}/>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          <label style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.5px'}}>Modo de precio por defecto</label>
          <select style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',color:'var(--text)',fontFamily:'var(--font-body)',fontSize:13,padding:'8px 12px',outline:'none'}}
            value={form.default_mode||'descuento'} onChange={e=>set('default_mode',e.target.value)}>
            <option value="descuento">% Descuento sobre precio lista</option>
            <option value="precio_fijo">💲 Precio fijo (sin descuento)</option>
          </select>
        </div>
        {(form.default_mode||'descuento') === 'descuento' && (
          <Input label="% Descuento global" type="number" min="0" max="100" placeholder="15" value={form.discount_pct} onChange={e=>set('discount_pct',e.target.value)}/>
        )}
        <div style={{fontSize:12,color:'var(--text3)',background:'var(--bg3)',padding:'8px 12px',borderRadius:'var(--radius-sm)'}}>
          {(form.default_mode||'descuento')==='descuento'
            ? 'El % se aplica a todos los productos por defecto. Se puede ajustar individualmente.'
            : 'El precio ingresado será el precio final sin descuento. Se puede cambiar por producto.'}
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={saving} disabled={!form.name}>
          {list?.id ? '💾 Guardar' : '✓ Crear lista'}
        </Button>
      </div>
    </Modal>
  )
}

// ── Vista detalle de una lista ────────────────────────────────
function ListDetail({ list, onBack, onRefresh }) {
  const qc = useQueryClient()
  const [toast, setToast] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogResults, setCatalogResults] = useState([])
  const [newItem, setNewItem] = useState({ product_name:'', base_price:'', discount_pct: list.discount_pct })
  const [applyGlobal, setApplyGlobal] = useState(false)
  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),3000) }
  const [matching, setMatching] = useState(false)
  const [matchResults, setMatchResults] = useState(null)
  const [noMatchSearch, setNoMatchSearch] = useState({})
  const [noMatchCatalog, setNoMatchCatalog] = useState({})

  const searchForNoMatch = async (idx, q) => {
    setNoMatchSearch(s => ({...s, [idx]: q}))
    if (q.length < 2) { setNoMatchCatalog(c => ({...c, [idx]: []})); return }
    const data = await api.get('/catalog?active=true&search=' + q + '&limit=6')
    setNoMatchCatalog(c => ({...c, [idx]: data.products || []}))
  }

  const assignToNoMatch = (idx, product) => {
    setMatchResults(prev => prev.map((r,i) => i===idx ? {
      ...r,
      matched_product: {
        id: product.id, name: product.name, brand: product.brand,
        medida: product.custom_fields?.medida, codigo_sku: product.custom_fields?.codigo_sku,
        price_normal: product.price_normal,
      },
      match_type: 'manual',
      confidence: 100,
      approved: true,
    } : r))
    setNoMatchSearch(s => ({...s, [idx]: ''}))
    setNoMatchCatalog(c => ({...c, [idx]: []}))
  }

  const [matchProgress, setMatchProgress] = useState('')
  const [matchError, setMatchError] = useState('')

  const handleMatch = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setMatching(true); setMatchResults(null); setMatchError('')
    
    // Contador de tiempo
    let secs = 0
    const timer = setInterval(() => {
      secs++
      setMatchProgress('Analizando con IA... ' + secs + 's')
      if (secs > 550) {
        clearInterval(timer)
        setMatchError('El análisis tardó demasiado. Intenta con un archivo más pequeño.')
        setMatching(false)
      }
    }, 1000)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('lf_token')
      const res = await fetch('/api/price-lists/' + list.id + '/match', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd
      })
      clearInterval(timer)
      if (!res.ok) throw new Error('Error del servidor (' + res.status + ')')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const withAutoApprove = data.results.map(r => ({
        ...r,
        approved: r.confidence === 100
      }))
      setMatchResults(withAutoApprove)
      showToast('✓ Análisis completado — ' + data.results.length + ' productos analizados')
    } catch(err) {
      clearInterval(timer)
      setMatchError('Error: ' + err.message + '. Intenta de nuevo.')
      showToast('Error en el análisis')
    } finally { setMatching(false); setMatchProgress(''); e.target.value='' }
  }

  const toggleApprove = (idx) => {
    setMatchResults(prev => prev.map((r,i) => i===idx ? {...r, approved: !r.approved} : r))
  }

  const approveAll = () => setMatchResults(prev => prev.map(r => ({...r, approved: !!r.matched_product})))
  const rejectAll  = () => setMatchResults(prev => prev.map(r => ({...r, approved: false})))

  const saveApproved = async () => {
    const approved = matchResults.filter(r => r.approved && r.matched_product)
    if (!approved.length) { showToast('No hay items aprobados'); return }
    const res = await api.post('/price-lists/' + list.id + '/match/approve', {
      approved_items: approved.map(r => ({
        product_id: r.matched_product.id,
        product_name: r.matched_product.name,
        precio_lista: r.row_data.precio_lista,
        precio_final: r.row_data.precio_final || 0,
      }))
    })
    showToast('✓ ' + res.saved + ' productos guardados')
    setMatchResults(null)
    refetchItems()
  }

  const exportMapping = async () => {
    const approved = matchResults.filter(r => r.approved && r.matched_product)
    if (!approved.length) { showToast('No hay items aprobados para exportar'); return }
    const token = localStorage.getItem('lf_token')
    const res = await fetch('/api/price-lists/export-mapping', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{}) },
      body: JSON.stringify({
        approved_items: approved.map(r => ({
          codigo_proveedor: r.row_data.codigo_proveedor,
          descripcion: r.row_data.descripcion,
          codigo_sku: r.matched_product.codigo_sku,
          codigo_interno: r.matched_product.id,
          product_name: r.matched_product.name,
          precio_lista: r.row_data.precio_lista,
        }))
      })
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='mapeo_codigos.xlsx'; a.click()
    URL.revokeObjectURL(url)
    showToast('✓ Archivo de mapeo descargado')
  }


  const { data: items=[], refetch: refetchItems } = useQuery({
    queryKey: ['price-list-items', list.id],
    queryFn: () => api.get(`/price-lists/${list.id}/items`),
  })

  const { data: assignments=[], refetch: refetchAssign } = useQuery({
    queryKey: ['price-list-assignments', list.id],
    queryFn: () => api.get(`/price-lists/${list.id}/assignments`),
  })

  const { data: leads=[] } = useQuery({
    queryKey: ['leads-mini'],
    queryFn: () => api.get('/leads'),
  })

  const searchCatalog = async (q) => {
    setCatalogSearch(q)
    if (q.length < 2) { setCatalogResults([]); return }
    const data = await api.get(`/catalog?active=true&search=${q}&limit=8`)
    setCatalogResults(data.products || [])
  }

  const addFromCatalog = (p) => {
    const cf = p.custom_fields || {}
    const netPrice = parseFloat(p.price_offer||0)>0&&parseFloat(p.price_offer)<parseFloat(p.price_normal)
      ? parseFloat(p.price_offer) : parseFloat(p.price_normal||0)
    setNewItem({ product_name: p.name, base_price: netPrice, discount_pct: list.discount_pct, product_id: p.id })
    setCatalogSearch(''); setCatalogResults([])
  }

  const addItem = async () => {
    if (!newItem.product_name || !newItem.base_price) return
    await api.post(`/price-lists/${list.id}/items`, newItem)
    setNewItem({ product_name:'', base_price:'', discount_pct: list.discount_pct })
    refetchItems()
    showToast('Producto agregado')
  }

  const updateItem = async (itemId, data) => {
    await api.put(`/price-lists/${list.id}/items/${itemId}`, data)
    refetchItems()
    setEditingItem(null)
    showToast('Actualizado')
  }

  const deleteItem = async (itemId) => {
    if (!confirm('¿Eliminar producto de la lista?')) return
    await api.delete(`/price-lists/${list.id}/items/${itemId}`)
    refetchItems()
    showToast('Eliminado')
  }

  const assignLead = async (leadId) => {
    await api.post(`/price-lists/${list.id}/assignments`, { lead_id: leadId })
    refetchAssign()
    showToast('Cliente asignado')
  }

  const removeAssign = async (leadId) => {
    await api.delete(`/price-lists/${list.id}/assignments/${leadId}`)
    refetchAssign()
    showToast('Asignación eliminada')
  }

  const changeModeAll = async (mode) => {
    for (const item of items) {
      await api.put('/price-lists/' + list.id + '/items/' + item.id, {
        ...item, price_mode: mode
      })
    }
    refetchItems()
    showToast('✓ Modo ' + (mode==='precio_fijo'?'precio fijo':'descuento') + ' aplicado a todos')
  }

  const applyGlobalDiscount = async () => {
    for (const item of items) {
      await api.put(`/price-lists/${list.id}/items/${item.id}`, {
        ...item, discount_pct: list.discount_pct
      })
    }
    refetchItems()
    setApplyGlobal(false)
    showToast(`✓ ${list.discount_pct}% aplicado a todos los productos`)
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('lf_token')
      const res = await fetch(`/api/price-lists/${list.id}/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd
      })
      const data = await res.json()
      setImportResult(data)
      refetchItems()
      showToast(`✓ ${data.created} creados, ${data.updated} actualizados`)
    } finally { setImporting(false); e.target.value='' }
  }

  const unassigned = leads.filter(l => !assignments.find(a => a.lead_id === l.id))

  return (
    <div className={styles.detailPage}>
      {/* Header */}
      <div className={styles.detailHeader}>
        <button className={styles.backBtn} onClick={onBack}>← Volver</button>
        <div>
          <h2 className={styles.detailTitle}>{list.name}</h2>
          {list.description && <div className={styles.detailDesc}>{list.description}</div>}
        </div>
        <div className={styles.detailBadge}>🏷️ {list.discount_pct}% descuento global</div>
      </div>

      <div className={styles.detailBody}>
        {/* Col izquierda: productos */}
        <div className={styles.detailMain}>

          {/* Import toolbar */}
          <div className={styles.importBar}>
            <a href={`/api/price-lists/${list.id}/template`} className={styles.templateBtn}>📥 Descargar template</a>
            <label className={styles.importBtn}>
              {importing ? '⏳ Importando...' : '📤 Importar Excel'}
              <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleImport} disabled={importing}/>
            </label>
            {items.length > 0 && (
              <>
                <button className={styles.applyBtn} onClick={()=>setApplyGlobal(true)}>
                  🔄 Aplicar {list.discount_pct}% a todos
                </button>
                <button className={styles.modeBtn} onClick={()=>changeModeAll('descuento')}>
                  % Cambiar todos a Descuento
                </button>
                <button className={styles.modeBtn} onClick={()=>changeModeAll('precio_fijo')}>
                  💲 Cambiar todos a Precio Fijo
                </button>
              </>
            )}
            <label className={styles.matchBtn} style={matching?{background:'rgba(139,92,246,0.2)',cursor:'not-allowed'}:{}}>
              {matching ? ('⏳ ' + (matchProgress || 'Iniciando...')) : '🤖 Match con IA'}
              <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleMatch} disabled={matching}/>
            </label>
            {matchError && (
              <div className={styles.matchErrorMsg}>
                ⚠️ {matchError}
                <button onClick={()=>setMatchError('')} style={{marginLeft:8,background:'none',border:'none',cursor:'pointer',color:'var(--red)'}}>✕</button>
              </div>
            )}
          </div>

          {importResult && (
            <div className={styles.importResult}>
              <span className={styles.importOk}>✓ {importResult.created} creados</span>
              <span className={styles.importUpd}>↑ {importResult.updated} actualizados</span>
              <span className={styles.importTotal}>Total: {importResult.total}</span>
              <button className={styles.importClose} onClick={()=>setImportResult(null)}>✕</button>
            </div>
          )}

          {/* Match Results */}
          {matchResults && (
            <div className={styles.matchPanel}>
              <div className={styles.matchHeader}>
                <div>
                  <div className={styles.matchTitle}>🤖 Revisión de matches — {matchResults.length} productos analizados</div>
                  <div className={styles.matchSubtitle}>
                    {matchResults.filter(r=>r.approved).length} aprobados · {matchResults.filter(r=>r.matched_product&&!r.approved).length} pendientes · {matchResults.filter(r=>!r.matched_product).length} sin match
                  </div>
                </div>
                <div className={styles.matchActions}>
                  <button className={styles.approveAllBtn} onClick={approveAll}>✓ Aprobar todos con match</button>
                  <button className={styles.rejectAllBtn} onClick={rejectAll}>✕ Rechazar todos</button>
                  <button className={styles.saveApprovedBtn} onClick={saveApproved}>
                    💾 Guardar {matchResults.filter(r=>r.approved).length} aprobados
                  </button>
                  <button className={styles.exportMapBtn} onClick={exportMapping}>
                    📥 Exportar mapeo
                  </button>
                  <button className={styles.closeMatchBtn} onClick={()=>setMatchResults(null)}>✕</button>
                </div>
              </div>

              {/* Tabla con match */}
              {matchResults.filter(r=>r.matched_product).length > 0 && (
                <div className={styles.matchTable}>
                  <div className={styles.matchSectionTitle}>✅ Con match ({matchResults.filter(r=>r.matched_product).length})</div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{width:40}}>✓</th>
                        <th>Descripción del Excel</th>
                        <th>Producto encontrado</th>
                        <th style={{textAlign:'center'}}>Tipo</th>
                        <th style={{textAlign:'center'}}>Conf.</th>
                        <th style={{textAlign:'right'}}>Precio lista</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchResults.map((r,i) => !r.matched_product ? null : (
                        <tr key={i} className={r.approved ? styles.rowApproved : styles.row}>
                          <td>
                            <input type="checkbox" checked={!!r.approved}
                              onChange={()=>toggleApprove(i)} style={{cursor:'pointer',width:16,height:16}}/>
                          </td>
                          <td>
                            <div className={styles.matchDesc}>{r.row_data.descripcion || r.row_data.sku}</div>
                            {r.row_data.codigo_proveedor && <div className={styles.matchCode}>Cód: {r.row_data.codigo_proveedor}</div>}
                          </td>
                          <td>
                            <div className={styles.matchProd}>{r.matched_product.brand} — {r.matched_product.name}</div>
                            <div className={styles.matchMedida}>{r.matched_product.medida} · SKU: {r.matched_product.codigo_sku}</div>
                          </td>
                          <td style={{textAlign:'center'}}>
                            <span className={r.match_type==='manual' ? styles.matchTypeManual : r.match_type==='codigo_sku'||r.match_type==='codigo_proveedor' ? styles.matchTypeExact : styles.matchTypeIA}>
                              {r.match_type==='manual'?'✋ Manual':r.match_type==='codigo_sku'?'🔑 SKU':r.match_type==='codigo_proveedor'?'🔑 Cód.':'🤖 IA'}
                            </span>
                          </td>
                          <td style={{textAlign:'center'}}>
                            <span className={r.confidence>=90?styles.confHigh:r.confidence>=70?styles.confMed:styles.confLow}>{r.confidence}%</span>
                          </td>
                          <td className={styles.price}>
                            <div style={{fontWeight:700,color:'var(--accent)'}}>{new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(r.row_data.precio_lista)}</div>
                            {r.row_data.precio_final>0 && (
                              <div style={{fontSize:11,color:'var(--green)',fontFamily:'var(--font-mono)'}}>
                                Final: {new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(r.row_data.precio_final)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sin match — con buscador */}
              {matchResults.filter(r=>!r.matched_product).length > 0 && (
                <div className={styles.noMatchSection}>
                  <div className={styles.matchSectionTitle} style={{color:'var(--red)'}}>
                    ❌ Sin match ({matchResults.filter(r=>!r.matched_product).length}) — Busca manualmente en el catálogo
                  </div>
                  {matchResults.map((r,i) => r.matched_product ? null : (
                    <div key={i} className={styles.noMatchCard}>
                      <div className={styles.noMatchTop}>
                        <div>
                          <div className={styles.matchDesc}>{r.row_data.descripcion}</div>
                          <div className={styles.matchCode}>Cód: {r.row_data.codigo_proveedor} · Precio: {new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(r.row_data.precio_lista)}</div>
                        </div>
                      </div>
                      <div className={styles.noMatchSearch}>
                        <div className={styles.catalogSearchWrap}>
                          <span className={styles.searchIcon}>🔍</span>
                          <input className={styles.catalogInput}
                            placeholder="Buscar en catálogo para asignar..."
                            value={noMatchSearch[i]||''}
                            onChange={e=>searchForNoMatch(i, e.target.value)}/>
                        </div>
                        {(noMatchCatalog[i]||[]).length > 0 && (
                          <div className={styles.catalogDrop}>
                            {noMatchCatalog[i].map(p => {
                              const cf = p.custom_fields||{}
                              return (
                                <div key={p.id} className={styles.catalogItem} onClick={()=>assignToNoMatch(i,p)}>
                                  {p.photo_url && <img src={p.photo_url} className={styles.catalogImg} alt="" onError={e=>e.target.style.display='none'}/>}
                                  <div className={styles.catalogInfo}>
                                    <div className={styles.catalogName}>{p.brand} — {p.name}</div>
                                    <div className={styles.catalogMeta}>{cf.medida} · SKU: {cf.codigo_sku}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Agregar producto */}
          <Card className={styles.addCard}>
            <div className={styles.addTitle}>➕ Agregar producto</div>
            <div className={styles.catalogSearchWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input className={styles.catalogInput} placeholder="Buscar en catálogo..."
                value={catalogSearch} onChange={e=>searchCatalog(e.target.value)}/>
            </div>
            {catalogResults.length > 0 && (
              <div className={styles.catalogDrop}>
                {catalogResults.map(p => {
                  const cf = p.custom_fields||{}
                  const net = parseFloat(p.price_offer||0)>0&&parseFloat(p.price_offer)<parseFloat(p.price_normal)?parseFloat(p.price_offer):parseFloat(p.price_normal||0)
                  return (
                    <div key={p.id} className={styles.catalogItem} onClick={()=>addFromCatalog(p)}>
                      {p.photo_url && <img src={p.photo_url} className={styles.catalogImg} alt="" onError={e=>e.target.style.display='none'}/>}
                      <div className={styles.catalogInfo}>
                        <div className={styles.catalogName}>{p.name}</div>
                        <div className={styles.catalogMeta}>{cf.medida} · {p.brand}</div>
                      </div>
                      <div className={styles.catalogPrice}>{fmt.currency(net)}<span>neto</span></div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className={styles.addRow}>
              <input className={styles.addInput} placeholder="Nombre del producto *"
                value={newItem.product_name} onChange={e=>setNewItem(n=>({...n,product_name:e.target.value}))}
                style={{flex:2}}/>
              <input className={styles.addInput} type="number" placeholder="Precio lista *"
                value={newItem.base_price} onChange={e=>setNewItem(n=>({...n,base_price:e.target.value}))}
                style={{flex:1,textAlign:'right'}}/>
              <div className={styles.discField}>
                <input className={styles.addInput} type="number" min="0" max="100"
                  value={newItem.discount_pct} onChange={e=>setNewItem(n=>({...n,discount_pct:e.target.value}))}
                  style={{width:70,textAlign:'right'}}/>
                <span style={{fontSize:12,color:'var(--text3)'}}>%</span>
              </div>
              <Button size="sm" onClick={addItem} disabled={!newItem.product_name||!newItem.base_price}>
                Agregar
              </Button>
            </div>
          </Card>

          {/* Tabla de productos */}
          <Card className={styles.tableCard}>
            {items.length === 0 ? (
              <Empty icon="🏷️" title="Sin productos" subtitle="Agrega productos o importa desde Excel"/>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Medida</th>
                      <th style={{textAlign:'right'}}>Precio lista</th>
                      <th style={{textAlign:'center'}}>% Dcto.</th>
                      <th style={{textAlign:'right'}}>Precio final</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => (
                      <tr key={it.id} className={styles.row}>
                        {editingItem === it.id ? (
                          <EditItemRow item={it} onSave={(data)=>updateItem(it.id,data)} onCancel={()=>setEditingItem(null)}/>
                        ) : (
                          <>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:8}}>
                                {it.photo_url && <img src={it.photo_url} style={{width:28,height:28,objectFit:'contain',borderRadius:4}} alt="" onError={e=>e.target.style.display='none'}/>}
                                <span className={styles.productName}>{it.product_name}</span>
                              </div>
                            </td>
                            <td className={styles.mono}>{it.medida||'—'}</td>
                            <td className={styles.price}>{fmt.currency(it.base_price)}</td>
                            <td className={styles.center}>
                              <span className={styles.discBadge}>{it.discount_pct}%</span>
                            </td>
                            <td className={`${styles.price} ${styles.finalPrice}`}>{fmt.currency(it.final_price)}</td>
                            <td>
                              <div style={{display:'flex',gap:4}}>
                                <button className={styles.actionBtn} onClick={()=>setEditingItem(it.id)}>✏️</button>
                                <button className={`${styles.actionBtn} ${styles.delBtn}`} onClick={()=>deleteItem(it.id)}>🗑️</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Col derecha: clientes asignados */}
        <div className={styles.detailSide}>
          <Card className={styles.assignCard}>
            <div className={styles.assignTitle}>👥 Clientes asignados</div>
            <div className={styles.assignList}>
              {assignments.length === 0 ? (
                <div className={styles.assignEmpty}>Sin clientes asignados</div>
              ) : assignments.map(a => (
                <div key={a.id} className={styles.assignItem}>
                  <div>
                    <div className={styles.assignName}>{a.lead_name}</div>
                    {a.company && <div className={styles.assignCompany}>{a.company}</div>}
                  </div>
                  <button className={styles.removeAssign} onClick={()=>removeAssign(a.lead_id)}>✕</button>
                </div>
              ))}
            </div>
            {unassigned.length > 0 && (
              <div className={styles.assignAdd}>
                <div className={styles.assignAddLabel}>Asignar cliente:</div>
                <select className={styles.assignSelect}
                  onChange={e=>{ if(e.target.value) { assignLead(e.target.value); e.target.value='' } }}>
                  <option value="">Seleccionar...</option>
                  {unassigned.map(l=><option key={l.id} value={l.id}>{l.name}{l.company?` — ${l.company}`:''}</option>)}
                </select>
              </div>
            )}
          </Card>

          <Card className={styles.summaryCard}>
            <div className={styles.assignTitle}>📊 Resumen</div>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}><span>Productos</span><strong>{items.length}</strong></div>
              <div className={styles.summaryRow}><span>Dcto. global</span><strong>{list.discount_pct}%</strong></div>
              <div className={styles.summaryRow}><span>Clientes</span><strong>{assignments.length}</strong></div>
            </div>
          </Card>
        </div>
      </div>

      {applyGlobal && (
        <Modal title="Aplicar descuento global" onClose={()=>setApplyGlobal(false)} width={400}>
          <p style={{fontSize:14,color:'var(--text2)',marginBottom:20}}>
            ¿Aplicar <strong>{list.discount_pct}%</strong> de descuento a todos los {items.length} productos de esta lista?
            Los descuentos individuales serán sobreescritos.
          </p>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
            <Button variant="ghost" onClick={()=>setApplyGlobal(false)}>Cancelar</Button>
            <Button onClick={applyGlobalDiscount}>✓ Aplicar a todos</Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}

function EditItemRow({ item, onSave, onCancel }) {
  const [form, setForm] = useState({ product_name: item.product_name, base_price: item.base_price, discount_pct: item.discount_pct })
  return (
    <>
      <td><input className={styles.editCell} value={form.product_name} onChange={e=>setForm(f=>({...f,product_name:e.target.value}))}/></td>
      <td>—</td>
      <td><input className={styles.editCell} type="number" value={form.base_price} onChange={e=>setForm(f=>({...f,base_price:e.target.value}))} style={{textAlign:'right'}}/></td>
      <td><input className={styles.editCell} type="number" min="0" max="100" value={form.discount_pct} onChange={e=>setForm(f=>({...f,discount_pct:e.target.value}))} style={{textAlign:'center',width:60}}/></td>
      <td className={styles.price}>{fmt.currency(Math.round(parseFloat(form.base_price||0)*(1-parseFloat(form.discount_pct||0)/100)))}</td>
      <td>
        <div style={{display:'flex',gap:4}}>
          <button className={styles.actionBtn} onClick={()=>onSave(form)}>✓</button>
          <button className={styles.actionBtn} onClick={onCancel}>✕</button>
        </div>
      </td>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function PriceLists() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')
  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),3000) }
  const [matching, setMatching] = useState(false)
  const [matchResults, setMatchResults] = useState(null)
  const [noMatchSearch, setNoMatchSearch] = useState({})
  const [noMatchCatalog, setNoMatchCatalog] = useState({})

  const searchForNoMatch = async (idx, q) => {
    setNoMatchSearch(s => ({...s, [idx]: q}))
    if (q.length < 2) { setNoMatchCatalog(c => ({...c, [idx]: []})); return }
    const data = await api.get('/catalog?active=true&search=' + q + '&limit=6')
    setNoMatchCatalog(c => ({...c, [idx]: data.products || []}))
  }

  const assignToNoMatch = (idx, product) => {
    setMatchResults(prev => prev.map((r,i) => i===idx ? {
      ...r,
      matched_product: {
        id: product.id, name: product.name, brand: product.brand,
        medida: product.custom_fields?.medida, codigo_sku: product.custom_fields?.codigo_sku,
        price_normal: product.price_normal,
      },
      match_type: 'manual',
      confidence: 100,
      approved: true,
    } : r))
    setNoMatchSearch(s => ({...s, [idx]: ''}))
    setNoMatchCatalog(c => ({...c, [idx]: []}))
  }

  const [matchProgress, setMatchProgress] = useState('')
  const [matchError, setMatchError] = useState('')

  const handleMatch = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setMatching(true); setMatchResults(null); setMatchError('')
    
    // Contador de tiempo
    let secs = 0
    const timer = setInterval(() => {
      secs++
      setMatchProgress('Analizando con IA... ' + secs + 's')
      if (secs > 550) {
        clearInterval(timer)
        setMatchError('El análisis tardó demasiado. Intenta con un archivo más pequeño.')
        setMatching(false)
      }
    }, 1000)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('lf_token')
      const res = await fetch('/api/price-lists/' + list.id + '/match', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd
      })
      clearInterval(timer)
      if (!res.ok) throw new Error('Error del servidor (' + res.status + ')')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const withAutoApprove = data.results.map(r => ({
        ...r,
        approved: r.confidence === 100
      }))
      setMatchResults(withAutoApprove)
      showToast('✓ Análisis completado — ' + data.results.length + ' productos analizados')
    } catch(err) {
      clearInterval(timer)
      setMatchError('Error: ' + err.message + '. Intenta de nuevo.')
      showToast('Error en el análisis')
    } finally { setMatching(false); setMatchProgress(''); e.target.value='' }
  }

  const toggleApprove = (idx) => {
    setMatchResults(prev => prev.map((r,i) => i===idx ? {...r, approved: !r.approved} : r))
  }

  const approveAll = () => setMatchResults(prev => prev.map(r => ({...r, approved: !!r.matched_product})))
  const rejectAll  = () => setMatchResults(prev => prev.map(r => ({...r, approved: false})))

  const saveApproved = async () => {
    const approved = matchResults.filter(r => r.approved && r.matched_product)
    if (!approved.length) { showToast('No hay items aprobados'); return }
    const res = await api.post('/price-lists/' + list.id + '/match/approve', {
      approved_items: approved.map(r => ({
        product_id: r.matched_product.id,
        product_name: r.matched_product.name,
        precio_lista: r.row_data.precio_lista,
        precio_final: r.row_data.precio_final || 0,
      }))
    })
    showToast('✓ ' + res.saved + ' productos guardados')
    setMatchResults(null)
    refetchItems()
  }

  const { data: lists=[], isLoading } = useQuery({
    queryKey: ['price-lists'],
    queryFn: () => api.get('/price-lists'),
  })

  const refresh = () => qc.invalidateQueries(['price-lists'])

  const deleteList = async (id) => {
    if (!confirm('¿Eliminar esta lista de precios?')) return
    await api.delete(`/price-lists/${id}`)
    refresh()
    showToast('Lista eliminada')
  }

  if (selected) {
    return <ListDetail list={selected} onBack={()=>setSelected(null)} onRefresh={refresh}/>
  }

  return (
    <div className={styles.page}>
      <Header actions={
        <Button size="sm" onClick={()=>setShowNew(true)}>➕ Nueva lista</Button>
      }/>

      <div className={styles.content}>
        <div className={styles.statsRow}>
          <div className={styles.stat}><span className={styles.statN}>{lists.length}</span><span className={styles.statL}>Listas activas</span></div>
          <div className={styles.stat}><span className={styles.statN}>{lists.reduce((s,l)=>s+parseInt(l.item_count||0),0)}</span><span className={styles.statL}>Productos totales</span></div>
          <div className={styles.stat}><span className={styles.statN}>{lists.reduce((s,l)=>s+(l.assigned_to?.filter(Boolean).length||0),0)}</span><span className={styles.statL}>Clientes asignados</span></div>
        </div>

        {isLoading ? <div className={styles.loading}><Spinner/></div> :
        lists.length === 0 ? <Empty icon="🏷️" title="Sin listas de precios" subtitle='Click en "Nueva lista" para comenzar'/> : (
          <div className={styles.grid}>
            {lists.map(l => (
              <div key={l.id} className={styles.card} onClick={()=>setSelected(l)}>
                <div className={styles.cardTop}>
                  <div className={styles.cardName}>{l.name}</div>
                  <div className={styles.cardDisc}>{l.discount_pct}%</div>
                </div>
                {l.description && <div className={styles.cardDesc}>{l.description}</div>}
                <div className={styles.cardMeta}>
                  <span>📦 {l.item_count} productos</span>
                  <span>👥 {l.assigned_to?.filter(Boolean).length||0} clientes</span>
                </div>
                {l.assigned_to?.filter(Boolean).length > 0 && (
                  <div className={styles.cardClients}>
                    {l.assigned_to.filter(Boolean).slice(0,3).map((n,i)=>(
                      <span key={i} className={styles.clientTag}>{n}</span>
                    ))}
                    {l.assigned_to.filter(Boolean).length > 3 && <span className={styles.clientTag}>+{l.assigned_to.filter(Boolean).length-3}</span>}
                  </div>
                )}
                <div className={styles.cardActions} onClick={e=>e.stopPropagation()}>
                  <button className={styles.actionBtn} onClick={()=>setEditing(l)}>✏️ Editar</button>
                  <button className={`${styles.actionBtn} ${styles.delBtn}`} onClick={()=>deleteList(l.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && <ListModal onClose={()=>setShowNew(false)} onSaved={()=>{refresh();showToast('Lista creada')}}/>}
      {editing && <ListModal list={editing} onClose={()=>setEditing(null)} onSaved={()=>{refresh();showToast('Lista actualizada')}}/>}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
