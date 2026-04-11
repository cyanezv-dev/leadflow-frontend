import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Badge, Spinner, Empty, Toast } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './QuoteDetail.module.css'

const STATUS_LABELS = {
  borrador:  { label: 'Borrador',  color: '#888780' },
  enviada:   { label: 'Enviada',   color: '#60a5fa' },
  aceptada:  { label: 'Aceptada',  color: '#34d399' },
  rechazada: { label: 'Rechazada', color: '#f87171' },
  vencida:   { label: 'Vencida',   color: '#fbbf24' },
}

export default function QuoteDetail({ quoteId, onClose }) {
  const queryClient = useQueryClient()
  const [toast, setToast] = useState(null)
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => api.get(`/quotes/${quoteId}`),
  })

  const changeStatus = async (status) => {
    await api.patch(`/quotes/${quoteId}/status`, { status })
    queryClient.invalidateQueries(['quote', quoteId])
    queryClient.invalidateQueries(['quotes'])
    showToast(`Estado: ${status}`)
  }

  if (isLoading) return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}><Spinner size="lg" /></div>
    </div>
  )

  if (!quote) return null

  const st = STATUS_LABELS[quote.status] || STATUS_LABELS.borrador

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.quoteNum}>{quote.quote_number}</div>
            <div className={styles.lead}>{quote.lead?.name} {quote.lead?.company && `— ${quote.lead.company}`}</div>
          </div>
          <div className={styles.headerRight}>
            <select className={styles.statusSel} value={quote.status}
              onChange={e => changeStatus(e.target.value)}
              style={{ borderColor: st.color + '60', color: st.color }}>
              {Object.entries(STATUS_LABELS).map(([k,v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Meta */}
        <div className={styles.meta}>
          {quote.valid_until && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Válida hasta</span>
              <span className={styles.metaVal}>{fmt.date(quote.valid_until)}</span>
            </div>
          )}
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Creada</span>
            <span className={styles.metaVal}>{fmt.dateTime(quote.created_at)}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>IVA</span>
            <span className={styles.metaVal}>{quote.iva_rate}%</span>
          </div>
        </div>

        {/* Items */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Producto</th>
                <th>Descripción</th>
                <th style={{textAlign:'right'}}>Cant.</th>
                <th style={{textAlign:'right'}}>Precio Unit. Neto</th>
                <th style={{textAlign:'right'}}>Subtotal Neto</th>
              </tr>
            </thead>
            <tbody>
              {(quote.items || []).length === 0 ? (
                <tr><td colSpan="6"><Empty icon="📦" title="Sin productos" /></td></tr>
              ) : (quote.items || []).map((item, i) => (
                <tr key={item.id} className={styles.itemRow}>
                  <td className={styles.itemNum}>{i + 1}</td>
                  <td className={styles.itemName}>{item.product}</td>
                  <td className={styles.itemDesc}>{item.description || '—'}</td>
                  <td className={styles.itemNum} style={{textAlign:'right'}}>{item.quantity}</td>
                  <td className={styles.money}>{fmt.currency(item.unit_price)}</td>
                  <td className={styles.money}>{fmt.currency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total Neto</span>
            <span className={styles.totalVal}>{fmt.currency(quote.subtotal)}</span>
          </div>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>IVA ({quote.iva_rate}%)</span>
            <span className={styles.totalVal} style={{color:'var(--text3)'}}>{fmt.currency(quote.iva_amount)}</span>
          </div>
          <div className={`${styles.totalRow} ${styles.totalFinal}`}>
            <span>Total con IVA</span>
            <span>{fmt.currency(quote.total)}</span>
          </div>
        </div>

        {/* Notas */}
        {quote.notes && (
          <div className={styles.notes}>
            <div className={styles.notesLabel}>Notas / Condiciones</div>
            <div className={styles.notesText}>{quote.notes}</div>
          </div>
        )}

        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <a href={"/api/quotes/" + quoteId + "/pdf"} target="_blank" rel="noopener noreferrer" className={styles.pdfBtn}>
            📄 Descargar PDF
          </a>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
