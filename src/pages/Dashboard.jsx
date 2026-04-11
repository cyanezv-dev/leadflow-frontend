import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Header from '@/components/layout/Header'
import { StatCard, Card, Badge, Avatar, Spinner, Empty } from '@/components/ui'
import { fmt, CHANNEL_COLORS, STATUS_COLORS } from '@/utils/format'
import api from '@/utils/api'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard'),
    refetchInterval: 30000,
  })

  if (isLoading) return (
    <div className={styles.loadingPage}>
      <Spinner size="lg" />
    </div>
  )

  const stats = [
    { label: 'Total Leads',  value: data?.totalLeads || 0,         icon: '👥', color: '#4f7cff' },
    { label: 'Nuevos',       value: data?.newLeads   || 0,         icon: '✨', color: '#34d399' },
    { label: 'Ganados',      value: data?.wonLeads   || 0,         icon: '🏆', color: '#fbbf24' },
    { label: 'Valor Total',  value: fmt.currency(data?.totalValue), icon: '💰', color: '#a78bfa', isString: true },
  ]

  const channelData = (data?.byChannel || []).map(c => ({
    name: c.channel,
    value: parseInt(c.count),
    color: CHANNEL_COLORS[c.channel] || '#4f7cff',
  }))

  return (
    <div className={styles.page}>
      <Header />

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsGrid}>
          {stats.map(s => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              icon={s.icon}
              color={s.color}
            />
          ))}
        </div>

        {/* Grid principal */}
        <div className={styles.mainGrid}>
          {/* Leads recientes */}
          <Card className={styles.recentCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Leads recientes</h3>
              <button className={styles.linkBtn} onClick={() => navigate('/leads')}>
                Ver todos →
              </button>
            </div>
            <div className={styles.leadList}>
              {(data?.recentLeads || []).map(lead => (
                <div
                  key={lead.id}
                  className={styles.leadRow}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <Avatar name={lead.name} size="sm" />
                  <div className={styles.leadInfo}>
                    <div className={styles.leadName}>{lead.name}</div>
                    <div className={styles.leadCompany}>{lead.company}</div>
                  </div>
                  <div className={styles.leadRight}>
                    <Badge label={lead.channel} />
                    <Badge label={lead.status} />
                  </div>
                </div>
              ))}
              {(!data?.recentLeads?.length) && <Empty icon="👤" title="Sin leads aún" />}
            </div>
          </Card>

          {/* Canal chart */}
          <Card className={styles.channelCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Leads por canal</h3>
            </div>

            <div className={styles.donutWrap}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {channelData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8 }}
                    itemStyle={{ color: 'var(--text)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.channelList}>
              {channelData.map(ch => (
                <div key={ch.name} className={styles.channelRow}>
                  <span className={styles.channelDot} style={{ background: ch.color }} />
                  <span className={styles.channelName}>{ch.name}</span>
                  <div className={styles.channelBarWrap}>
                    <div
                      className={styles.channelBar}
                      style={{
                        width: `${(ch.value / Math.max(...channelData.map(c => c.value), 1)) * 100}%`,
                        background: ch.color
                      }}
                    />
                  </div>
                  <span className={styles.channelCount}>{ch.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Pipeline resumen */}
        <Card>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Resumen del pipeline</h3>
            <button className={styles.linkBtn} onClick={() => navigate('/pipeline')}>
              Ver pipeline →
            </button>
          </div>
          <div className={styles.pipelineStrip}>
            {Object.entries(STATUS_COLORS)
              .filter(([s]) => !['Ganado','Perdido'].includes(s))
              .map(([status, color]) => {
                const count = data?.recentLeads?.filter(l => l.status === status).length || 0
                return (
                  <div key={status} className={styles.stageChip}>
                    <div className={styles.stageBar} style={{ background: color + '25', borderColor: color + '40' }}>
                      <span className={styles.stageDot} style={{ background: color }} />
                      <span className={styles.stageName}>{status}</span>
                      <span className={styles.stageCount} style={{ color }}>{count}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </Card>
      </div>
    </div>
  )
}
