import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast } from '@/components/ui'
import api from '@/utils/api'
import styles from './CatalogNormalize.module.css'

const FIELDS = [
  { key: 'familia',          label: 'Familia' },
  { key: 'modelo_neumatico', label: 'Modelo' },
  { key: 'tipo_uso',         label: 'Tipo de uso' },
  { key: 'tier',             label: 'Tier' },
]

export default function CatalogNormalize() {
  const [fieldKey, setFieldKey]   = useState('modelo_neumatico')
  const [brand, setBrand]         = useState('')
  const [viewMode, setViewMode]   = useState('brand')
  const [toast, setToast]         = useState('')
  const [merging, setMerging]     = useState({})
  const [caseMode, setCaseMode]   = useState('initcap')
  const [applyingCase, setApplyingCase] = useState(false)
  const [canonical, setCanonical] = useState({})
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const { data: filterOptions={} } = useQuery({
    queryKey: ['catalog-filter-options'],
    queryFn: () => api.get('/catalog/filter-options'),
  })

  const { data: duplicates=[], isLoading, refetch } = useQuery({
    queryKey: ['catalog-duplicates', fieldKey, brand, viewMode],
    queryFn: () => api.get('/catalog/normalize/duplicates?field_key=' + fieldKey + (viewMode==='brand' && brand ? '&brand=' + brand : '')),
    enabled: viewMode === 'all' || !!brand,
  })

  const getCanonical = (key, variants) => canonical[key] || variants[0]

  const merge = async (key, variants, itemBrand) => {
    const c = getCanonical(key, variants)
    setMerging(m => ({...m, [key]: true}))
    try {
      await api.post('/catalog/normalize/merge', {
        field_key: fieldKey, canonical: c, variants,
        brand: itemBrand || brand || null
      })
      refetch()
      showToast(variants.length + ' variantes -> "' + c + '"')
    } finally { setMerging(m => ({...m, [key]: false})) }
  }

  const mergeAll = async () => {
    if (!confirm('Fusionar todos los ' + duplicates.length + ' grupos?')) return
    for (const d of duplicates) {
      const key = d.normalized + (d.brand||'')
      await api.post('/catalog/normalize/merge', {
        field_key: fieldKey,
        canonical: getCanonical(key, d.variants),
        variants: d.variants,
        brand: d.brand || brand || null
      })
    }
    refetch()
    showToast('Todos los grupos fusionados')
  }

  const applyCase = async () => {
    if (!confirm('Aplicar formato ' + caseMode + '?')) return
    setApplyingCase(true)
    try {
      const res = await api.post('/catalog/normalize/case', { field_key: fieldKey, brand: brand||null, mode: caseMode })
      refetch()
      showToast('Formato aplicado a ' + res.updated + ' productos')
    } finally { setApplyingCase(false) }
  }

  const DupCard = ({ d, itemBrand }) => {
    const key = d.normalized + (itemBrand||'')
    const c   = getCanonical(key, d.variants)
    return (
      <Card className={styles.dupCard}>
        <div className={styles.dupHeader}>
          <div className={styles.dupInfo}>
            <span className={styles.dupCount}>{d.variant_count} variantes</span>
            <span className={styles.dupProducts}>{d.product_count} productos</span>
          </div>
          <Button size="sm" onClick={()=>merge(key, d.variants, itemBrand)} loading={!!merging[key]}>
            Fusionar → "{c}"
          </Button>
        </div>
        <div className={styles.dupVariants}>
          {d.variants.map(v => (
            <div key={v} className={styles.dupVariant + ' ' + (v===c ? styles.dupCanonical : '')}
              onClick={()=>setCanonical(p=>({...p,[key]:v}))}>
              <input type="radio" name={key} checked={v===c} readOnly/>
              <span className={styles.dupValue}>{v}</span>
              {v===c && <span className={styles.canonicalBadge}>✓ oficial</span>}
            </div>
          ))}
        </div>
        <div className={styles.dupFooter}>
          <code className={styles.dupNorm}>{d.normalized}</code>
          <span className={styles.dupHint}>Click en variante para elegir nombre oficial</span>
        </div>
      </Card>
    )
  }

  // Group duplicates by brand for 'all' mode
  const byBrand = {}
  if (viewMode === 'all') {
    duplicates.forEach(d => {
      const b = d.brand || 'Sin marca'
      if (!byBrand[b]) byBrand[b] = []
      byBrand[b].push(d)
    })
  }

  return (
    <div className={styles.page}>
      <Header/>
      <div className={styles.content}>

        {/* Controls */}
        <Card className={styles.controlsCard}>
          <div className={styles.controlsTitle}>🔧 Normalización de catálogo</div>
          <div className={styles.controlsRow}>
            <div className={styles.controlField}>
              <label>Campo</label>
              <select className={styles.select} value={fieldKey} onChange={e=>setFieldKey(e.target.value)}>
                {FIELDS.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            <div className={styles.controlField}>
              <label>Marca</label>
              <select className={styles.select} value={brand} onChange={e=>setBrand(e.target.value)}>
                <option value="">Todas</option>
                {(filterOptions.brands||[]).map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className={styles.controlField}>
              <label>Formato</label>
              <div className={styles.caseRow}>
                <select className={styles.select} value={caseMode} onChange={e=>setCaseMode(e.target.value)}>
                  <option value="initcap">Initcap</option>
                  <option value="upper">MAYÚSCULAS</option>
                  <option value="lower">minúsculas</option>
                </select>
                <Button size="sm" variant="ghost" onClick={applyCase} loading={applyingCase}>Aplicar</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* View toggle */}
        <div className={styles.viewToggle}>
          <button className={styles.viewBtn + ' ' + (viewMode==='brand'?styles.viewBtnActive:'')} onClick={()=>setViewMode('brand')}>
            🏷️ Por marca
          </button>
          <button className={styles.viewBtn + ' ' + (viewMode==='all'?styles.viewBtnActive:'')} onClick={()=>setViewMode('all')}>
            📋 Todas las marcas
          </button>
        </div>

        {/* Summary */}
        {duplicates.length > 0 && (
          <div className={styles.summaryBar}>
            <div className={styles.summaryText}>
              <strong>{duplicates.length}</strong> grupos duplicados — {duplicates.reduce((s,d)=>s+parseInt(d.product_count),0)} productos afectados
            </div>
            <Button size="sm" onClick={mergeAll}>⚡ Fusionar todos</Button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className={styles.loading}><Spinner/></div>
        ) : (viewMode==='brand' && !brand) ? (
          <Empty icon="🏷️" title="Selecciona una marca" subtitle="Elige una marca para analizar sus duplicados"/>
        ) : duplicates.length === 0 ? (
          <Empty icon="✅" title="Sin duplicados" subtitle={'Campo "' + fieldKey + '" normalizado' + (brand?' para '+brand:'')}/>
        ) : viewMode === 'all' ? (
          <div className={styles.duplicatesList}>
            {Object.entries(byBrand).map(([b, items]) => (
              <div key={b} className={styles.brandSection}>
                <div className={styles.brandSectionTitle}>
                  🏷️ {b} <span className={styles.brandSectionCount}>{items.length} grupos</span>
                </div>
                {items.map(d => <DupCard key={d.normalized+b} d={d} itemBrand={b}/>)}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.duplicatesList}>
            {duplicates.map(d => <DupCard key={d.normalized+(d.brand||'')} d={d} itemBrand={brand}/>)}
          </div>
        )}
      </div>
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
