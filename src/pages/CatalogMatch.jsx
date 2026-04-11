import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast, Modal } from '@/components/ui'
import { fmt, withIva } from '@/utils/format'
import api from '@/utils/api'
import styles from './CatalogMatch.module.css'

const TIERS = { Premium:'#a78bfa', Conveniencia:'#60a5fa', Económico:'#34d399' }

// ── Formulario crear producto ─────────────────────────────────
function CreateProductModal({ item, jobId, onClose, onCreated }) {
  const [form, setForm] = useState({
    name:         item.raw_description || '',
    brand:        item.raw_marca || '',
    category:     'Neumático',
    price_normal: item.raw_price || '',
    price_offer:  '',
    stock:        0,
    photo_url:    '',
  })
  const [custom, setCustom] = useState({
    medida:           item.raw_medida  || '',
    aro:              item.raw_diametro || '',
    codigo_proveedor: item.raw_code    || '',
    modelo_neumatico: item.raw_modelo  || '',
  })
  const [saving, setSaving] = useState(false)
  const set  = (k,v) => setForm(f=>({...f,[k]:v}))
  const setC = (k,v) => setCustom(c=>({...c,[k]:v}))

  const { data: fields=[] } = useQuery({
    queryKey: ['catalog-fields'],
    queryFn: () => api.get('/catalog/fields'),
  })

  const { data: families=[] } = useQuery({
    queryKey: ['catalog-families', form.brand],
    queryFn: () => api.get('/catalog/families?brand=' + form.brand),
    enabled: !!form.brand,
  })

  const familiaOptions = [...new Set(families.map(f=>f.familia).filter(Boolean))]
  const modeloOptions  = families.filter(f=>f.familia===custom.familia).map(f=>f.modelo).filter(Boolean)

  const save = async () => {
    if (!form.name || !form.brand) return
    setSaving(true)
    try {
      await api.post(`/catalog-match/${jobId}/items/${item.id}/create`, {
        ...form,
        price_normal: parseFloat(form.price_normal)||0,
        price_offer:  form.price_offer ? parseFloat(form.price_offer) : null,
        custom_fields: custom,
      })
      onCreated()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title="➕ Crear producto nuevo" onClose={onClose} width={640}>
      <div className={styles.createGrid}>
        {/* Datos del Excel */}
        <div className={styles.createSection}>
          <div className={styles.createSectionTitle}>📋 Datos del proveedor</div>
          <div className={styles.rawData}>
            {item.raw_code        && <div><span>Código:</span> <strong>{item.raw_code}</strong></div>}
            {item.raw_description && <div><span>Descripción:</span> <strong>{item.raw_description}</strong></div>}
            {item.raw_medida      && <div><span>Medida:</span> <strong>{item.raw_medida}</strong></div>}
            {item.raw_diametro    && <div><span>Diámetro:</span> <strong>{item.raw_diametro}</strong></div>}
            {item.raw_modelo      && <div><span>Modelo:</span> <strong>{item.raw_modelo}</strong></div>}
            {item.raw_price > 0   && <div><span>Precio:</span> <strong>{fmt.currency(item.raw_price)}</strong></div>}
          </div>
        </div>

        {/* Formulario */}
        <div className={styles.createSection}>
          <div className={styles.createSectionTitle}>📦 Datos del producto</div>
          <div className={styles.formGrid}>
            <div className={styles.formField} style={{gridColumn:'1/-1'}}>
              <label>Nombre *</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)} className={styles.input} placeholder="Nombre del producto"/>
            </div>
            <div className={styles.formField}>
              <label>Marca *</label>
              <input value={form.brand} onChange={e=>set('brand',e.target.value)} className={styles.input}/>
            </div>
            <div className={styles.formField}>
              <label>Categoría</label>
              <input value={form.category} onChange={e=>set('category',e.target.value)} className={styles.input}/>
            </div>
            <div className={styles.formField}>
              <label>Precio normal (neto)</label>
              <input type="number" value={form.price_normal} onChange={e=>set('price_normal',e.target.value)} className={styles.input}/>
            </div>
            <div className={styles.formField}>
              <label>Precio oferta (neto)</label>
              <input type="number" value={form.price_offer} onChange={e=>set('price_offer',e.target.value)} className={styles.input} placeholder="Opcional"/>
            </div>
            <div className={styles.formField}>
              <label>Stock</label>
              <input type="number" value={form.stock} onChange={e=>set('stock',e.target.value)} className={styles.input}/>
            </div>
            <div className={styles.formField}>
              <label>URL foto</label>
              <input value={form.photo_url} onChange={e=>set('photo_url',e.target.value)} className={styles.input} placeholder="https://..."/>
            </div>
          </div>
        </div>

        {/* Campos específicos */}
        <div className={styles.createSection} style={{gridColumn:'1/-1'}}>
          <div className={styles.createSectionTitle}>⚙️ Campos específicos</div>
          <div className={styles.formGrid}>
            {fields.map(f => (
              <div key={f.field_key} className={styles.formField}>
                <label>{f.label}</label>
                {f.field_type === 'boolean' ? (
                  <select className={styles.input} value={custom[f.field_key]||''} onChange={e=>setC(f.field_key,e.target.value)}>
                    <option value="">—</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                ) : f.field_type === 'select' && f.options ? (
                  <select className={styles.input} value={custom[f.field_key]||''} onChange={e=>setC(f.field_key,e.target.value)}>
                    <option value="">Seleccionar</option>
                    {f.options.split(',').map(o=><option key={o} value={o.trim()}>{o.trim()}</option>)}
                  </select>
                ) : f.field_type === 'multiselect' && f.options ? (
                  <div className={styles.multiSelect}>
                    {f.options.split(',').map(o => {
                      const val = o.trim()
                      const selected = (custom[f.field_key]||'').split(',').filter(Boolean)
                      const isOn = selected.includes(val)
                      return (
                        <button key={val} type="button"
                          className={isOn ? styles.multiOptOn : styles.multiOpt}
                          onClick={()=>{
                            const next = isOn ? selected.filter(x=>x!==val) : [...selected, val]
                            setC(f.field_key, next.join(','))
                          }}>{val}</button>
                      )
                    })}
                  </div>
                ) : (
                  <input className={styles.input} value={custom[f.field_key]||''} onChange={e=>setC(f.field_key,e.target.value)} placeholder={f.label}/>
                )}
              )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.createFooter}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={saving} disabled={!form.name||!form.brand}>
          ✓ Crear producto
        </Button>
      </div>
    </Modal>
  )
}

