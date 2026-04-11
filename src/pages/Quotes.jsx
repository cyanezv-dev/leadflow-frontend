import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast } from '@/components/ui'
import { fmt, withIva } from '@/utils/format'
import api from '@/utils/api'
import styles from './Quotes.module.css'

const STATUS = {
  borrador:  { label:'Borrador',  color:'#6b7280', bg:'#f3f4f6' },
  enviada:   { label:'Enviada',   color:'#2563eb', bg:'#dbeafe' },
  aceptada:  { label:'Aceptada',  color:'#16a34a', bg:'#dcfce7' },
  rechazada: { label:'Rechazada', color:'#dc2626', bg:'#fee2e2' },
}

// ── Step 1: Elegir tipo de cliente ────────────────────────────
function StepTipoCliente({ onSelect, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.typeModal} onClick={e=>e.stopPropagation()}>
        <div className={styles.typeHeader}>
          <h2 className={styles.typeTitle}>Nueva Cotización</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p className={styles.typeSubtitle}>¿A quién va dirigida esta cotización?</p>
        <div className={styles.typeOptions}>
          <button className={styles.typeOption} onClick={()=>onSelect('con_iva')}>
            <span className={styles.typeIcon}>🧑</span>
            <div className={styles.typeInfo}>
              <div className={styles.typeLabel}>Cliente Final</div>
              <div className={styles.typeDesc}>Los precios incluyen IVA. El total no agrega IVA adicional.</div>
              <div className={styles.typeExample}>Ej: $154.900 → Total: $154.900</div>
            </div>
          </button>
          <button className={styles.typeOption} onClick={()=>onSelect('sin_iva')}>
            <span className={styles.typeIcon}>🏢</span>
            <div className={styles.typeInfo}>
              <div className={styles.typeLabel}>Distribuidor / Empresa</div>
              <div className={styles.typeDesc}>Los precios son netos. Se agrega IVA al final.</div>
              <div className={styles.typeExample}>Ej: $130.168 neto + 19% IVA → Total: $154.900</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Formulario de cotización ─────────────────────────
function QuoteModal({ priceType, onClose, onSaved, leads=[] }) {
  const [leadId, setLeadId] = useState(leads[0]?.id || '')
  const [ivaRate] = useState(19)
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ id:1, product:'', description:'', quantity:1, unit_price:'' }])
  const [saving, setSaving] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogResults, setCatalogResults] = useState([])

  const isClienteFinal = priceType === 'con_iva'

  const setItem = (idx, field, val) =>
    setItems(its => its.map((it,i) => i===idx ? {...it,[field]:val} : it))
  const addItem = () =>
    setItems(its => [...its, { id: Date.now(), product:'', description:'', quantity:1, unit_price:'' }])
  const removeItem = (idx) =>
    setItems(its => its.filter((_,i) => i!==idx))

  // Buscar en catálogo
  const searchCatalog = async (q) => {
    setCatalogSearch(q)
    if (q.length < 2) { setCatalogResults([]); return }
    try {
      const data = await api.get(`/catalog?active=true&search=${q}&limit=8`)
      setCatalogResults(data.products || [])
    } catch(e) {}
  }

  const addFromCatalog = (p) => {
    const cf = p.custom_fields || {}
    // Precio a mostrar según tipo cliente
    // Los precios en BD son NETOS
    const netPrice = parseFloat(p.price_offer||0) > 0 && parseFloat(p.price_offer) < parseFloat(p.price_normal)
      ? parseFloat(p.price_offer)
      : parseFloat(p.price_normal||0)
    const displayPrice = isClienteFinal ? Math.round(netPrice * 1.19) : netPrice
    setItems(its => [...its, {
      id: Date.now(),
      product: p.name,
      description: cf.medida || '',
      quantity: 1,
      unit_price: displayPrice,
    }])
    setCatalogSearch('')
    setCatalogResults([])
  }

  // Cálculo de totales
  // Si cliente final: precios ingresados ya tienen IVA → neto = precio/1.19, sin IVA adicional
  // Si distribuidor: precios ingresados son netos → agregar IVA al final
  const calcNeto = (price) => isClienteFinal
    ? Math.round((parseFloat(price)||0) / (1 + ivaRate/100))
    : parseFloat(price)||0

  const subtotal = items.reduce((s,it) =>
    s + (parseInt(it.quantity)||0) * calcNeto(it.unit_price), 0)

  const ivaAmount = isClienteFinal ? 0 : Math.round(subtotal * ivaRate / 100)
  const total = subtotal + ivaAmount

  // Para mostrar en tabla según tipo
  const displayTotal = items.reduce((s,it) =>
    s + (parseInt(it.quantity)||0) * (parseFloat(it.unit_price)||0), 0)

  const save = async () => {
    if (!leadId) return
    const validItems = items.filter(it => it.product && it.unit_price)
    if (!validItems.length) return
    setSaving(true)
    try {
      await api.post(`/leads/${leadId}/quotes`, {
        iva_rate: isClienteFinal ? 0 : ivaRate,
        price_type: priceType,
        valid_until: validUntil || null,
        notes,
        items: validItems.map(it => ({
          product: it.product,
          description: it.description,
          quantity: parseInt(it.quantity)||1,
          unit_price: calcNeto(it.unit_price),
        }))
      })
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <div className={styles.mheader}>
          <div>
            <h2 className={styles.mtitle}>Nueva Cotización</h2>
            <span className={isClienteFinal ? styles.badgeFinal : styles.badgeDist}>
              {isClienteFinal ? '🧑 Cliente final — precio c/IVA incluido' : '🏢 Distribuidor — precio neto + IVA'}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.mbody}>
          {/* Encabezado */}
          <div className={styles.mrow}>
            <div className={styles.mfield}>
              <label className={styles.mlabel}>Lead / Cliente *</label>
              <select className={styles.minput} value={leadId} onChange={e=>setLeadId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {leads.map(l=><option key={l.id} value={l.id}>{l.name}{l.company?` — ${l.company}`:''}</option>)}
              </select>
            </div>
            <div className={styles.mfield} style={{maxWidth:160}}>
              <label className={styles.mlabel}>Válida hasta</label>
              <input className={styles.minput} type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/>
            </div>
          </div>

          {/* Buscador catálogo */}
          <div className={styles.catalogSearch}>
            <div className={styles.catalogRow}>
              <span className={styles.catalogIcon}>🔍</span>
              <input className={styles.catalogInput}
                placeholder="Buscar en catálogo para agregar producto..."
                value={catalogSearch}
                onChange={e=>searchCatalog(e.target.value)}/>
            </div>
            {catalogResults.length > 0 && (
              <div className={styles.catalogResults}>
                {catalogResults.map(p => {
                  const cf = p.custom_fields||{}
                  const netP = parseFloat(p.price_offer||0)>0&&parseFloat(p.price_offer)<parseFloat(p.price_normal)?parseFloat(p.price_offer):parseFloat(p.price_normal||0)
                  const showP = isClienteFinal ? Math.round(netP*1.19) : netP
                  return (
                    <div key={p.id} className={styles.catalogResult} onClick={()=>addFromCatalog(p)}>
                      {p.photo_url && <img src={p.photo_url} className={styles.catalogThumb} alt="" onError={e=>e.target.style.display='none'}/>}
                      <div className={styles.catalogInfo}>
                        <div className={styles.catalogName}>{p.name}</div>
                        <div className={styles.catalogMeta}>{cf.medida} · {p.brand}</div>
                      </div>
                      <div className={styles.catalogPrice}>
                        {fmt.currency(showP)}
                        <span className={styles.catalogPriceLabel}>{isClienteFinal?'c/IVA':'neto'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tabla items */}
          <div className={styles.mtableWrap}>
            <table className={styles.mtable}>
              <thead>
                <tr>
                  <th style={{width:'30%'}}>Producto</th>
                  <th style={{width:'20%'}}>Descripción</th>
                  <th style={{width:'8%',textAlign:'center'}}>Cant.</th>
                  <th style={{width:'18%',textAlign:'right'}}>
                    {isClienteFinal ? 'Precio c/IVA' : 'Precio Neto'}
                  </th>
                  <th style={{width:'18%',textAlign:'right'}}>Subtotal</th>
                  <th style={{width:'6%'}}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item,idx) => (
                  <tr key={item.id}>
                    <td><input className={styles.tcell} placeholder="Nombre producto" value={item.product} onChange={e=>setItem(idx,'product',e.target.value)}/></td>
                    <td><input className={styles.tcell} placeholder="Descripción" value={item.description} onChange={e=>setItem(idx,'description',e.target.value)}/></td>
                    <td><input className={`${styles.tcell} ${styles.tcellC}`} type="number" min="1" value={item.quantity} onChange={e=>setItem(idx,'quantity',e.target.value)}/></td>
                    <td><input className={`${styles.tcell} ${styles.tcellR}`} type="number" min="0"
                      placeholder={isClienteFinal?'precio con IVA':'precio neto'}
                      value={item.unit_price} onChange={e=>setItem(idx,'unit_price',e.target.value)}/></td>
                    <td className={styles.tcellTotal}>
                      {fmt.currency((parseInt(item.quantity)||0)*(parseFloat(item.unit_price)||0))}
                    </td>
                    <td><button className={styles.removeBtn} onClick={()=>removeItem(idx)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className={styles.addRowBtn} onClick={addItem}>+ Agregar línea</button>

          {/* Totales */}
          <div className={styles.totals}>
            {isClienteFinal ? (
              <>
                <div className={styles.totalRow}>
                  <span>Total bruto (c/IVA)</span>
                  <span className={styles.totalVal}>{fmt.currency(displayTotal)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>Neto disgregado</span>
                  <span className={styles.totalVal} style={{color:'var(--text3)'}}>{fmt.currency(subtotal)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>IVA incluido ({ivaRate}%)</span>
                  <span className={styles.totalVal} style={{color:'var(--text3)'}}>{fmt.currency(displayTotal - subtotal)}</span>
                </div>
                <div className={styles.totalRowBig}>
                  <span>Total</span>
                  <span>{fmt.currency(displayTotal)}</span>
                </div>
              </>
            ) : (
              <>
                <div className={styles.totalRow}>
                  <span>Subtotal neto</span>
                  <span className={styles.totalVal}>{fmt.currency(subtotal)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>IVA ({ivaRate}%)</span>
                  <span className={styles.totalVal} style={{color:'var(--text3)'}}>{fmt.currency(ivaAmount)}</span>
                </div>
                <div className={styles.totalRowBig}>
                  <span>Total con IVA</span>
                  <span>{fmt.currency(total)}</span>
                </div>
              </>
            )}
          </div>

          {/* Notas */}
          <div className={styles.mfield} style={{marginTop:12}}>
            <label className={styles.mlabel}>Notas / Condiciones</label>
            <textarea className={styles.mtextarea} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Condiciones comerciales, tiempo de entrega, garantía..."/>
          </div>
        </div>

        <div className={styles.mfooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <Button onClick={save} loading={saving} disabled={!leadId || !items.some(it=>it.product&&it.unit_price)}>
            💾 Crear cotización
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Quotes ───────────────────────────────────────────────
export default function Quotes() {
  const qc = useQueryClient()
  const [step, setStep] = useState(null) // null | 'tipo' | 'form'
  const location = useLocation()

  useEffect(() => {
    if (location.state?.newQuote) {
      setPriceType(location.state.priceType || 'con_iva')
      setStep('form')
      window.history.replaceState({}, '')
    }
  }, [location.state])
  const [priceType, setPriceType] = useState('con_iva')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const { data: quotes=[], isLoading } = useQuery({
    queryKey: ['quotes', search],
    queryFn: () => api.get('/quotes' + (search?`?search=${search}`:'')),
  })

  const { data: leads=[] } = useQuery({
    queryKey: ['leads-mini'],
    queryFn: () => api.get('/leads'),
  })

  const refresh = () => qc.invalidateQueries(['quotes'])

  const changeStatus = async (id, status) => {
    await api.patch(`/quotes/${id}/status`, { status })
    refresh()
  }

  return (
    <div className={styles.page}>
      <Header
        onSearch={setSearch}
        actions={
          <Button size="sm" onClick={()=>setStep('tipo')}>➕ Nueva Cotización</Button>
        }
      />

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loading}><Spinner /></div>
        ) : quotes.length === 0 ? (
          <Empty icon="📋" title="Sin cotizaciones" subtitle='Click en "Nueva Cotización" para comenzar'/>
        ) : (
          <Card className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>N° Cotización</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th style={{textAlign:'right'}}>Neto</th>
                  <th style={{textAlign:'right'}}>IVA</th>
                  <th style={{textAlign:'right'}}>Total</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => {
                  const st = STATUS[q.status] || STATUS.borrador
                  return (
                    <tr key={q.id} className={styles.row}>
                      <td className={styles.quoteNum}>{q.quote_number}</td>
                      <td>
                        <div className={styles.clientName}>{q.lead_name}</div>
                        {q.company && <div className={styles.clientCompany}>{q.company}</div>}
                      </td>
                      <td>
                        <span className={q.price_type==='con_iva'?styles.badgeFinalSm:styles.badgeDistSm}>
                          {q.price_type==='con_iva'?'🧑 Final':'🏢 Dist.'}
                        </span>
                      </td>
                      <td className={styles.amount}>{fmt.currency(q.subtotal)}</td>
                      <td className={styles.amount} style={{color:'var(--text3)'}}>{fmt.currency(q.iva_amount)}</td>
                      <td className={`${styles.amount} ${styles.bold}`}>{fmt.currency(q.total)}</td>
                      <td>
                        <select
                          className={styles.statusSelect}
                          value={q.status}
                          onChange={e=>changeStatus(q.id, e.target.value)}
                          style={{background:st.bg, color:st.color}}
                        >
                          {Object.entries(STATUS).map(([k,v])=>(
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className={styles.date}>{fmt.timeAgo(q.created_at)}</td>
                      <td>
                        <a href={"/api/quotes/" + q.id + "/pdf"} target="_blank" rel="noopener noreferrer" className={styles.pdfBtn}>📄 PDF</a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Step 1: Elegir tipo */}
      {step === 'tipo' && (
        <StepTipoCliente
          onSelect={(type) => { setPriceType(type); setStep('form') }}
          onClose={() => setStep(null)}
        />
      )}

      {/* Step 2: Formulario */}
      {step === 'form' && (
        <QuoteModal
          priceType={priceType}
          leads={leads}
          onClose={() => setStep(null)}
          onSaved={() => { refresh(); showToast('✓ Cotización creada'); setStep(null) }}
        />
      )}

      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
