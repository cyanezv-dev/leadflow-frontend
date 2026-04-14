import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast, Modal, Input, Select } from '@/components/ui'
import { fmt, withIva } from '@/utils/format'
import api from '@/utils/api'
import styles from './Catalog.module.css'

const CATEGORY_PRESETS = ['Neumático', 'Neumáticos', 'Servicio', 'Accesorio', 'Kit', 'Otro']
const UNIT_PRESETS = ['unidad', 'par', 'kit', 'juego', 'servicio']

function categoryOptionsForSelect(current) {
  const c = String(current ?? '').trim()
  const out = [...CATEGORY_PRESETS]
  if (c && !out.some((x) => x.toLowerCase() === c.toLowerCase())) out.unshift(c)
  return out
}

function unitOptionsForSelect(current) {
  const c = String(current ?? '').trim()
  const out = [...UNIT_PRESETS]
  if (c && !out.some((x) => x.toLowerCase() === c.toLowerCase())) out.unshift(c)
  return out
}

function ProductModalSummary({ form, custom, photoBroken, onPhotoError }) {
  const chips = useMemo(() => {
    const c = custom || {}
    const pairs = [
      ['Medida', c.medida],
      ['SKU', c.codigo_sku],
      ['Modelo', c.modelo_neumatico || c.modelo],
      ['Familia', c.familia],
      ['Cód. proveedor', c.codigo_proveedor],
      ['Cód. interno', c.codigo_interno],
      ['Índ. carga', c.indice_carga],
      ['Índ. velocidad', c.indice_velocidad],
      ['Tier', c.tier],
    ].filter(([, v]) => v != null && String(v).trim() !== '')
    return pairs
  }, [custom])

  const priceLine =
    form.price_normal !== '' && form.price_normal != null
      ? fmt.currency(withIva(Number(form.price_normal) || 0))
      : null
  const offerLine =
    form.price_offer !== '' && form.price_offer != null
      ? fmt.currency(withIva(Number(form.price_offer) || 0))
      : null

  return (
    <div className={styles.mSummary}>
      <div className={styles.mSummaryTop}>
        {form.photo_url ? (
          photoBroken ? (
            <div className={styles.mSummaryThumbBroken} title="No se pudo cargar la imagen">⚠️</div>
          ) : (
            <img
              src={form.photo_url}
              alt=""
              className={styles.mSummaryThumb}
              onError={onPhotoError}
            />
          )
        ) : (
          <div className={styles.mSummaryThumbEmpty}>📦</div>
        )}
        <div className={styles.mSummaryText}>
          <div className={styles.mSummaryTitle}>{form.name?.trim() || 'Sin nombre'}</div>
          <div className={styles.mSummaryMeta}>
            {[form.brand, form.category].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className={styles.mSummaryPrices}>
            {priceLine && <span>Precio c/IVA: {priceLine}</span>}
            {offerLine && <span className={styles.mSummaryOffer}>Oferta c/IVA: {offerLine}</span>}
            <span className={styles.mSummaryStock}>Stock: {form.stock ?? 0}</span>
          </div>
        </div>
      </div>
      {chips.length > 0 && (
        <div className={styles.mSummaryChips} aria-label="Datos técnicos">
          {chips.map(([label, val]) => (
            <div key={label} className={styles.mSummaryChip}>
              <span className={styles.mSummaryChipL}>{label}</span>
              <span className={styles.mSummaryChipV}>{String(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductModal({ product, fields, brandOptions, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         product?.name         || '',
    description:  product?.description  || '',
    category:     product?.category     || '',
    brand:        product?.brand        || '',
    unit:         product?.unit         || 'unidad',
    price_normal: product?.price_normal || '',
    price_offer:  product?.price_offer  || '',
    stock:        product?.stock        || 0,
    photo_url:    product?.photo_url    || '',
    active:       product?.active !== false,
    peso_kg:       product?.peso_kg       || '',
    caja_largo_cm: product?.caja_largo_cm || '',
    caja_ancho_cm: product?.caja_ancho_cm || '',
    caja_alto_cm:  product?.caja_alto_cm  || '',
    volumen_cm3:   product?.volumen_cm3   || '',
  })
  const [custom, setCustom] = useState(product?.custom_fields || {})
  const [saving, setSaving] = useState(false)
  const [summaryPhotoBroken, setSummaryPhotoBroken] = useState(false)
  const [dimLoading, setDimLoading] = useState(false)
  const [dimMsg, setDimMsg] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setC = (k, v) => setCustom(c => ({ ...c, [k]: v }))

  // Busca dimensiones en el catálogo y rellena el form
  const fetchAndFillDim = useCallback(async (medida) => {
    if (!medida) { setDimMsg(''); return }
    setDimLoading(true); setDimMsg('')
    try {
      const res = await api.get('/despachos/neumaticos/dimensiones?activo=true')
      const dim = (res.data?.data || []).find(d => d.medida.toLowerCase() === medida.toLowerCase())
      if (!dim) {
        setDimMsg(`⚠️ "${medida}" no está en el catálogo de dimensiones (Logística → Medidas).`)
        return
      }
      setForm(f => ({
        ...f,
        peso_kg:       dim.peso_real_kg,
        caja_largo_cm: dim.caja_largo_cm,
        caja_ancho_cm: dim.caja_ancho_cm,
        caja_alto_cm:  dim.caja_alto_cm,
        volumen_cm3:   dim.volumen_cm3,
      }))
      setDimMsg(`✅ Dimensiones cargadas para ${dim.medida} (${dim.categoria})`)
    } catch { setDimMsg('Error al consultar dimensiones') }
    finally { setDimLoading(false) }
  }, [])

  // Auto-disparar cuando cambia custom.medida (debounce 600ms)
  useEffect(() => {
    const medida = (custom.medida || '').trim()
    if (!medida) { setDimMsg(''); return }
    const timer = setTimeout(() => fetchAndFillDim(medida), 600)
    return () => clearTimeout(timer)
  }, [custom.medida, fetchAndFillDim])

  // Botón manual (por si el usuario quiere re-intentar)
  const autoFillDimensiones = useCallback(() => {
    fetchAndFillDim((custom.medida || '').trim())
  }, [custom.medida, fetchAndFillDim])

  const categoryOpts = useMemo(() => categoryOptionsForSelect(form.category), [form.category])
  const unitOpts = useMemo(() => unitOptionsForSelect(form.unit), [form.unit])
  const brandListId = 'catalog-product-modal-brands'

  useEffect(() => {
    setSummaryPhotoBroken(false)
  }, [form.photo_url, product?.id])

  const save = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const body = { ...form, custom_fields: custom }
      if (product?.id) await api.put(`/catalog/${product.id}`, body)
      else             await api.post('/catalog', body)
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title={product?.id ? 'Editar producto' : 'Nuevo producto'} onClose={onClose} width={720}>
      <ProductModalSummary
        form={form}
        custom={custom}
        photoBroken={summaryPhotoBroken}
        onPhotoError={() => setSummaryPhotoBroken(true)}
      />
      <div className={styles.mSection}>
        <div className={styles.mTitle}>📦 Información base</div>
        <div className={styles.mGrid}>
          <div style={{gridColumn:'1/-1'}}>
            <Input label="Nombre *" placeholder="Nombre del producto" value={form.name} onChange={e=>set('name',e.target.value)}/>
          </div>
          <div>
            <Input
              label="Marca"
              placeholder="Escribe o elige del catálogo"
              value={form.brand}
              list={brandListId}
              onChange={e => set('brand', e.target.value)}
            />
            <datalist id={brandListId}>
              {(brandOptions || []).map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <Select label="Categoría" value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="">Seleccionar…</option>
            {categoryOpts.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
          <Input label="Precio normal" type="number" placeholder="99990" value={form.price_normal} onChange={e=>set('price_normal',e.target.value)}/>
          <Input label="Precio oferta" type="number" placeholder="Opcional" value={form.price_offer} onChange={e=>set('price_offer',e.target.value)}/>
          <Input label="Stock" type="number" value={form.stock} onChange={e=>set('stock',e.target.value)}/>
          <Select label="Unidad" value={form.unit} onChange={e => set('unit', e.target.value)}>
            {unitOpts.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
          <div style={{gridColumn:'1/-1'}}>
            <Input label="URL de foto" placeholder="https://..." value={form.photo_url} onChange={e=>set('photo_url',e.target.value)}/>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <Input label="Descripción" placeholder="Descripción del producto" value={form.description} onChange={e=>set('description',e.target.value)}/>
          </div>
        </div>
      </div>

      {fields.length > 0 && (
        <div className={styles.mSection}>
          <div className={styles.mTitle}>⚙️ Campos específicos</div>
          <div className={styles.mGrid}>
            {fields.map(f => (
              <div key={f.field_key}>
                {f.field_type === 'boolean' ? (
                  <div className={styles.checkField}>
                    <input type="checkbox" id={f.field_key}
                      checked={custom[f.field_key] === 'true' || custom[f.field_key] === true}
                      onChange={e => setC(f.field_key, e.target.checked ? 'true' : 'false')}/>
                    <label htmlFor={f.field_key}>{f.label}</label>
                  </div>
                ) : f.field_type === 'multiselect' && f.options ? (
                  <div>
                    <label className={styles.fieldLabel}>{f.label}</label>
                    <div className={styles.multiSelect}>
                      {f.options.split(',').map(o => {
                        const val = o.trim()
                        const selected = (custom[f.field_key]||'').split(',').filter(Boolean)
                        const isSelected = selected.includes(val)
                        return (
                          <button
                            key={val}
                            type="button"
                            className={`${styles.multiOpt} ${isSelected ? styles.multiOptOn : ''}`}
                            onClick={() => {
                              const curr = (custom[f.field_key]||'').split(',').filter(Boolean)
                              const next = isSelected ? curr.filter(x=>x!==val) : [...curr, val]
                              setC(f.field_key, next.join(','))
                            }}
                          >{val}</button>
                        )
                      })}
                    </div>
                  </div>
                ) : f.field_type === 'select' && f.options ? (
                  <div>
                    <label className={styles.fieldLabel}>{f.label}</label>
                    <select className={styles.fieldInput} value={custom[f.field_key]||''} onChange={e=>setC(f.field_key,e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {f.options.split(',').map(o=><option key={o} value={o.trim()}>{o.trim()}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className={styles.fieldLabel}>{f.label}{f.required?' *':''}</label>
                    <input className={styles.fieldInput} type={f.field_type==='number'?'number':'text'}
                      placeholder={f.label}
                      value={custom[f.field_key]||''}
                      onChange={e=>setC(f.field_key,e.target.value)}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Dimensiones de despacho ── */}
      <div className={styles.mSection}>
        <div className={styles.mTitle} style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <span>📦 Dimensiones de despacho</span>
          <button
            type="button"
            className={styles.autoFillBtn}
            onClick={autoFillDimensiones}
            disabled={dimLoading}
          >
            {dimLoading ? '⏳ Buscando…' : '✨ Auto-rellenar desde medida'}
          </button>
        </div>
        {dimMsg && (
          <div className={`${styles.dimMsg} ${dimMsg.startsWith('✅') ? styles.dimMsgOk : styles.dimMsgWarn}`}>
            {dimMsg}
          </div>
        )}
        <div className={styles.mGrid}>
          <Input
            label="Peso (kg)"
            type="number" step="0.1"
            placeholder="Ej: 9.5"
            value={form.peso_kg}
            onChange={e => set('peso_kg', e.target.value)}
          />
          <Input
            label="Largo caja (cm)"
            type="number" step="0.01"
            placeholder="Ej: 63.2"
            value={form.caja_largo_cm}
            onChange={e => set('caja_largo_cm', e.target.value)}
          />
          <Input
            label="Ancho caja (cm)"
            type="number" step="0.01"
            placeholder="Ej: 63.2"
            value={form.caja_ancho_cm}
            onChange={e => set('caja_ancho_cm', e.target.value)}
          />
          <Input
            label="Alto caja (cm)"
            type="number" step="0.01"
            placeholder="Ej: 20.5"
            value={form.caja_alto_cm}
            onChange={e => set('caja_alto_cm', e.target.value)}
          />
          <Input
            label="Volumen (cm³)"
            type="number" step="0.01"
            placeholder="Auto-calculado"
            value={form.volumen_cm3}
            onChange={e => set('volumen_cm3', e.target.value)}
          />
          {form.peso_kg && form.caja_largo_cm && (
            <div className={styles.dimPreview}>
              <span className={styles.dimPreviewLabel}>Peso volumétrico (÷4000)</span>
              <strong>{(parseFloat(form.caja_largo_cm) * parseFloat(form.caja_ancho_cm || form.caja_largo_cm) * parseFloat(form.caja_alto_cm || 0) / 4000).toFixed(2)} kg</strong>
            </div>
          )}
        </div>
      </div>

      <div className={styles.mActions}>
        <label className={styles.activeToggle}>
          <input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/>
          Producto activo
        </label>
        <div style={{display:'flex',gap:8}}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving} disabled={!form.name}>
            {product?.id ? '💾 Guardar' : '✓ Crear producto'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function FieldsModal({ fields, onClose, onSaved }) {
  const [newField, setNewField] = useState({ field_key:'', label:'', field_type:'text', options:'', required:false })
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  const addField = async () => {
    if (!newField.field_key || !newField.label) return
    setSaving(true)
    try {
      await api.post('/catalog/fields', { ...newField, ord: fields.length })
      qc.invalidateQueries(['catalog-fields'])
      setNewField({ field_key:'', label:'', field_type:'text', options:'', required:false })
      onSaved()
    } finally { setSaving(false) }
  }

  const deleteField = async (key) => {
    if (!confirm(`¿Eliminar el campo "${key}"?`)) return
    await api.delete(`/catalog/fields/${key}`)
    qc.invalidateQueries(['catalog-fields'])
    onSaved()
  }

  return (
    <Modal title="⚙️ Campos personalizados" onClose={onClose} width={560}>
      <div className={styles.fieldsList}>
        {fields.map(f => (
          <div key={f.field_key} className={styles.fieldRow}>
            <div className={styles.fieldRowInfo}>
              <span className={styles.fieldKey}>{f.field_key}</span>
              <span className={styles.fieldLabel2}>{f.label}</span>
              <span className={styles.fieldType}>{f.field_type}</span>
              {f.required && <span className={styles.fieldReq}>requerido</span>}
            </div>
            <button className={styles.fieldDel} onClick={() => deleteField(f.field_key)}>✕</button>
          </div>
        ))}
        {fields.length === 0 && <p style={{color:'var(--text3)',fontSize:13}}>Sin campos personalizados</p>}
      </div>

      <div className={styles.mTitle} style={{marginTop:16}}>Agregar campo nuevo</div>
      <div className={styles.mGrid} style={{marginTop:8}}>
        <Input label="Clave (sin espacios)" placeholder="ej: medida" value={newField.field_key}
          onChange={e=>setNewField(f=>({...f,field_key:e.target.value.toLowerCase().replace(/\s/g,'_')}))}/>
        <Input label="Etiqueta" placeholder="ej: Medida" value={newField.label}
          onChange={e=>setNewField(f=>({...f,label:e.target.value}))}/>
        <Select label="Tipo" value={newField.field_type} onChange={e=>setNewField(f=>({...f,field_type:e.target.value}))}>
          <option value="text">Texto</option>
          <option value="number">Número</option>
          <option value="select">Selección</option>
          <option value="boolean">Sí/No</option>
        </Select>
        <Input label="Opciones (si es selección)" placeholder="Op1,Op2,Op3" value={newField.options}
          onChange={e=>setNewField(f=>({...f,options:e.target.value}))}/>
      </div>
      <div className={styles.mActions} style={{marginTop:12}}>
        <label className={styles.activeToggle}>
          <input type="checkbox" checked={newField.required} onChange={e=>setNewField(f=>({...f,required:e.target.checked}))}/>
          Requerido
        </label>
        <Button onClick={addField} loading={saving} disabled={!newField.field_key||!newField.label}>
          + Agregar campo
        </Button>
      </div>

      <div className={styles.mActions} style={{borderTop:'1px solid var(--border)',paddingTop:16,marginTop:16}}>
        <div/>
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  )
}

export default function Catalog() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showFields, setShowFields] = useState(false)
  const [toast, setToast] = useState('')
  const [page, setPage] = useState(1)
  const [showInactive, setShowInactive] = useState(false)
  const [showNoPhoto, setShowNoPhoto] = useState(false)
  const [brokenPhotos, setBrokenPhotos] = useState(new Set())
  const markBroken = (id) => setBrokenPhotos(prev => new Set([...prev, id]))
  const [photoModal, setPhotoModal] = useState(null)
  const [filterMarca, setFilterMarca] = useState('')
  const [filterAncho, setFilterAncho] = useState('')
  const [filterPerfil, setFilterPerfil] = useState('')
  const [filterAro, setFilterAro] = useState('')
  const [soloStock, setSoloStock] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('lf_token')
      const res = await fetch('/api/catalog/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImportResult(data)
      refresh()
      showToast(`✓ ${data.created} creados, ${data.updated} actualizados`)
    } catch(err) {
      showToast('Error: ' + err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const { data: catalogData={}, isLoading } = useQuery({
    queryKey: ['catalog', search, page, showInactive, filterMarca, filterAncho, filterPerfil, filterAro, soloStock],
    queryFn: () => {
      let url = `/catalog?active=${!showInactive}&page=${page}&limit=50`
      if (search)       url += `&search=${search}`
      if (filterMarca)  url += `&brand=${filterMarca}`
      if (filterAncho)  url += `&ancho=${filterAncho}`
      if (filterPerfil) url += `&perfil=${filterPerfil}`
      if (filterAro)    url += `&aro=${filterAro}`
      if (soloStock)    url += `&stock=1`
      return api.get(url)
    },
    keepPreviousData: true,
  })
  const products = catalogData.products || []
  const totalPages = catalogData.pages || 1
  const totalProducts = catalogData.total || 0

  const { data: filterOptions={} } = useQuery({
    queryKey: ['catalog-filter-options'],
    queryFn: () => api.get('/catalog/filter-options'),
  })

  const { data: fields=[] } = useQuery({
    queryKey: ['catalog-fields'],
    queryFn: () => api.get('/catalog/fields'),
  })

  const refresh = () => { qc.invalidateQueries(['catalog']); setPage(1) }
  const resetFilters = () => {
    setFilterMarca(''); setFilterAncho(''); setFilterPerfil(''); setFilterAro(''); setSoloStock(false); setPage(1)
  }
  const hasFilters = filterMarca || filterAncho || filterPerfil || filterAro || soloStock

  const toggleActive = async (p) => {
    await api.put(`/catalog/${p.id}`, { ...p, active: !p.active, custom_fields: p.custom_fields||{} })
    refresh()
  }

  const deleteProduct = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return
    await api.delete(`/catalog/${id}`)
    refresh()
    showToast('Producto eliminado')
  }

  return (
    <div className={styles.page}>
      <Header
        onSearch={setSearch}
        actions={
          <div style={{display:'flex',gap:8}}>
            <a href="/api/catalog/template" className={styles.templateBtn}>
              📥 Descargar template
            </a>
            <label className={styles.importBtn}>
              {importing ? '⏳ Importando...' : '📤 Importar Excel'}
              <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleImport} disabled={importing}/>
            </label>
            <button
              className={showInactive ? styles.inactiveOn : styles.inactiveOff}
              onClick={() => { setShowInactive(v => !v); setPage(1); }}
            >
              {showInactive ? '🚫 Inactivos' : '👁️ Ver inactivos'}
            </button>
            <button
              className={showNoPhoto ? styles.inactiveOn : styles.inactiveOff}
              onClick={() => { setShowNoPhoto(v => !v); setPage(1); }}
            >
              {showNoPhoto ? '🖼️ Sin foto (activo)' : `🖼️ Sin foto${brokenPhotos.size>0?' ('+brokenPhotos.size+' rotas)':''}`}
            </button>
            <Button variant="ghost" size="sm" onClick={()=>setShowFields(true)}>⚙️ Campos</Button>
            <Button size="sm" onClick={()=>setShowNew(true)}>➕ Nuevo producto</Button>
          </div>
        }
      />

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statN}>{totalProducts}</span>
            <span className={styles.statL}>Productos activos</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statN}>{products.filter(p=>p.price_offer).length}</span>
            <span className={styles.statL}>En oferta</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statN}>{products.filter(p=>p.stock<=0).length}</span>
            <span className={styles.statL}>Sin stock</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statN}>{fields.length}</span>
            <span className={styles.statL}>Campos personalizados</span>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filtersBar}>
          <select className={styles.filterSel} value={filterMarca} onChange={e=>{setFilterMarca(e.target.value);setPage(1)}}>
            <option value="">Todas las marcas</option>
            {(filterOptions.brands||[]).map(b=><option key={b} value={b}>{b}</option>)}
          </select>
          <select className={styles.filterSel} value={filterAncho} onChange={e=>{setFilterAncho(e.target.value);setPage(1)}}>
            <option value="">Ancho</option>
            {(filterOptions.anchos||[]).map(v=><option key={v} value={v}>{v}</option>)}
          </select>
          <select className={styles.filterSel} value={filterPerfil} onChange={e=>{setFilterPerfil(e.target.value);setPage(1)}}>
            <option value="">Perfil</option>
            {(filterOptions.perfiles||[]).map(v=><option key={v} value={v}>{v}</option>)}
          </select>
          <select className={styles.filterSel} value={filterAro} onChange={e=>{setFilterAro(e.target.value);setPage(1)}}>
            <option value="">Aro</option>
            {(filterOptions.aros||[]).map(v=><option key={v} value={v}>{v}</option>)}
          </select>
          <label className={styles.stockToggle}>
            <input type="checkbox" checked={soloStock} onChange={e=>{setSoloStock(e.target.checked);setPage(1)}}/>
            Con stock
          </label>
          {hasFilters && (
            <button className={styles.clearFilters} onClick={resetFilters}>✕ Limpiar filtros</button>
          )}
          <span className={styles.filterCount}>{totalProducts} productos</span>
        </div>

        {/* Import result */}
        {importResult && (
          <div className={styles.importResult}>
            <div className={styles.importStats}>
              <span className={styles.importOk}>✓ {importResult.created} productos creados</span>
              <span className={styles.importUpd}>↑ {importResult.updated} actualizados</span>
              <span className={styles.importTotal}>Total: {importResult.total} filas</span>
              <button className={styles.importClose} onClick={()=>setImportResult(null)}>✕</button>
            </div>
            {importResult.errors?.length > 0 && (
              <div className={styles.importErrors}>
                <strong>⚠️ Errores ({importResult.errors.length}):</strong>
                {importResult.errors.map((e,i) => <div key={i} className={styles.importError}>{e}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <Card className={styles.tableCard}>
          {isLoading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : products.length === 0 ? (
            <Empty icon="📦" title="Sin productos" subtitle='Haz click en "+ Nuevo producto" para agregar'/>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Foto</th>
                    <th>Producto</th>
                    <th>Cód. Proveedor</th>
                    <th>Categoría</th>
                    {fields.slice(0,4).map(f => <th key={f.field_key}>{f.label}</th>)}
                    <th style={{textAlign:'right'}}>Precio c/IVA</th>
                    <th style={{textAlign:'right'}}>Oferta c/IVA</th>
                    <th style={{textAlign:'center'}}>Stock</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(showNoPhoto ? products.filter(p => !p.photo_url || p.photo_url==='' || brokenPhotos.has(p.id)) : products).map(p => (
                    <tr key={p.id} className={styles.row}>
                      <td className={styles.skuCell}>{p.custom_fields?.codigo_sku || '—'}</td>
                      <td>
                        {p.photo_url
                          ? (brokenPhotos.has(p.id)
                              ? <div className={styles.thumbBroken} onClick={()=>setEditing(p)} title="Foto rota - click para editar">⚠️</div>
                              : <img src={p.photo_url} className={styles.thumbClick} alt={p.name}
                                  onClick={()=>setPhotoModal({url:p.photo_url,name:p.name})}
                                  onError={()=>markBroken(p.id)}/>
                            )
                          : <div className={styles.thumbEmpty} onClick={()=>setEditing(p)} title="Sin foto - click para agregar">📦</div>
                        }
                      </td>
                      <td>
                        <div className={styles.productName}>{p.name}</div>
                        {p.brand && <div className={styles.productBrand}>{p.brand}</div>}
                        {(p.custom_fields?.homologacion_oem || p.custom_fields?.runflat) && (
                          <div className={styles.oemBadges}>
                            {p.custom_fields?.runflat && p.custom_fields.runflat !== 'false' && p.custom_fields.runflat !== 'NO' && (
                              <span className={styles.runflatBadge}>{p.custom_fields.runflat}</span>
                            )}
                            {p.custom_fields?.homologacion_oem && p.custom_fields.homologacion_oem.split(',').map(c=>(
                              <span key={c} className={styles.oemBadge}>{c}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={styles.customCell}>{p.custom_fields?.codigo_proveedor || '—'}</td>
                      <td className={styles.catCell}>{p.category||'—'}</td>
                      {fields.filter(f=>f.field_key!=='codigo_proveedor'&&f.field_key!=='codigo_interno').slice(0,4).map(f => (
                        <td key={f.field_key} className={styles.customCell}>
                          {p.custom_fields?.[f.field_key] === 'true' ? '✓' :
                           p.custom_fields?.[f.field_key] === 'false' ? '—' :
                           p.custom_fields?.[f.field_key] || '—'}
                        </td>
                      ))}
                      <td className={styles.price}>{fmt.currency(withIva(p.price_normal))}</td>
                      <td className={styles.offer}>
                        {p.price_offer ? (
                          <span className={styles.offerBadge}>{fmt.currency(withIva(p.price_offer))}</span>
                        ) : '—'}
                      </td>
                      <td className={styles.stockCell}>
                        <span className={p.stock > 0 ? styles.inStock : styles.noStock}>
                          {p.stock}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.actionBtn} onClick={()=>setEditing(p)} title="Editar">✏️</button>
                          <button className={styles.actionBtn} onClick={()=>toggleActive(p)} title={p.active?'Desactivar':'Activar'}>
                            {p.active ? '👁️' : '🚫'}
                          </button>
                          <button className={`${styles.actionBtn} ${styles.delBtn}`} onClick={()=>deleteProduct(p.id)} title="Eliminar">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>← Anterior</button>
          <span className={styles.pageInfo}>Página {page} de {totalPages} — {totalProducts} productos</span>
          <button className={styles.pageBtn} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Siguiente →</button>
        </div>
      )}

      {photoModal && (
        <div className={styles.photoOverlay} onClick={()=>setPhotoModal(null)}>
          <div className={styles.photoModal}>
            <img src={photoModal.url} alt={photoModal.name} className={styles.photoLarge}/>
            <div className={styles.photoName}>{photoModal.name}</div>
            <button className={styles.photoClose} onClick={()=>setPhotoModal(null)}>✕ Cerrar</button>
          </div>
        </div>
      )}

      {showNew   && <ProductModal fields={fields} brandOptions={filterOptions.brands} onClose={()=>setShowNew(false)} onSaved={()=>{refresh();showToast('Producto creado')}}/>}
      {editing   && <ProductModal product={editing} fields={fields} brandOptions={filterOptions.brands} onClose={()=>setEditing(null)} onSaved={()=>{refresh();showToast('Producto actualizado')}}/>}
      {showFields&& <FieldsModal fields={fields} onClose={()=>setShowFields(false)} onSaved={()=>qc.invalidateQueries(['catalog-fields'])}/>}
      {toast     && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
