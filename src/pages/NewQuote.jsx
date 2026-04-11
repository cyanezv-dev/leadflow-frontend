import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './NewQuote.module.css'

export default function NewQuote() {
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const priceType = location.state?.priceType || 'con_iva'
  const isClienteFinal = priceType === 'con_iva'

  const [leadId, setLeadId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ id:1, product:'', description:'', quantity:1, unit_price:'' }])
  const [saving, setSaving] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogResults, setCatalogResults] = useState([])
  const [error, setError] = useState('')

  const { data: leads=[] } = useQuery({
    queryKey: ['leads-mini'],
    queryFn: () => api.get('/leads'),
  })

  const searchCatalog = async (q) => {
    setCatalogSearch(q)
    if (q.length < 2) { setCatalogResults([]); return }
    try {
      const data = await api.get('/catalog?active=true&search=' + q + '&limit=8')
      setCatalogResults(data.products || [])
    } catch(e) {}
  }

  const addFromCatalog = (p) => {
    const cf = p.custom_fields || {}
    const netPrice = parseFloat(p.price_offer||0) > 0 && parseFloat(p.price_offer) < parseFloat(p.price_normal)
      ? parseFloat(p.price_offer) : parseFloat(p.price_normal||0)
    const displayPrice = isClienteFinal ? Math.round(netPrice * 1.19) : netPrice
    setItems(its => [...its, { id: Date.now(), product: p.name, description: cf.medida || '', quantity: 1, unit_price: displayPrice }])
    setCatalogSearch('')
    setCatalogResults([])
  }

  const setItem = (idx, field, val) =>
    setItems(its => its.map((it,i) => i===idx ? {...it,[field]:val} : it))
  const addItem = () =>
    setItems(its => [...its, { id: Date.now(), product:'', description:'', quantity:1, unit_price:'' }])
  const removeItem = (idx) =>
    setItems(its => its.filter((_,i) => i!==idx))

  const calcNeto = (price) => isClienteFinal
    ? Math.round((parseFloat(price)||0) / 1.19)
    : parseFloat(price)||0

  const subtotal = items.reduce((s,it) => s + (parseInt(it.quantity)||0) * calcNeto(it.unit_price), 0)
  const displayTotal = items.reduce((s,it) => s + (parseInt(it.quantity)||0) * (parseFloat(it.unit_price)||0), 0)
  const ivaAmount = isClienteFinal ? Math.round(displayTotal - subtotal) : Math.round(subtotal * 0.19)
  const total = isClienteFinal ? displayTotal : subtotal + ivaAmount

  const save = async () => {
    if (!leadId) { setError('Selecciona un cliente'); return }
    const validItems = items.filter(it => it.product && it.unit_price)
    if (!validItems.length) { setError('Agrega al menos un producto'); return }
    setSaving(true); setError('')
    try {
      await api.post('/leads/' + leadId + '/quotes', {
        iva_rate: 19, price_type: priceType, valid_until: validUntil || null, notes,
        items: validItems.map(it => ({
          product: it.product, description: it.description,
          quantity: parseInt(it.quantity)||1, unit_price: calcNeto(it.unit_price),
        }))
      })
      qc.invalidateQueries(['quotes'])
      navigate('/quotes')
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={()=>navigate('/quotes')}>← Volver</button>
        <div className={styles.headerCenter}>
          <h1 className={styles.title}>Nueva Cotización</h1>
          <div className={isClienteFinal ? styles.badgeFinal : styles.badgeDist}>
            {isClienteFinal ? '🧑 Cliente final — Precios con IVA incluido' : '🏢 Distribuidor — Precios netos + IVA'}
          </div>
        </div>
        <button className={styles.saveBtn} onClick={save} disabled={saving}>
          {saving ? '⏳ Guardando...' : '💾 Crear cotización'}
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.mainCol}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>👤 Cliente</div>
            <div className={styles.sectionBody}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>Cliente / Lead *</label>
                  <select className={styles.select} value={leadId} onChange={e=>setLeadId(e.target.value)}>
                    <option value="">Seleccionar cliente...</option>
                    {leads.map(l=><option key={l.id} value={l.id}>{l.name}{l.last_name?' '+l.last_name:''}{l.company?' — '+l.company:''}</option>)}
                  </select>
                </div>
                <div className={styles.field} style={{maxWidth:200}}>
                  <label className={styles.label}>Válida hasta</label>
                  <input className={styles.input} type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>📦 Productos</div>
            <div className={styles.sectionBody}>
              <div className={styles.catalogBox}>
                <div className={styles.catalogWrap}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input className={styles.catalogInput}
                    placeholder={'Buscar en catálogo — agrega como ' + (isClienteFinal?'precio con IVA':'precio neto')}
                    value={catalogSearch} onChange={e=>searchCatalog(e.target.value)}/>
                </div>
                {catalogResults.length > 0 && (
                  <div className={styles.catalogDrop}>
                    {catalogResults.map(p => {
                      const cf = p.custom_fields||{}
                      const netP = parseFloat(p.price_offer||0)>0&&parseFloat(p.price_offer)<parseFloat(p.price_normal)?parseFloat(p.price_offer):parseFloat(p.price_normal||0)
                      const showP = isClienteFinal ? Math.round(netP*1.19) : netP
                      return (
                        <div key={p.id} className={styles.catalogItem} onClick={()=>addFromCatalog(p)}>
                          {p.photo_url && <img src={p.photo_url} className={styles.catalogImg} alt="" onError={e=>e.target.style.display='none'}/>}
                          <div className={styles.catalogInfo}>
                            <div className={styles.catalogName}>{p.name}</div>
                            <div className={styles.catalogMeta}>{cf.medida} · {p.brand}</div>
                          </div>
                          <div className={styles.catalogPrice}>{fmt.currency(showP)}<span>{isClienteFinal?'c/IVA':'neto'}</span></div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{width:'32%'}}>Producto</th>
                    <th style={{width:'22%'}}>Descripción</th>
                    <th style={{width:'8%',textAlign:'center'}}>Cant.</th>
                    <th style={{width:'20%',textAlign:'right'}}>{isClienteFinal?'Precio c/IVA':'Precio neto'}</th>
                    <th style={{width:'15%',textAlign:'right'}}>Subtotal</th>
                    <th style={{width:'3%'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item,idx) => (
                    <tr key={item.id} className={styles.itemRow}>
                      <td><input className={styles.cell} placeholder="Nombre del producto" value={item.product} onChange={e=>setItem(idx,'product',e.target.value)}/></td>
                      <td><input className={styles.cell} placeholder="Medida, descripción..." value={item.description} onChange={e=>setItem(idx,'description',e.target.value)}/></td>
                      <td><input className={styles.cell+' '+styles.cellC} type="number" min="1" value={item.quantity} onChange={e=>setItem(idx,'quantity',e.target.value)}/></td>
                      <td><input className={styles.cell+' '+styles.cellR} type="number" min="0" placeholder="0" value={item.unit_price} onChange={e=>setItem(idx,'unit_price',e.target.value)}/></td>
                      <td className={styles.subtotal}>{fmt.currency((parseInt(item.quantity)||0)*(parseFloat(item.unit_price)||0))}</td>
                      <td><button className={styles.removeBtn} onClick={()=>removeItem(idx)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className={styles.addBtn} onClick={addItem}>+ Agregar línea</button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>📝 Notas</div>
            <div className={styles.sectionBody}>
              <textarea className={styles.textarea} rows={3}
                placeholder="Condiciones comerciales, tiempo de entrega, garantía..."
                value={notes} onChange={e=>setNotes(e.target.value)}/>
            </div>
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={styles.totalsCard}>
            <div className={styles.totalsTitle}>Resumen</div>
            <div className={isClienteFinal?styles.typeTagFinal:styles.typeTagDist}>
              {isClienteFinal?'🧑 Cliente Final':'🏢 Distribuidor'}
            </div>
            <div className={styles.totalsList}>
              {isClienteFinal ? (<>
                <div className={styles.totalsRow}><span>Total bruto c/IVA</span><span>{fmt.currency(displayTotal)}</span></div>
                <div className={styles.totalsRow} style={{opacity:.6}}><span>Neto disgregado</span><span>{fmt.currency(subtotal)}</span></div>
                <div className={styles.totalsRow} style={{opacity:.6}}><span>IVA incluido (19%)</span><span>{fmt.currency(ivaAmount)}</span></div>
                <div className={styles.totalsFinal}><span>Total</span><span>{fmt.currency(total)}</span></div>
                <div className={styles.totalsNote}>✓ IVA ya incluido</div>
              </>) : (<>
                <div className={styles.totalsRow}><span>Subtotal neto</span><span>{fmt.currency(subtotal)}</span></div>
                <div className={styles.totalsRow} style={{opacity:.6}}><span>IVA (19%)</span><span>{fmt.currency(ivaAmount)}</span></div>
                <div className={styles.totalsFinal}><span>Total con IVA</span><span>{fmt.currency(total)}</span></div>
                <div className={styles.totalsNote}>+ IVA sobre neto</div>
              </>)}
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button className={styles.saveBtnFull} onClick={save} disabled={saving}>
              {saving?'⏳ Guardando...':'💾 Crear cotización'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
