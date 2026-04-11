import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast, Modal } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './Families.module.css'

const PHOTO_TYPES = [
  { key:'frente',  label:'Frente',   icon:'⬆️' },
  { key:'costado', label:'Costado',  icon:'➡️' },
  { key:'di',      label:'DI',       icon:'↙️' },
  { key:'dd',      label:'DD',       icon:'↘️' },
  { key:'huella',  label:'Huella',   icon:'👣' },
  { key:'extra',   label:'Extra',    icon:'📸' },
]

// ── Modal editar familia ──────────────────────────────────────
function FamilyModal({ family, brands, onClose, onSaved }) {
  const [form, setForm] = useState({
    brand:          family?.brand          || '',
    familia:        family?.familia        || '',
    modelo:         family?.modelo         || '',
    description:    family?.description    || '',
    caracteristicas:family?.caracteristicas|| '',
    beneficios:     family?.beneficios     || '',
    etiquetas:      (family?.etiquetas||[]).join(', ') || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const save = async () => {
    if (!form.brand || !form.familia) return
    setSaving(true)
    try {
      const body = {
        ...form,
        etiquetas: form.etiquetas ? form.etiquetas.split(',').map(e=>e.trim()).filter(Boolean) : []
      }
      if (family?.id) await api.put(`/families/${family.id}`, body)
      else            await api.post('/families', body)
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title={family?.id ? 'Editar familia/modelo' : 'Nueva familia/modelo'} onClose={onClose} width={680}>
      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label>Marca *</label>
          <select className={styles.input} value={form.brand} onChange={e=>set('brand',e.target.value)}>
            <option value="">Seleccionar...</option>
            {brands.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label>Familia *</label>
          <input className={styles.input} value={form.familia} onChange={e=>set('familia',e.target.value)} placeholder="Ej: TURANZA"/>
        </div>
        <div className={styles.formField}>
          <label>Modelo</label>
          <input className={styles.input} value={form.modelo} onChange={e=>set('modelo',e.target.value)} placeholder="Ej: T005"/>
        </div>
        <div className={styles.formField}>
          <label>Etiquetas (separadas por coma)</label>
          <input className={styles.input} value={form.etiquetas} onChange={e=>set('etiquetas',e.target.value)} placeholder="Runflat, XL, M+S..."/>
        </div>
        <div className={styles.formField} style={{gridColumn:'1/-1'}}>
          <label>Descripción general</label>
          <textarea className={styles.textarea} rows={2} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Descripción del producto..."/>
        </div>
        <div className={styles.formField} style={{gridColumn:'1/-1'}}>
          <label>Características técnicas</label>
          <textarea className={styles.textarea} rows={3} value={form.caracteristicas} onChange={e=>set('caracteristicas',e.target.value)} placeholder="• Banda de rodadura optimizada&#10;• Compuesto de silicio..."/>
        </div>
        <div className={styles.formField} style={{gridColumn:'1/-1'}}>
          <label>Beneficios</label>
          <textarea className={styles.textarea} rows={3} value={form.beneficios} onChange={e=>set('beneficios',e.target.value)} placeholder="• Mayor durabilidad&#10;• Mejor adherencia en mojado..."/>
        </div>
      </div>
      <div className={styles.modalFooter}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={saving} disabled={!form.brand||!form.familia}>
          {family?.id ? '💾 Guardar' : '✓ Crear'}
        </Button>
      </div>
    </Modal>
  )
}

// ── Vista detalle familia ─────────────────────────────────────
function FamilyDetail({ family, onBack, onRefresh }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [toast, setToast] = useState('')
  const [uploadingType, setUploadingType] = useState(null)
  const [activeTab, setActiveTab] = useState('info')

  const { data: products=[] } = useQuery({
    queryKey: ['family-products', family.brand, family.familia, family.modelo],
    queryFn: async () => {
      // Use brand filter for more accurate results
      let url = '/profitability?page=1&limit=200&brand=' + encodeURIComponent(family.brand)
      const data = await api.get(url)
      return (data.products||[]).filter(p => {
        const cf = p.custom_fields||{}
        const famMatch = cf.familia === family.familia
        const modMatch = !family.modelo || cf.modelo_neumatico === family.modelo
        return famMatch && modMatch
      })
    },
  })
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const { data: fam={}, refetch } = useQuery({
    queryKey: ['family-detail', family.id],
    queryFn: () => api.get(`/families/${family.id}`),
  })

  const { data: filterOptions={} } = useQuery({
    queryKey: ['catalog-filter-options'],
    queryFn: () => api.get('/catalog/filter-options'),
  })

  const photos = fam.photos || []
  const getPhoto = (type) => photos.find(p=>p.type===type)

  const uploadPhoto = async (type, file) => {
    setUploadingType(type)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      fd.append('photo_type', type)
      const token = localStorage.getItem('lf_token')
      const res = await fetch(`/api/families/${family.id}/photos`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer '+token } : {},
        body: fd
      })
      await res.json()
      refetch()
      showToast('✓ Foto subida')
    } finally { setUploadingType(null) }
  }

  const deletePhoto = async (photoId) => {
    await api.delete(`/families/${family.id}/photos/${photoId}`)
    refetch()
    showToast('Foto eliminada')
  }

  const tags = fam.etiquetas || []

  return (
    <div className={styles.detailPage}>
      <div className={styles.detailHeader}>
        <button className={styles.backBtn} onClick={onBack}>← Volver</button>
        <div className={styles.detailTitleBlock}>
          <h2 className={styles.detailTitle}>{fam.brand} · {fam.familia}{fam.modelo ? ' / ' + fam.modelo : ''}</h2>
          <div className={styles.detailMeta}>{fam.product_count||0} productos en el catálogo</div>
        </div>
        <div className={styles.detailActions}>
          <Button size="sm" variant="ghost" onClick={()=>setEditing(true)}>✏️ Editar info</Button>
        </div>
      </div>

      <div className={styles.detailBody}>
        <div className={styles.tabs}>
          <button className={styles.tab + ' ' + (activeTab==='info'?styles.tabActive:'')} onClick={()=>setActiveTab('info')}>📝 Info & Fotos</button>
          <button className={styles.tab + ' ' + (activeTab==='products'?styles.tabActive:'')} onClick={()=>setActiveTab('products')}>📦 Productos ({products.length})</button>
        </div>

        {activeTab==='products' && (
          <Card className={styles.tableCard}>
            {products.length===0 ? (
              <Empty icon="📦" title="Sin productos" subtitle="No hay productos con esta familia/modelo"/>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Foto</th><th>SKU</th><th>Nombre</th><th>Medida</th>
                      <th style={{textAlign:'right'}}>Precio c/IVA</th>
                      <th style={{textAlign:'center'}}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const cf = p.custom_fields||{}
                      return (
                        <tr key={p.id} className={styles.row}>
                          <td>{p.photo_url ? <img src={p.photo_url} style={{width:36,height:36,objectFit:'contain',borderRadius:4,border:'1px solid var(--border)'}} alt="" onError={e=>e.target.style.display='none'}/> : <div style={{width:36,height:36,background:'var(--bg3)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center'}}>📦</div>}</td>
                          <td className={styles.mono}>{cf.codigo_sku||'—'}</td>
                          <td><div className={styles.prodName}>{p.name}</div>{p.description&&<div className={styles.prodDesc}>{p.description}</div>}</td>
                          <td className={styles.mono}>{cf.medida||'—'}</td>
                          <td className={styles.price}>{fmt.currency(Math.round(parseFloat(p.price_normal||0)*1.19))}</td>
                          <td style={{textAlign:'center'}}><span style={{fontSize:12,fontWeight:700,color:p.stock>0?'var(--green)':'var(--red)'}}>{p.stock}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab==='info' && (
          <>
            <Card className={styles.photosCard}>
              <div className={styles.sectionTitle}>📸 Fotos del producto</div>
              <div className={styles.photosGrid}>
                {PHOTO_TYPES.map(pt => {
                  const photo = getPhoto(pt.key)
                  return (
                    <div key={pt.key} className={styles.photoSlot}>
                      <div className={styles.photoLabel}>{pt.icon} {pt.label}</div>
                      {photo ? (
                        <div className={styles.photoWrapper}>
                          <img src={photo.url} className={styles.photoImg} alt={pt.label} onError={e=>e.target.style.display='none'}/>
                          <button className={styles.photoDelete} onClick={()=>deletePhoto(photo.id)}>✕</button>
                        </div>
                      ) : (
                        <label className={styles.photoUpload}>
                          {uploadingType===pt.key ? '⏳' : '+'}
                          <input type="file" accept="image/*" style={{display:'none'}}
                            onChange={e=>e.target.files[0]&&uploadPhoto(pt.key,e.target.files[0])}
                            disabled={uploadingType===pt.key}/>
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            <div className={styles.contentGrid}>
              {tags.length > 0 && (
                <Card className={styles.tagsCard}>
                  <div className={styles.sectionTitle}>🏷️ Etiquetas especiales</div>
                  <div className={styles.tagsList}>{tags.map((t,i)=><span key={i} className={styles.tag}>{t}</span>)}</div>
                </Card>
              )}
              {fam.description && (
                <Card className={styles.textCard}>
                  <div className={styles.sectionTitle}>📝 Descripción</div>
                  <p className={styles.textContent}>{fam.description}</p>
                </Card>
              )}
              {fam.caracteristicas && (
                <Card className={styles.textCard}>
                  <div className={styles.sectionTitle}>⚙️ Características técnicas</div>
                  <p className={styles.textContent} style={{whiteSpace:'pre-line'}}>{fam.caracteristicas}</p>
                </Card>
              )}
              {fam.beneficios && (
                <Card className={styles.textCard}>
                  <div className={styles.sectionTitle}>✅ Beneficios</div>
                  <p className={styles.textContent} style={{whiteSpace:'pre-line'}}>{fam.beneficios}</p>
                </Card>
              )}
              {!fam.description && !fam.caracteristicas && !fam.beneficios && tags.length===0 && (
                <Card><Empty icon="✏️" title="Sin contenido" subtitle="Haz click en Editar info para agregar descripción"/></Card>
              )}
            </div>
          </>
        )}
      </div>
      {editing && (
        <FamilyModal
          family={fam}
          brands={filterOptions.brands||[]}
          onClose={()=>setEditing(false)}
          onSaved={()=>{ refetch(); onRefresh(); showToast('✓ Guardado') }}
        />
      )}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Families() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [selected, setSelected] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const { data: families=[], isLoading, refetch } = useQuery({
    queryKey: ['families', search, filterBrand],
    queryFn: () => api.get('/families' + (filterBrand?`?brand=${filterBrand}`:'') + (search?(filterBrand?'&':'?')+'search='+search:'')),
  })

  const { data: filterOptions={} } = useQuery({
    queryKey: ['catalog-filter-options'],
    queryFn: () => api.get('/catalog/filter-options'),
  })

  const deleteFamily = async (id) => {
    if (!confirm('¿Eliminar esta familia?')) return
    await api.delete(`/families/${id}`)
    refetch()
    showToast('Eliminada')
  }

  if (selected) return <FamilyDetail family={selected} onBack={()=>setSelected(null)} onRefresh={refetch}/>

  return (
    <div className={styles.page}>
      <Header
        onSearch={setSearch}
        actions={<Button size="sm" onClick={()=>setShowNew(true)}>➕ Nueva familia</Button>}
      />
      <div className={styles.content}>
        {/* Filtro marca */}
        <div className={styles.toolbar}>
          <select className={styles.filterSel} value={filterBrand} onChange={e=>setFilterBrand(e.target.value)}>
            <option value="">Todas las marcas ({families.length})</option>
            {(filterOptions.brands||[]).map(b=><option key={b} value={b}>{b}</option>)}
          </select>
          <span className={styles.filterCount}>{families.length} familias</span>
        </div>

        {isLoading ? (
          <div className={styles.loading}><Spinner/></div>
        ) : families.length === 0 ? (
          <Empty icon="🏷️" title="Sin familias" subtitle='Click en "Nueva familia" para crear'/>
        ) : (
          <div className={styles.grid}>
            {families.map(f => {
              const photos = f.photos || []
              const mainPhoto = photos.find(p=>p.type==='frente') || photos[0]
              const hasContent = f.description || f.caracteristicas || f.beneficios
              const tags = f.etiquetas || []
              return (
                <div key={f.id} className={styles.card} onClick={()=>setSelected(f)}>
                  {/* Foto principal */}
                  <div className={styles.cardPhoto}>
                    {mainPhoto ? (
                      <img src={mainPhoto.url} className={styles.cardImg} alt={f.familia}
                        onError={e=>e.target.parentNode.innerHTML='<div class="'+styles.cardNoPhoto+'">📷</div>'}/>
                    ) : (
                      <div className={styles.cardNoPhoto}>📷</div>
                    )}
                    <div className={styles.cardPhotoBadge}>{photos.length}/6 fotos</div>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardBrand}>{f.brand}</div>
                    <div className={styles.cardTitle}>{f.familia}</div>
                    {f.modelo && <div className={styles.cardModelo2}>{f.modelo}</div>}
                    <div className={styles.cardCount}>{f.product_count||0} productos</div>

                    {tags.length > 0 && (
                      <div className={styles.cardTags}>
                        {tags.slice(0,3).map((t,i)=><span key={i} className={styles.tag}>{t}</span>)}
                        {tags.length>3&&<span className={styles.tag}>+{tags.length-3}</span>}
                      </div>
                    )}

                    <div className={styles.cardIndicators}>
                      <span className={hasContent?styles.indOn:styles.indOff}>📝 Contenido</span>
                      <span className={photos.length>0?styles.indOn:styles.indOff}>📸 Fotos</span>
                    </div>
                  </div>

                  <div className={styles.cardActions} onClick={e=>e.stopPropagation()}>
                    <button className={styles.delBtn} onClick={()=>deleteFamily(f.id)}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showNew && (
        <FamilyModal
          brands={filterOptions.brands||[]}
          onClose={()=>setShowNew(false)}
          onSaved={()=>{ refetch(); showToast('✓ Familia creada') }}
        />
      )}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