// ── Vista detalle de un job ───────────────────────────────────
function JobDetail({ job, onBack }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('unmatched')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(null)
  const [catalogSearch, setCatalogSearch] = useState({})
  const [catalogResults, setCatalogResults] = useState({})
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const status = tab === 'unmatched' ? 'unmatched' : tab === 'matched' ? 'matched' : ''

  const { data: data={}, refetch } = useQuery({
    queryKey: ['catalog-match-items', job.id, status, page],
    queryFn: () => api.get(`/catalog-match/${job.id}/items?status=${status}&page=${page}&limit=30`),
  })
  const items = data.items || []
  const totalPages = data.pages || 1

  const searchCatalog = async (idx, q) => {
    setCatalogSearch(s=>({...s,[idx]:q}))
    if (q.length < 2) { setCatalogResults(r=>({...r,[idx]:[]})); return }
    const d = await api.get(`/catalog?active=true&search=${q}&limit=6`)
    setCatalogResults(r=>({...r,[idx]:d.products||[]}))
  }

  const assignMatch = async (item, product) => {
    await api.patch(`/catalog-match/${job.id}/items/${item.id}/match`, { product_id: product.id })
    setCatalogSearch(s=>({...s,[item.id]:''}))
    setCatalogResults(r=>({...r,[item.id]:[]}))
    refetch()
    showToast('✓ Match asignado')
  }

  const unmatched = job.unmatched || 0
  const matched   = job.matched   || 0
  const pct       = job.total_rows > 0 ? Math.round(matched/job.total_rows*100) : 0

  return (
    <div className={styles.detailPage}>
      <div className={styles.detailHeader}>
        <button className={styles.backBtn} onClick={onBack}>← Volver</button>
        <div>
          <h2 className={styles.detailTitle}>🏷️ {job.brand} — {job.file_name}</h2>
          <div className={styles.detailMeta}>{job.total_rows} productos en el archivo</div>
        </div>
        <div className={styles.progressBox}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{width: pct+'%'}}/>
          </div>
          <div className={styles.progressText}>
            <span className={styles.matchedCount}>✅ {matched} con match</span>
            <span className={styles.unmatchedCount}>❌ {unmatched} sin match</span>
            <span className={styles.pctText}>{pct}%</span>
          </div>
        </div>
      </div>

      <div className={styles.detailBody}>
        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab==='unmatched'?styles.tabActive:''}`} onClick={()=>{setTab('unmatched');setPage(1)}}>
            ❌ Sin match ({unmatched})
          </button>
          <button className={`${styles.tab} ${tab==='matched'?styles.tabActive:''}`} onClick={()=>{setTab('matched');setPage(1)}}>
            ✅ Con match ({matched})
          </button>
          <button className={`${styles.tab} ${tab==='all'?styles.tabActive:''}`} onClick={()=>{setTab('all');setPage(1)}}>
            📋 Todos ({job.total_rows})
          </button>
        </div>

        {/* Items */}
        <Card className={styles.tableCard}>
          {items.length === 0 ? (
            <Empty icon={tab==='unmatched'?'🎉':'📋'} title={tab==='unmatched'?'¡Todos tienen match!':'Sin resultados'}/>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Código proveedor</th>
                    <th>Descripción Excel</th>
                    <th>Medida</th>
                    <th style={{textAlign:'right'}}>Precio</th>
                    <th>Match</th>
                    <th style={{textAlign:'center'}}>Conf.</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className={it.status==='unmatched'||it.status==='pending' ? styles.rowUnmatched : it.status==='created' ? styles.rowCreated : styles.row}>
                      <td className={styles.mono}>{it.raw_code||'—'}</td>
                      <td>
                        <div className={styles.rawDesc}>{it.raw_description}</div>
                        {it.raw_modelo && <div className={styles.rawMeta}>Modelo: {it.raw_modelo}</div>}
                      </td>
                      <td className={styles.mono}>{it.raw_medida||it.raw_diametro||'—'}</td>
                      <td className={styles.price}>{it.raw_price>0?fmt.currency(it.raw_price):'—'}</td>
                      <td>
                        {it.matched_product_id ? (
                          <div>
                            <div className={styles.matchedName}>{it.matched_brand} — {it.matched_name}</div>
                            <div className={styles.matchedMedida}>{it.matched_medida}</div>
                          </div>
                        ) : it.status==='created' ? (
                          <span className={styles.createdBadge}>✅ Producto creado</span>
                        ) : (
                          <div className={styles.noMatchSearch}>
                            <div className={styles.catalogSearchWrap}>
                              <span className={styles.searchIcon}>🔍</span>
                              <input className={styles.catalogInput}
                                placeholder="Buscar en catálogo..."
                                value={catalogSearch[it.id]||''}
                                onChange={e=>searchCatalog(it.id, e.target.value)}/>
                            </div>
                            {(catalogResults[it.id]||[]).length > 0 && (
                              <div className={styles.catalogDrop}>
                                {catalogResults[it.id].map(p => {
                                  const cf = p.custom_fields||{}
                                  return (
                                    <div key={p.id} className={styles.catalogItem} onClick={()=>assignMatch(it, p)}>
                                      <div className={styles.catalogInfo}>
                                        <div className={styles.catalogName}>{p.brand} — {p.name}</div>
                                        <div className={styles.catalogMeta}>{cf.medida}</div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{textAlign:'center'}}>
                        {it.confidence > 0 ? (
                          <span className={it.confidence>=90?styles.confHigh:it.confidence>=70?styles.confMed:styles.confLow}>
                            {it.confidence}%
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {(it.status==='unmatched'||it.status==='pending') && !it.matched_product_id && (
                          <button className={styles.createBtn} onClick={()=>setCreating(it)}>
                            ➕ Crear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>← Anterior</button>
            <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
            <button className={styles.pageBtn} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Siguiente →</button>
          </div>
        )}
      </div>

      {creating && (
        <CreateProductModal
          item={creating}
          jobId={job.id}
          onClose={()=>setCreating(null)}
          onCreated={()=>{ refetch(); qc.invalidateQueries(['catalog']); showToast('✓ Producto creado') }}
        />
      )}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function CatalogMatch() {
  const qc = useQueryClient()
  const [selectedJob, setSelectedJob] = useState(null)
  const [brand, setBrand] = useState('')
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const { data: jobs=[], refetch } = useQuery({
    queryKey: ['catalog-match-jobs'],
    queryFn: () => api.get('/catalog-match'),
  })

  const { data: filterOptions={} } = useQuery({
    queryKey: ['catalog-filter-options'],
    queryFn: () => api.get('/catalog/filter-options'),
  })

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !brand) { showToast('Selecciona una marca primero'); e.target.value=''; return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('brand', brand)
      const token = localStorage.getItem('lf_token')
      const res = await fetch('/api/catalog-match', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      refetch()
      showToast(`✓ ${data.matched} con match, ${data.unmatched} sin match`)
    } catch(err) {
      showToast('Error: ' + err.message)
    } finally { setUploading(false); e.target.value='' }
  }

  if (selectedJob) return <JobDetail job={selectedJob} onBack={()=>setSelectedJob(null)}/>

  return (
    <div className={styles.page}>
      <Header/>
      <div className={styles.content}>
        {/* Upload */}
        <Card className={styles.uploadCard}>
          <div className={styles.uploadTitle}>🔍 Nuevo match de catálogo</div>
          <div className={styles.uploadRow}>
            <div className={styles.uploadField}>
              <label className={styles.uploadLabel}>1. Selecciona la marca</label>
              <select className={styles.select} value={brand} onChange={e=>setBrand(e.target.value)}>
                <option value="">Seleccionar marca...</option>
                {(filterOptions.brands||[]).map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className={styles.uploadField}>
              <label className={styles.uploadLabel}>2. Sube el Excel del proveedor</label>
              <label className={`${styles.uploadBtn} ${!brand||uploading?styles.uploadBtnDisabled:''}`}>
                {uploading ? (progress || '⏳ Procesando...') : '📤 Subir Excel o PDF'}
                <input type="file" accept=".xlsx,.xls,.pdf" style={{display:'none'}} onChange={handleUpload} disabled={!brand||uploading}/>
              </label>
            </div>
            <div className={styles.uploadInfo}>
              <div className={styles.uploadInfoTitle}>Columnas reconocidas:</div>
              <div className={styles.uploadInfoList}>
                <strong>Excel:</strong> Código, Descripción, Medida, Diámetro, Modelo, Marca, Precio<br/>
                <strong>PDF:</strong> Codigo, Medida, LI/SS, Pattern, Diseño, Tipo_uso, SW, Origen
              </div>
            </div>
          </div>
        </Card>

        {/* Jobs */}
        {jobs.length === 0 ? (
          <Empty icon="🔍" title="Sin análisis previos" subtitle="Sube un Excel para comenzar"/>
        ) : (
          <div className={styles.jobsGrid}>
            {jobs.map(j => {
              const pct = j.total_rows > 0 ? Math.round(j.matched/j.total_rows*100) : 0
              return (
                <div key={j.id} className={styles.jobCard} onClick={()=>setSelectedJob(j)}>
                  <div className={styles.jobTop}>
                    <div className={styles.jobBrand}>{j.brand}</div>
                    <div className={styles.jobPct} style={{color: pct>=90?'#34d399':pct>=70?'#fbbf24':'#f87171'}}>{pct}%</div>
                  </div>
                  <div className={styles.jobFile}>{j.file_name}</div>
                  <div className={styles.jobProgress}>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{width:pct+'%'}}/>
                    </div>
                  </div>
                  <div className={styles.jobStats}>
                    <span className={styles.matchedCount}>✅ {j.matched}</span>
                    <span className={styles.unmatchedCount}>❌ {j.unmatched}</span>
                    <span className={styles.totalCount}>📋 {j.total_rows}</span>
                  </div>
                  <div className={styles.jobFooter}>
                    <span className={styles.jobDate}>{fmt.timeAgo(j.created_at)}</span>
                    {j.unmatched > 0 && <span className={styles.resumeBadge}>⏸️ Pendiente</span>}
                    {j.unmatched === 0 && <span className={styles.doneBadge}>✅ Completo</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
