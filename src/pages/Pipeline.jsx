import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { Badge, Avatar, Button, Spinner } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './Pipeline.module.css'

const STAGE_COLORS = {
  Nuevo:       '#60a5fa',
  Contactado:  '#818cf8',
  Calificado:  '#a78bfa',
  Propuesta:   '#fb923c',
  Negociación: '#fbbf24',
  Ganado:      '#34d399',
  Perdido:     '#f87171',
}

const VISIBLE_STAGES = ['Nuevo','Contactado','Calificado','Propuesta','Negociación']

export default function Pipeline() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sortByValue, setSortByValue] = useState(false)

  const { data: pipeline = {}, isLoading } = useQuery({
    queryKey: ['pipeline'],
    queryFn: () => api.get('/pipeline'),
    refetchInterval: 15000,
  })

  const moveStage = async (leadId, newStatus) => {
    await api.patch(`/leads/${leadId}/status`, { status: newStatus })
    queryClient.invalidateQueries(['pipeline'])
  }

  return (
    <div className={styles.page}>
      <Header
        actions={
          <div className={styles.headerActions}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortByValue(v => !v)}
            >
              ↕ {sortByValue ? 'Por fecha' : 'Por valor'}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className={styles.loading}><Spinner size="lg" /></div>
      ) : (
        <div className={styles.board}>
          {VISIBLE_STAGES.map(stage => {
            const col = pipeline[stage] || { leads: [], total: 0, count: 0 }
            let leads = [...(col.leads || [])]
            if (sortByValue) leads.sort((a, b) => b.estimated_value - a.estimated_value)
            const color = STAGE_COLORS[stage]

            return (
              <div key={stage} className={styles.column}>
                {/* Column header */}
                <div className={styles.colHeader}>
                  <div className={styles.colDot} style={{ background: color }} />
                  <span className={styles.colTitle}>{stage}</span>
                  <span className={styles.colCount}>{col.count || 0}</span>
                  <span className={styles.colValueBig}>{fmt.currency(col.total || 0)}</span>
                </div>

                {/* Cards */}
                <div className={styles.cards}>
                  {leads.map(lead => (
                    <div
                      key={lead.id}
                      className={styles.card}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <div className={styles.cardTop}>
                        <Avatar name={lead.name} size="xs" />
                        <div className={styles.cardInfo}>
                          <div className={styles.cardName}>{lead.name}</div>
                          <div className={styles.cardCompany}>{lead.company}</div>
                        </div>
                      </div>

                      <div className={styles.cardBottom}>
                        <Badge label={lead.channel} />
                        <span className={styles.cardValue}>{fmt.currency(lead.estimated_value)}</span>
                      </div>

                      <select
                        className={styles.moveSelect}
                        value={lead.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => moveStage(lead.id, e.target.value)}
                      >
                        {[...VISIBLE_STAGES, 'Ganado', 'Perdido'].map(s =>
                          <option key={s} value={s}>{s}</option>
                        )}
                      </select>
                    </div>
                  ))}

                  {leads.length === 0 && (
                    <div className={styles.emptyCol}>Sin leads</div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Ganado / Perdido summary columns */}
          {['Ganado', 'Perdido'].map(stage => {
            const col = pipeline[stage] || { leads: [], total: 0, count: 0 }
            const color = STAGE_COLORS[stage]
            return (
              <div key={stage} className={`${styles.column} ${styles.closedCol}`}>
                <div className={styles.colHeader}>
                  <div className={styles.colDot} style={{ background: color }} />
                  <span className={styles.colTitle}>{stage}</span>
                  <span className={styles.colCount}>{col.count || 0}</span>
                </div>
                <div className={styles.closedValue} style={{ color }}>
                  {fmt.currency(col.total || 0)}
                </div>
                <div className={styles.cards}>
                  {(col.leads || []).slice(0, 3).map(lead => (
                    <div
                      key={lead.id}
                      className={`${styles.card} ${styles.closedCard}`}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <div className={styles.cardTop}>
                        <Avatar name={lead.name} size="xs" />
                        <div className={styles.cardInfo}>
                          <div className={styles.cardName}>{lead.name}</div>
                          <div className={styles.cardCompany}>{lead.company}</div>
                        </div>
                        <span className={styles.cardValue}>{fmt.currency(lead.estimated_value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
