import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { Button, Card, Toast } from '@/components/ui'
import { fmt } from '@/utils/format'
import styles from './TireAnalyzer.module.css'

const TIER_COLOR = { Premium:'#a78bfa', Conveniencia:'#60a5fa', Económico:'#34d399' }

export default function TireAnalyzer() {
  const navigate = useNavigate()
  const fileRef  = useRef()
  const [image, setImage]       = useState(null)
  const [preview, setPreview]   = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult]     = useState(null)
  const [selected, setSelected] = useState([])
  const [cantidad, setCantidad] = useState(4)
  const [toast, setToast]       = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

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
    setResult(null)
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
    } catch(e) {
      showToast('Error: ' + e.message)
    } finally { setAnalyzing(false) }
  }

  const toggleSelect = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id])
  }

  const selectedProducts = result?.productos?.filter(p => selected.includes(p.id)) || []

  const goToQuote = () => {
    // Store in sessionStorage for the quotes page to pick up
    sessionStorage.setItem('tire_analyzer_products', JSON.stringify({
      products: selectedProducts,
      medida: result?.tire_info?.medida,
      cantidad
    }))
    navigate('/quotes/new')
    showToast('Redirigiendo a nueva cotización...')
  }

  const tire = result?.tire_info
  const productos = result?.productos || []
  const byTier = {}
  productos.forEach(p => {
    const t = p.tier || 'Económico'
    if (!byTier[t]) byTier[t] = []
    byTier[t].push(p)
  })

  return (
    <div className={styles.page}>
      <Header/>
      <div className={styles.content}>
        <div className={styles.pageTitle}>
          <h1 className={styles.title}>📸 Analizador de Neumático</h1>
          <p className={styles.subtitle}>Sube una foto del neumático y la IA detectará la medida y buscará alternativas</p>
        </div>

        <div className={styles.layout}>
          {/* Columna izquierda — Upload + Info */}
          <div className={styles.leftCol}>
            {/* Upload */}
            <Card className={styles.uploadCard}>
              <div
                className={styles.dropZone}
                onClick={()=>fileRef.current?.click()}
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{ e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
              >
                {preview ? (
                  <img src={preview} className={styles.preview} alt="Neumático"/>
                ) : (
                  <div className={styles.dropContent}>
                    <div className={styles.dropIcon}>📷</div>
                    <div className={styles.dropText}>Arrastra una foto o haz click</div>
                    <div className={styles.dropHint}>JPG, PNG — flanco o foto completa del neumático</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
                onChange={e=>handleFile(e.target.files[0])}/>
              <div className={styles.uploadActions}>
                <Button onClick={analyze} loading={analyzing} disabled={!image}>
                  {analyzing ? '🔍 Analizando...' : '🤖 Analizar con IA'}
                </Button>
                {preview && (
                  <Button variant="ghost" onClick={()=>{ setImage(null); setPreview(null); setResult(null) }}>
                    🗑️ Limpiar
                  </Button>
                )}
              </div>
            </Card>

            {/* Datos detectados */}
            {tire && (
              <Card className={styles.tireInfoCard}>
                <div className={styles.tireInfoTitle}>
                  🔍 Datos detectados
                  <span className={styles.confidence} style={{color: tire.confianza>=80?'var(--green)':tire.confianza>=60?'var(--yellow)':'var(--red)'}}>
                    {tire.confianza}% confianza
                  </span>
                </div>
                <div className={styles.tireGrid}>
                  {tire.medida && (
                    <div className={styles.tireMedida}>{tire.medida}</div>
                  )}
                  <div className={styles.tireFields}>
                    {tire.marca && <div className={styles.tireField}><span>Marca</span><strong>{tire.marca}</strong></div>}
                    {tire.modelo && <div className={styles.tireField}><span>Modelo</span><strong>{tire.modelo}</strong></div>}
                    {tire.ancho && <div className={styles.tireField}><span>Ancho</span><strong>{tire.ancho}</strong></div>}
                    {tire.perfil && <div className={styles.tireField}><span>Perfil</span><strong>{tire.perfil}</strong></div>}
                    {tire.aro && <div className={styles.tireField}><span>Aro</span><strong>R{tire.aro}</strong></div>}
                    {tire.indice_carga && <div className={styles.tireField}><span>Índice carga</span><strong>{tire.indice_carga}</strong></div>}
                    {tire.indice_velocidad && <div className={styles.tireField}><span>Vel. máx</span><strong>{tire.indice_velocidad}</strong></div>}
                    {tire.runflat && <div className={styles.tireField}><span>Runflat</span><strong>{tire.runflat}</strong></div>}
                    {tire.xl && <div className={styles.tireField}><span>XL</span><strong>Sí</strong></div>}
                    {tire.condicion && <div className={styles.tireField}><span>Condición</span><strong style={{color:tire.condicion==='nuevo'?'var(--green)':tire.condicion==='desgastado'?'var(--red)':'var(--yellow)'}}>{tire.condicion}</strong></div>}
                  </div>
                  {tire.notas && <div className={styles.tireNotas}>💡 {tire.notas}</div>}
                </div>
              </Card>
            )}
          </div>

          {/* Columna derecha — Productos */}
          <div className={styles.rightCol}>
            {!result ? (
              <Card className={styles.emptyProducts}>
                <div className={styles.emptyIcon}>🔍</div>
                <div className={styles.emptyText}>Sube una foto y analiza para ver productos disponibles</div>
              </Card>
            ) : productos.length === 0 ? (
              <Card className={styles.emptyProducts}>
                <div className={styles.emptyIcon}>😔</div>
                <div className={styles.emptyText}>No se encontraron productos para la medida <strong>{tire?.medida}</strong></div>
                <div className={styles.emptySub}>Verifica la medida detectada y busca manualmente en el catálogo</div>
              </Card>
            ) : (
              <>
                {/* Header productos */}
                <div className={styles.productsHeader}>
                  <div className={styles.productsTitle}>
                    {productos.length} productos encontrados para <strong>{tire?.medida}</strong>
                  </div>
                  <div className={styles.cantRow}>
                    <label className={styles.cantLabel}>Cantidad:</label>
                    <input className={styles.cantInput} type="number" min="1" max="8"
                      value={cantidad} onChange={e=>setCantidad(parseInt(e.target.value)||4)}/>
                  </div>
                </div>

                {/* Lista por tier */}
                <div className={styles.productsList}>
                  {['Premium','Conveniencia','Económico'].map(tier => {
                    const items = byTier[tier] || []
                    if (!items.length) return null
                    return (
                      <div key={tier} className={styles.tierSection}>
                        <div className={styles.tierHeader} style={{borderLeftColor:TIER_COLOR[tier]}}>
                          <span className={styles.tierName} style={{color:TIER_COLOR[tier]}}>{tier}</span>
                          <span className={styles.tierCount}>{items.length} opción{items.length!==1?'es':''}</span>
                        </div>
                        {items.map(p => {
                          const precio = Math.round(parseFloat(p.price_normal||0)*1.19)
                          const total  = precio * cantidad
                          const isSel  = selected.includes(p.id)
                          return (
                            <div key={p.id}
                              className={`${styles.productCard} ${isSel?styles.productSelected:''}`}
                              onClick={()=>toggleSelect(p.id)}>
                              <div className={styles.productCheck}>
                                <div className={`${styles.checkBox} ${isSel?styles.checkOn:''}`}>
                                  {isSel && '✓'}
                                </div>
                              </div>
                              {p.photo_url && (
                                <img src={p.photo_url} className={styles.productPhoto} alt=""
                                  onError={e=>e.target.style.display='none'}/>
                              )}
                              <div className={styles.productInfo}>
                                <div className={styles.productBrand}>{p.brand}</div>
                                <div className={styles.productName}>{p.name}</div>
                                <div className={styles.productMedida}>{p.medida}</div>
                                {p.modelo && <div className={styles.productModelo}>{p.modelo}</div>}
                              </div>
                              <div className={styles.productPricing}>
                                <div className={styles.productUnit}>{fmt.currency(precio)}<span>/und</span></div>
                                <div className={styles.productTotal}>{fmt.currency(total)}</div>
                                <div className={styles.productStock} style={{color:p.stock>0?'var(--green)':'var(--red)'}}>
                                  {p.stock>0?`${p.stock} disp.`:'Sin stock'}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                {/* Footer — cotización */}
                {selected.length > 0 && (
                  <Card className={styles.quoteFooter}>
                    <div className={styles.quoteFooterLeft}>
                      <div className={styles.quoteSelected}>{selected.length} producto{selected.length!==1?'s':''} seleccionado{selected.length!==1?'s':''}</div>
                      <div className={styles.quoteSub}>×{cantidad} unidades cada uno</div>
                    </div>
                    <div className={styles.quoteFooterRight}>
                      <div className={styles.quoteTotal}>
                        {fmt.currency(selectedProducts.reduce((s,p)=>s+Math.round(parseFloat(p.price_normal||0)*1.19)*cantidad,0))}
                      </div>
                      <Button onClick={goToQuote}>
                        📄 Generar cotización
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
