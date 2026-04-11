import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast } from '@/components/ui'
import { fmt, withIva } from '@/utils/format'
import api from '@/utils/api'
import styles from './Profitability.module.css'

// ── Tab 1: Costos ─────────────────────────────────────────────
function CostsTab({ filterOptions }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [codeField, setCodeField] = useState('codigo_interno')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const handleImportCosts = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('code_field', codeField)
      const token = localStorage.getItem('lf_token')
      const res = await fetch('/api/profitability/costs/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd
      })
      const data = await res.json()
      setImportResult(data)
      qc.invalidateQueries(['profitability'])
      showToast(`✓ ${data.updated} costos actualizados`)
    } catch(err) {
      showToast('Error al importar')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const [ancho, setAncho] = useState('')
  const [perfil, setPerfil] = useState('')
  const [aro, setAro] = useState('')

  const hasQuery = search.length > 1 || brand || ancho || perfil || aro

  const { data: data={}, isLoading } = useQuery({
    queryKey: ['profitability', search, brand, ancho, perfil, aro, page],
    queryFn: () => api.get(`/profitability?page=${page}&limit=50`
      + (search ? `&search=${search}` : '')
      + (brand  ? `&brand=${brand}`   : '')
      + (ancho  ? `&ancho=${ancho}`   : '')
      + (perfil ? `&perfil=${perfil}` : '')
      + (aro    ? `&aro=${aro}`       : '')
    ),
    enabled: !!hasQuery,
  })
  const products = data.products || []
  const totalPages = data.pages || 1

  const setCost = (id, val) => setEditing(e => ({ ...e, [id]: val }))

  const saveCost = async (id) => {
    const cost = parseFloat(editing[id])
    if (isNaN(cost)) return
    await api.patch(`/profitability/${id}/cost`, { cost_price: cost })
    qc.invalidateQueries(['profitability'])
    showToast('Costo guardado')
  }

  const saveAll = async () => {
    const costs = Object.entries(editing)
      .filter(([,v]) => v !== '' && !isNaN(parseFloat(v)))
      .map(([id, cost_price]) => ({ id, cost_price: parseFloat(cost_price) }))
    if (!costs.length) return
    setSaving(true)
    try {
      await api.post('/profitability/costs/bulk', { costs })
      qc.invalidateQueries(['profitability'])
      setEditing({})
      showToast(`✓ ${costs.length} costos guardados`)
    } finally { setSaving(false) }
  }

  const margin = (price, cost) => {
    if (!cost || !price || price <= 0) return null
    return ((price - cost) / price * 100).toFixed(1)
  }

  const marginColor = (m) => {
    if (m === null) return ''
    if (m < 10) return styles.marginRed
    if (m < 25) return styles.marginYellow
    return styles.marginGreen
  }

  return (
    <div className={styles.tabContent}>
      {/* Filters */}
      {/* Import toolbar */}
      <div className={styles.importBar}>
        <select className={styles.filterSel} value={codeField} onChange={e=>setCodeField(e.target.value)}>
          <option value="codigo_interno">Código interno</option>
          <option value="codigo_proveedor">Código proveedor</option>
        </select>
        <a href={"/api/profitability/costs/template?code_field=" + codeField} className={styles.templateBtn}>
          📥 Descargar template
        </a>
        <label className={styles.importBtn}>
          {importing ? '⏳ Importando...' : '📤 Subir costos Excel'}
          <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleImportCosts} disabled={importing}/>
        </label>
      </div>

      {importResult && (
        <div className={styles.importResult}>
          <span className={styles.importOk}>✓ {importResult.updated} actualizados</span>
          {importResult.notFound > 0 && <span className={styles.importWarn}>⚠️ {importResult.notFound} no encontrados</span>}
          <span className={styles.importTotal}>Total: {importResult.total} filas</span>
          <button className={styles.importClose} onClick={()=>setImportResult(null)}>✕</button>
          {importResult.errors?.length > 0 && (
            <div className={styles.importErrors}>
              {importResult.errors.map((e,i)=><div key={i} className={styles.importError}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      <div className={styles.filtersBar}>
        <input className={styles.searchInput} placeholder="Buscar producto..." value={search}
          onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
        <select className={styles.filterSel} value={brand} onChange={e=>{setBrand(e.target.value);setPage(1)}}>
          <option value="">Todas las marcas</option>
          {(filterOptions.brands||[]).map(b=><option key={b}>{b}</option>)}
        </select>
        <select className={styles.filterSel} value={ancho} onChange={e=>{setAncho(e.target.value);setPage(1)}}>
          <option value="">Ancho</option>
          {(filterOptions.anchos||[]).map(v=><option key={v}>{v}</option>)}
        </select>
        <select className={styles.filterSel} value={perfil} onChange={e=>{setPerfil(e.target.value);setPage(1)}}>
          <option value="">Perfil</option>
          {(filterOptions.perfiles||[]).map(v=><option key={v}>{v}</option>)}
        </select>
        <select className={styles.filterSel} value={aro} onChange={e=>{setAro(e.target.value);setPage(1)}}>
          <option value="">Aro</option>
          {(filterOptions.aros||[]).map(v=><option key={v}>{v}</option>)}
        </select>
        {Object.keys(editing).length > 0 && (
          <Button size="sm" onClick={saveAll} loading={saving}>
            💾 Guardar {Object.keys(editing).length} costos
          </Button>
        )}
        <span className={styles.filterCount}>{data.total || 0} productos</span>
      </div>

      <Card className={styles.tableCard}>
        {!hasQuery ? (
          <Empty icon="🔍" title="Usa los filtros para buscar productos" subtitle="Selecciona marca, ancho, perfil o aro para comenzar"/>
        ) : isLoading ? <div className={styles.loading}><Spinner /></div> :
        products.length === 0 ? <Empty icon="💰" title="Sin resultados" subtitle="Prueba con otros filtros"/> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Marca</th>
                  <th>Medida</th>
                  <th style={{textAlign:'right'}}>Precio normal</th>
                  <th style={{textAlign:'right'}}>Precio oferta</th>
                  <th style={{textAlign:'right'}}>Costo</th>
                  <th style={{textAlign:'center'}}>Margen s/normal</th>
                  <th style={{textAlign:'center'}}>Margen s/oferta</th>
                  <th style={{textAlign:'center'}}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const costVal = editing[p.id] !== undefined ? editing[p.id] : (p.cost_price || '')
                  const costNum = parseFloat(costVal) || 0
                  const mn = margin(parseFloat(p.price_normal), costNum)
                  const mo = p.price_offer ? margin(parseFloat(p.price_offer), costNum) : null
                  return (
                    <tr key={p.id} className={styles.row}>
                      <td className={styles.productName}>{p.name}</td>
                      <td className={styles.brand}>{p.brand}</td>
                      <td className={styles.mono}>{p.custom_fields?.medida || '—'}</td>
                      <td className={styles.price}>{fmt.currency(withIva(p.price_normal))}</td>
                      <td className={styles.price}>{p.price_offer ? fmt.currency(withIva(p.price_offer)) : '—'}</td>
                      <td>
                        <div className={styles.costCell}>
                          <input
                            className={styles.costInput}
                            type="number"
                            placeholder="0"
                            value={costVal}
                            onChange={e => setCost(p.id, e.target.value)}
                            onBlur={() => editing[p.id] !== undefined && saveCost(p.id)}
                          />
                        </div>
                      </td>
                      <td className={`${styles.marginCell} ${marginColor(mn)}`}>
                        {mn !== null ? `${mn}%` : '—'}
                      </td>
                      <td className={`${styles.marginCell} ${marginColor(mo)}`}>
                        {mo !== null ? `${mo}%` : '—'}
                      </td>
                      <td className={styles.stock}>{p.stock}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        }
      </Card>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>← Anterior</button>
          <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
          <button className={styles.pageBtn} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Siguiente →</button>
        </div>
      )}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}

// ── Tab 2: Simulador de cotización ────────────────────────────
function QuoteSimTab({ filterOptions }) {
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [items, setItems] = useState([])
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedLead, setSelectedLead] = useState('')
  const [ivaRate, setIvaRate] = useState(19)
  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const { data: leads=[] } = useQuery({
    queryKey: ['leads-for-quote'],
    queryFn: () => api.get('/leads'),
  })

  const saveQuote = async () => {
    if (!selectedLead) return showToast('Selecciona un lead primero')
    if (!items.length) return showToast('Agrega al menos un producto')
    setSaving(true)
    try {
      await api.post(`/leads/${selectedLead}/quotes`, {
        iva_rate: ivaRate,
        items: items.map(it => ({
          product: it.name,
          description: it.medida,
          quantity: parseInt(it.quantity)||1,
          unit_price: getItemPrice(it),
        }))
      })
      showToast('✓ Cotización creada — ve a Cotizaciones para verla')
      setItems([])
      setSelectedLead('')
    } finally { setSaving(false) }
  }


  const { data: data={} } = useQuery({
    queryKey: ['profitability-sim', search, brand],
    queryFn: () => api.get(`/profitability?page=1&limit=100` + (search?`&search=${search}`:'') + (brand?`&brand=${brand}`:'')),
    enabled: search.length > 1 || brand.length > 0,
  })
  const products = data.products || []

  const addItem = (p) => {
    const basePrice = Math.min(
      parseFloat(p.price_normal) || 0,
      p.price_offer ? parseFloat(p.price_offer) : Infinity
    )
    setItems(its => [...its, {
      id: p.id + Date.now(),
      product_id: p.id,
      name: p.name,
      brand: p.brand,
      medida: p.custom_fields?.medida || '',
      price_normal: parseFloat(p.price_normal) || 0,
      price_offer: p.price_offer ? parseFloat(p.price_offer) : null,
      cost: parseFloat(p.cost_price) || 0,
      base_price: basePrice,
      quantity: 1,
      discount_type: '%',
      discount_base: 'normal',
      discount_value: 0,
    }])
    setSearch('')
  }

  const updateItem = (id, field, val) =>
    setItems(its => its.map(it => it.id === id ? { ...it, [field]: val } : it))

  const removeItem = (id) => setItems(its => its.filter(it => it.id !== id))

  const getItemPrice = (it) => {
    const base = it.discount_base === 'oferta' && it.price_offer ? it.price_offer : it.price_normal
    if (it.discount_type === '%') {
      return Math.round(base * (1 - (parseFloat(it.discount_value)||0) / 100))
    } else {
      return Math.max(0, base - (parseFloat(it.discount_value)||0))
    }
  }

  const totalVenta = items.reduce((s, it) => s + getItemPrice(it) * (parseInt(it.quantity)||1), 0)
  const totalCosto = items.reduce((s, it) => s + it.cost * (parseInt(it.quantity)||1), 0)
  const totalMargen = totalVenta > 0 ? ((totalVenta - totalCosto) / totalVenta * 100).toFixed(1) : 0
  const totalUtilidad = totalVenta - totalCosto

  return (
    <div className={styles.tabContent}>
      {/* Buscador de productos */}
      <Card className={styles.searchCard}>
        <div className={styles.simSearchRow}>
          <select className={styles.filterSel} value={brand} onChange={e=>setBrand(e.target.value)}>
            <option value="">Todas las marcas</option>
            {(filterOptions.brands||[]).map(b=><option key={b}>{b}</option>)}
          </select>
          <input className={styles.searchInput} placeholder="Buscar producto para agregar..."
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {products.length > 0 && search.length > 1 && (
          <div className={styles.searchResults}>
            {products.slice(0,8).map(p => (
              <div key={p.id} className={styles.searchResult} onClick={()=>addItem(p)}>
                <div className={styles.srName}>{p.name}</div>
                <div className={styles.srMeta}>
                  {p.custom_fields?.medida} · {fmt.currency(p.price_normal)}
                  {p.price_offer && <span className={styles.srOffer}> → {fmt.currency(p.price_offer)}</span>}
                  {p.cost_price > 0 && <span className={styles.srCost}> · Costo: {fmt.currency(p.cost_price)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Items de la cotización */}
      {items.length > 0 ? (
        <>
          <Card className={styles.tableCard}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{textAlign:'center'}}>Cant.</th>
                    <th style={{textAlign:'right'}}>P. Normal</th>
                    <th style={{textAlign:'right'}}>P. Oferta</th>
                    <th>Base descuento</th>
                    <th>Descuento</th>
                    <th style={{textAlign:'right'}}>P. Final</th>
                    <th style={{textAlign:'right'}}>Costo unit.</th>
                    <th style={{textAlign:'right'}}>Subtotal</th>
                    <th style={{textAlign:'center'}}>Margen</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => {
                    const finalPrice = getItemPrice(it)
                    const qty = parseInt(it.quantity)||1
                    const subtotal = finalPrice * qty
                    const costoTotal = it.cost * qty
                    const mg = finalPrice > 0 ? ((finalPrice - it.cost) / finalPrice * 100).toFixed(1) : 0
                    const mgColor = parseFloat(mg) < 10 ? styles.marginRed : parseFloat(mg) < 25 ? styles.marginYellow : styles.marginGreen
                    return (
                      <tr key={it.id} className={styles.row}>
                        <td>
                          <div className={styles.productName}>{it.name}</div>
                          <div className={styles.brand}>{it.medida}</div>
                        </td>
                        <td>
                          <input className={styles.qtyInput} type="number" min="1" value={it.quantity}
                            onChange={e=>updateItem(it.id,'quantity',e.target.value)}/>
                        </td>
                        <td className={styles.price}>{fmt.currency(it.price_normal)}</td>
                        <td className={styles.price}>{it.price_offer ? fmt.currency(it.price_offer) : '—'}</td>
                        <td>
                          <select className={styles.discBase}
                            value={it.discount_base}
                            onChange={e=>updateItem(it.id,'discount_base',e.target.value)}>
                            <option value="normal">Normal</option>
                            {it.price_offer && <option value="oferta">Oferta</option>}
                          </select>
                        </td>
                        <td>
                          <div className={styles.discRow}>
                            <input className={styles.discInput} type="number" min="0" value={it.discount_value}
                              onChange={e=>updateItem(it.id,'discount_value',e.target.value)}/>
                            <select className={styles.discType} value={it.discount_type}
                              onChange={e=>updateItem(it.id,'discount_type',e.target.value)}>
                              <option value="%">%</option>
                              <option value="$">$</option>
                            </select>
                          </div>
                        </td>
                        <td className={`${styles.price} ${styles.finalPrice}`}>{fmt.currency(finalPrice)}</td>
                        <td className={styles.price} style={{color:'var(--text3)'}}>{it.cost > 0 ? fmt.currency(it.cost) : '—'}</td>
                        <td className={`${styles.price} ${styles.bold}`}>{fmt.currency(subtotal)}</td>
                        <td className={`${styles.marginCell} ${mgColor}`}>{mg}%</td>
                        <td>
                          <button className={styles.removeBtn} onClick={()=>removeItem(it.id)}>×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Resumen */}
          <Card className={styles.summaryCard}>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <div className={styles.summaryLabel}>Total venta</div>
                <div className={styles.summaryValue}>{fmt.currency(totalVenta)}</div>
              </div>
              <div className={styles.summaryItem}>
                <div className={styles.summaryLabel}>Total costo</div>
                <div className={styles.summaryValue} style={{color:'var(--text3)'}}>{fmt.currency(totalCosto)}</div>
              </div>
              <div className={styles.summaryItem}>
                <div className={styles.summaryLabel}>Utilidad bruta</div>
                <div className={styles.summaryValue} style={{color: totalUtilidad >= 0 ? 'var(--green)' : 'var(--red)'}}>
                  {fmt.currency(totalUtilidad)}
                </div>
              </div>
              <div className={styles.summaryItem}>
                <div className={styles.summaryLabel}>Margen</div>
                <div className={`${styles.summaryValue} ${parseFloat(totalMargen) < 10 ? styles.marginRed : parseFloat(totalMargen) < 25 ? styles.marginYellow : styles.marginGreen}`}>
                  {totalMargen}%
                </div>
              </div>
            </div>
          </Card>

          {/* Lead + IVA + Guardar */}
          <Card className={styles.saveCard}>
            <div className={styles.saveRow}>
              <div className={styles.saveField}>
                <label className={styles.saveLabel}>Lead / Cliente *</label>
                <select className={styles.saveSelect} value={selectedLead} onChange={e=>setSelectedLead(e.target.value)}>
                  <option value="">Seleccionar lead...</option>
                  {leads.map(l=><option key={l.id} value={l.id}>{l.name}{l.company?` — ${l.company}`:''}</option>)}
                </select>
              </div>
              <div className={styles.saveField} style={{maxWidth:100}}>
                <label className={styles.saveLabel}>% IVA</label>
                <input className={styles.filterSel} type="number" min="0" max="100" value={ivaRate}
                  onChange={e=>setIvaRate(parseFloat(e.target.value)||0)} style={{width:'100%'}}/>
              </div>
              <div className={styles.saveBtns}>
                <button className={styles.clearBtn} onClick={()=>setItems([])}>🗑️ Limpiar</button>
                <Button onClick={saveQuote} loading={saving} disabled={!selectedLead||!items.length}>
                  💾 Crear cotización
                </Button>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Empty icon="📊" title="Sin productos" subtitle="Busca y agrega productos para simular la cotización"/>
      )}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}


// ── Tab 3: Buscador por medida ────────────────────────────────
function SearchByMeasure({ filterOptions }) {
  const qc = useQueryClient()
  const [ancho, setAncho] = useState('')
  const [perfil, setPerfil] = useState('')
  const [aro, setAro] = useState('')
  const [indiceCarga, setIndiceCarga] = useState('')
  const [indiceVel, setIndiceVel] = useState('')
  const [searched, setSearched] = useState(false)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState({})
  const [quantities, setQuantities] = useState({})
  const [showQuote, setShowQuote] = useState(false)
  const [selectedLead, setSelectedLead] = useState('')
  const [ivaRate, setIvaRate] = useState(19)
  const [saving, setSaving] = useState(false)
  const [minStock, setMinStock] = useState(1)
  const [toast, setToast] = useState('')
  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const { data: leads=[] } = useQuery({
    queryKey: ['leads-for-quote2'],
    queryFn: () => api.get('/leads'),
  })

  const fmtC = (n) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)
  const margin = (price,cost) => price>0&&cost>0 ? ((price-cost)/price*100).toFixed(1) : null
  const marginColor = (m) => { if(m===null) return ''; if(parseFloat(m)<10) return styles.marginRed; if(parseFloat(m)<25) return styles.marginYellow; return styles.marginGreen; }

  const doSearch = async () => {
    if (!ancho && !perfil && !aro) return
    setLoading(true); setSearched(true); setSelected({}); setQuantities({})
    try {
      let url = '/profitability?page=1&limit=200'
      if (ancho)  url += '&ancho='  + ancho
      if (perfil) url += '&perfil=' + perfil
      if (aro)    url += '&aro='    + aro
      const data = await api.get(url)
      const filtered = (data.products||[]).filter(p => {
        const cf = p.custom_fields||{}
        if (parseFloat(p.cost_price||0)===0) return false
        if ((p.stock||0) < parseInt(minStock||1)) return false
        if (indiceCarga && cf.indice_carga!==indiceCarga) return false
        if (indiceVel   && cf.indice_velocidad!==indiceVel) return false
        return true
      })
      setProducts(filtered)
    } finally { setLoading(false) }
  }

  const toggleSelect = (id) => {
    setSelected(s => ({...s, [id]: !s[id]}))
    setQuantities(q => ({...q, [id]: q[id]||1}))
  }
  const setQty = (id, val) => setQuantities(q => ({...q, [id]: parseInt(val)||1}))
  const selectedProducts = products.filter(p => selected[p.id])

  const totalVenta = selectedProducts.reduce((s,p) => {
    const precio = parseFloat(p.price_offer||0)>0&&parseFloat(p.price_offer)<parseFloat(p.price_normal) ? parseFloat(p.price_offer) : parseFloat(p.price_normal||0)
    return s + precio*(quantities[p.id]||1)
  },0)
  const totalCosto = selectedProducts.reduce((s,p) => s + parseFloat(p.cost_price||0)*(quantities[p.id]||1),0)
  const totalMargen = totalVenta>0 ? ((totalVenta-totalCosto)/totalVenta*100).toFixed(1) : 0

  const saveQuote = async () => {
    if (!selectedLead) return showToast('Selecciona un lead')
    setSaving(true)
    try {
      await api.post(`/leads/${selectedLead}/quotes`, {
        iva_rate: ivaRate,
        items: selectedProducts.map(p => {
          const cf = p.custom_fields||{}
          const precio = parseFloat(p.price_offer||0)>0&&parseFloat(p.price_offer)<parseFloat(p.price_normal) ? parseFloat(p.price_offer) : parseFloat(p.price_normal||0)
          return { product: p.name, description: cf.medida||'', quantity: quantities[p.id]||1, unit_price: precio }
        })
      })
      qc.invalidateQueries(['quotes'])
      showToast('✓ Cotización creada correctamente')
      setShowQuote(false)
      setSelected({})
    } finally { setSaving(false) }
  }

  const tiers = { Premium: [], Conveniencia: [], Economico: [] }
  for (const p of products) {
    const cf = p.custom_fields||{}
    const t = cf.tier==='Premium' ? 'Premium' : cf.tier==='Conveniencia' ? 'Conveniencia' : 'Economico'
    tiers[t].push(p)
  }
  for (const k of Object.keys(tiers)) {
    tiers[k].sort((a,b) => {
      const pa = parseFloat(a.price_offer||0)>0&&parseFloat(a.price_offer)<parseFloat(a.price_normal)?parseFloat(a.price_offer):parseFloat(a.price_normal||0)
      const pb = parseFloat(b.price_offer||0)>0&&parseFloat(b.price_offer)<parseFloat(b.price_normal)?parseFloat(b.price_offer):parseFloat(b.price_normal||0)
      return pb - pa
    })
  }

  const TierTable = ({ title, icon, prods, color }) => {
    if (!prods.length) return null
    return (
      <div className={styles.tierSection}>
        <div className={styles.tierTitle} style={{borderColor:color,color}}>{icon} {title} <span className={styles.tierCount}>({prods.length})</span></div>
        <Card className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{width:36}}></th>
                <th>Producto</th>
                <th>Medida</th>
                <th style={{textAlign:'right'}}>P. Venta</th>
                <th style={{textAlign:'right'}}>Costo</th>
                <th style={{textAlign:'right'}}>Utilidad</th>
                <th style={{textAlign:'center'}}>Margen</th>
                <th style={{textAlign:'center'}}>Stock</th>
                <th style={{textAlign:'center'}}>Cant.</th>
              </tr>
            </thead>
            <tbody>
              {prods.map(p => {
                const cf = p.custom_fields||{}
                const precio = parseFloat(p.price_offer||0)>0&&parseFloat(p.price_offer)<parseFloat(p.price_normal) ? parseFloat(p.price_offer) : parseFloat(p.price_normal||0)
                const costo  = parseFloat(p.cost_price||0)
                const mg = margin(precio,costo)
                const isSel = !!selected[p.id]
                return (
                  <tr key={p.id} className={`${styles.row} ${isSel?styles.rowSelected:''}`} onClick={()=>toggleSelect(p.id)} style={{cursor:'pointer'}}>
                    <td onClick={e=>e.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={()=>toggleSelect(p.id)} style={{cursor:'pointer',width:16,height:16}}/>
                    </td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {p.photo_url && <img src={p.photo_url} style={{width:32,height:32,objectFit:'contain',borderRadius:4,border:'1px solid var(--border)'}} alt="" onError={e=>e.target.style.display='none'}/>}
                        <div>
                          <div className={styles.productName}>{p.brand}</div>
                          <div style={{fontSize:11,color:'var(--text3)'}}>{p.name.replace(p.brand,'').trim().substring(0,40)}</div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.mono}>{cf.medida||''}</td>
                    <td className={`${styles.price} ${styles.finalPrice}`}>{fmtC(withIva(precio))}</td>
                    <td className={styles.price} style={{color:'var(--text3)'}}>{fmtC(costo)}</td>
                    <td className={styles.price} style={{color:'var(--green)'}}>{fmtC(precio-costo)}</td>
                    <td className={`${styles.marginCell} ${marginColor(mg)}`}>{mg!==null?mg+'%':'—'}</td>
                    <td className={styles.stock}>{p.stock}</td>
                    <td onClick={e=>e.stopPropagation()}>
                      {isSel && (
                        <input type="number" min="1" max={p.stock} value={quantities[p.id]||1}
                          onChange={e=>setQty(p.id,e.target.value)}
                          className={styles.qtyInput} onClick={e=>e.stopPropagation()}/>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.tabContent}>
      <Card className={styles.searchCard}>
        <div className={styles.measureRow}>
          <div className={styles.measureField}>
            <label className={styles.measureLabel}>Ancho</label>
            <select className={styles.filterSel} value={ancho} onChange={e=>setAncho(e.target.value)}>
              <option value="">—</option>
              {(filterOptions.anchos||[]).map(v=><option key={v}>{v}</option>)}
            </select>
          </div>
          <div className={styles.measureSep}>/</div>
          <div className={styles.measureField}>
            <label className={styles.measureLabel}>Perfil</label>
            <select className={styles.filterSel} value={perfil} onChange={e=>setPerfil(e.target.value)}>
              <option value="">—</option>
              {(filterOptions.perfiles||[]).map(v=><option key={v}>{v}</option>)}
            </select>
          </div>
          <div className={styles.measureSep}>R</div>
          <div className={styles.measureField}>
            <label className={styles.measureLabel}>Aro</label>
            <select className={styles.filterSel} value={aro} onChange={e=>setAro(e.target.value)}>
              <option value="">—</option>
              {(filterOptions.aros||[]).map(v=><option key={v}>{v}</option>)}
            </select>
          </div>
          <div className={styles.measureField}>
            <label className={styles.measureLabel}>Índ. carga</label>
            <input className={styles.filterSel} placeholder="ej: 91" value={indiceCarga} onChange={e=>setIndiceCarga(e.target.value)} style={{width:80}}/>
          </div>
          <div className={styles.measureField}>
            <label className={styles.measureLabel}>Índ. vel.</label>
            <input className={styles.filterSel} placeholder="ej: V" value={indiceVel} onChange={e=>setIndiceVel(e.target.value)} style={{width:70}}/>
          </div>
          <div className={styles.measureField}>
            <label className={styles.measureLabel}>Stock mínimo</label>
            <input className={styles.filterSel} type="number" min="1" placeholder="1" value={minStock}
              onChange={e=>setMinStock(e.target.value)} style={{width:70}}/>
          </div>
          <button className={styles.searchBtn} onClick={doSearch}>🔍 Buscar</button>
        </div>
        {(ancho||perfil||aro) && <div className={styles.measureSummary}>Medida: <strong>{ancho||'*'}/{perfil||'*'}R{aro||'*'}</strong> — Solo con stock y costo cargado</div>}
      </Card>

      {loading && <div style={{padding:40,textAlign:'center',color:'var(--text3)'}}>Buscando productos...</div>}

      {searched && !loading && products.length===0 && (
        <Card><div style={{padding:40,textAlign:'center',color:'var(--text3)'}}>Sin resultados con stock y costo para esa medida</div></Card>
      )}

      {selectedProducts.length>0 && (
        <Card className={styles.summaryCard}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>{selectedProducts.length} producto(s) seleccionado(s)</div>
              <div className={styles.summaryValue}>{fmtC(totalVenta)}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Costo total</div>
              <div className={styles.summaryValue} style={{color:'var(--text3)'}}>{fmtC(totalCosto)}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Utilidad</div>
              <div className={styles.summaryValue} style={{color:'var(--green)'}}>{fmtC(totalVenta-totalCosto)}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Margen</div>
              <div className={`${styles.summaryValue} ${parseFloat(totalMargen)<10?styles.marginRed:parseFloat(totalMargen)<25?styles.marginYellow:styles.marginGreen}`}>{totalMargen}%</div>
            </div>
          </div>
          <div style={{marginTop:16,display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div className={styles.saveField} style={{flex:1,minWidth:200}}>
              <label className={styles.saveLabel}>Lead / Cliente *</label>
              <select className={styles.saveSelect} value={selectedLead} onChange={e=>setSelectedLead(e.target.value)}>
                <option value="">Seleccionar lead...</option>
                {leads.map(l=><option key={l.id} value={l.id}>{l.name}{l.company?` — ${l.company}`:''}</option>)}
              </select>
            </div>
            <div className={styles.saveField} style={{maxWidth:90}}>
              <label className={styles.saveLabel}>% IVA</label>
              <input className={styles.filterSel} type="number" min="0" max="100" value={ivaRate} onChange={e=>setIvaRate(parseFloat(e.target.value)||0)} style={{width:'100%'}}/>
            </div>
            <Button onClick={saveQuote} loading={saving} disabled={!selectedLead}>
              💾 Crear cotización
            </Button>
          </div>
        </Card>
      )}

      {searched && !loading && products.length>0 && <>
        <TierTable title="Premium"      icon="🏆" prods={tiers.Premium}      color="#a78bfa"/>
        <TierTable title="Conveniencia" icon="⭐" prods={tiers.Conveniencia} color="#60a5fa"/>
        <TierTable title="Económico"    icon="💰" prods={tiers.Economico}    color="#34d399"/>
      </>}

      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}


// ── Main ──────────────────────────────────────────────────────
export default function Profitability() {
  const [activeTab, setActiveTab] = useState('costs')

  const { data: filterOptions={} } = useQuery({
    queryKey: ['profitability-filters'],
    queryFn: () => api.get('/catalog/filter-options'),
  })

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.content}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab==='costs'?styles.tabActive:''}`} onClick={()=>setActiveTab('costs')}>
            💰 Costos y márgenes
          </button>
          <button className={`${styles.tab} ${activeTab==='quote'?styles.tabActive:''}`} onClick={()=>setActiveTab('quote')}>
            📊 Simulador de cotización
          </button>
          <button className={`${styles.tab} ${activeTab==='search'?styles.tabActive:''}`} onClick={()=>setActiveTab('search')}>
            🔍 Buscador por medida
          </button>
        </div>
        {activeTab === 'costs'  && <CostsTab filterOptions={filterOptions}/>}
        {activeTab === 'quote'  && <QuoteSimTab filterOptions={filterOptions}/>}
        {activeTab === 'search' && <SearchByMeasure filterOptions={filterOptions}/>}
      </div>
    </div>
  )
}
