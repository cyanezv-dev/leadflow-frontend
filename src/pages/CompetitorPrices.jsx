import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Toast } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './CompetitorPrices.module.css'

const COMPETITORS = [
  'Supermercado del Neumático',
  'ChileNeumatico',
  'Copec',
  'Dacsa',
  'León',
  'Llantas del Pacífico',
]

const COMP_SHORT = {
  'Supermercado del Neumático': 'Superm.',
  'ChileNeumatico':             'ChileNeu.',
  'Copec':                      'Copec',
  'Dacsa':                      'Dacsa',
  'León':                       'León',
  'Llantas del Pacífico':       'LlantasPac.',
}

function PriceCell({ data, ourPrice }) {
  if (!data) return <span className={styles.noData}>—</span>
  if (!data.price) return <a href={data.url} target="_blank" rel="noreferrer" className={styles.noPrice}>🔗</a>

  const diff = ourPrice ? ((data.price - ourPrice) / ourPrice) * 100 : null
  const color = diff === null ? '' : diff < -5 ? styles.cheaper : diff > 5 ? styles.expensive : styles.similar

  return (
    <div className={styles.priceCell}>
      <a href={data.url} target="_blank" rel="noreferrer" className={`${styles.price} ${color}`}>
        {fmt.currency(data.price)}
      </a>
      {diff !== null && (
        <span className={`${styles.diff} ${color}`}>
          {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
        </span>
      )}
    </div>
  )
}

function ScrapingStatus({ scrapedAt }) {
  if (!scrapedAt) return <span className={styles.neverScraped}>Sin datos</span>
  const mins = Math.round((Date.now() - new Date(scrapedAt)) / 60000)
  const label = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins/60)}h` : `${Math.round(mins/1440)}d`
  const fresh = mins < 60
  return <span className={`${styles.scrapedAt} ${fresh ? styles.fresh : styles.stale}`}>{label}</span>
}

export default function CompetitorPrices() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [scrapingId, setScrapingId] = useState(null)
  const [toast, setToast] = useState('')
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000) }
  const LIMIT = 25

  const { data = {}, isLoading } = useQuery({
    queryKey: ['competitor-prices', search, page],
    queryFn: () => api.get(`/competitor-prices?search=${encodeURIComponent(search)}&page=${page}&limit=${LIMIT}`),
    keepPreviousData: true,
  })

  const { products = [], total = 0, competitors = COMPETITORS } = data
  const totalPages = Math.ceil(total / LIMIT)

  const handleSearch = useCallback((e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }, [searchInput])

  const scrapeOne = async (productId) => {
    setScrapingId(productId)
    try {
      const res = await api.post(`/competitor-prices/scrape/${productId}`, {})
      showToast(`✅ Precios actualizados (${res.results?.filter(r => r.price)?.length || 0} encontrados)`)
      queryClient.invalidateQueries(['competitor-prices'])
    } catch (e) {
      showToast('❌ Error al scrapear: ' + e.message)
    } finally {
      setScrapingId(null)
    }
  }

  const [batchScraping, setBatchScraping] = useState(false)
  const scrapeVisible = async () => {
    if (!products.length) return
    setBatchScraping(true)
    try {
      const ids = products.slice(0, 10).map(p => p.id)
      const res = await api.post('/competitor-prices/scrape-batch', { product_ids: ids })
      showToast(`✅ ${res.scraped} productos actualizados`)
      queryClient.invalidateQueries(['competitor-prices'])
    } catch (e) {
      showToast('❌ Error: ' + e.message)
    } finally {
      setBatchScraping(false)
    }
  }

  // Determine oldest scraped_at per product across all competitors
  const getLastScraped = (competitorPrices) => {
    const dates = Object.values(competitorPrices).map(v => v?.scraped_at).filter(Boolean)
    if (!dates.length) return null
    return dates.sort().at(-1)
  }

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.content}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                placeholder="Buscar por nombre, marca o medida..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit">Buscar</Button>
            {search && (
              <Button variant="ghost" onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}>
                Limpiar
              </Button>
            )}
          </form>
          <div className={styles.toolbarRight}>
            <span className={styles.totalCount}>{total.toLocaleString()} productos</span>
            <Button variant="ghost" size="sm" onClick={scrapeVisible} loading={batchScraping} disabled={!products.length}>
              🔄 Actualizar visibles
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          <span className={`${styles.legendDot} ${styles.cheaper}`}></span><span>Más barato que nosotros</span>
          <span className={`${styles.legendDot} ${styles.similar}`}></span><span>Similar (±5%)</span>
          <span className={`${styles.legendDot} ${styles.expensive}`}></span><span>Más caro que nosotros</span>
        </div>

        {/* Table */}
        <Card className={styles.tableCard}>
          {isLoading ? (
            <div className={styles.loading}><Spinner /> Cargando productos...</div>
          ) : products.length === 0 ? (
            <div className={styles.empty}>No se encontraron productos{search ? ` para "${search}"` : ''}</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thProduct}>Producto</th>
                    <th className={styles.thOur}>Nuestro precio</th>
                    {COMPETITORS.map(c => (
                      <th key={c} className={styles.thComp} title={c}>{COMP_SHORT[c]}</th>
                    ))}
                    <th className={styles.thActions}>Actualizar</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const ourPrice = p.price_normal ? Math.round(parseFloat(p.price_normal) * 1.19) : null
                    const lastScraped = getLastScraped(p.competitor_prices)
                    return (
                      <tr key={p.id} className={styles.row}>
                        <td className={styles.tdProduct}>
                          <div className={styles.productInfo}>
                            {p.photo_url && (
                              <img src={p.photo_url} className={styles.productThumb} alt="" onError={e => e.target.style.display = 'none'} />
                            )}
                            <div className={styles.productText}>
                              <div className={styles.productName}>{p.name}</div>
                              <div className={styles.productMeta}>
                                {p.brand && <span className={styles.brand}>{p.brand}</span>}
                                {p.medida && <span className={styles.medida}>{p.medida}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={styles.tdOur}>
                          {ourPrice ? (
                            <div className={styles.ourPrice}>
                              <span className={styles.ourPriceVal}>{fmt.currency(ourPrice)}</span>
                              <span className={styles.ourPriceNote}>c/IVA</span>
                            </div>
                          ) : <span className={styles.noData}>—</span>}
                        </td>
                        {COMPETITORS.map(c => (
                          <td key={c} className={styles.tdComp}>
                            <PriceCell data={p.competitor_prices[c]} ourPrice={ourPrice} />
                          </td>
                        ))}
                        <td className={styles.tdActions}>
                          <div className={styles.actionsCell}>
                            <ScrapingStatus scrapedAt={lastScraped} />
                            <button
                              className={styles.scrapeBtn}
                              onClick={() => scrapeOne(p.id)}
                              disabled={scrapingId === p.id}
                              title="Actualizar precios de competencia"
                            >
                              {scrapingId === p.id ? '⏳' : '🔄'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6))
              const n = start + i
              if (n > totalPages) return null
              return (
                <button key={n} className={`${styles.pageBtn} ${page === n ? styles.pageBtnActive : ''}`} onClick={() => setPage(n)}>
                  {n}
                </button>
              )
            })}
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
            <button className={styles.pageBtn} onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
            <span className={styles.pageInfo}>Página {page} de {totalPages} · {total.toLocaleString()} productos</span>
          </div>
        )}
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
