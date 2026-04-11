import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Badge, Avatar, Card, Spinner, Empty, Select, Toast } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './LeadDetail.module.css'

const STATUSES   = ['Nuevo','Contactado','Calificado','Propuesta','Negociación','Ganado','Perdido']
const PRIORITIES = ['Alta','Media','Baja']

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [toast, setToast]       = useState('')
  const [noteText, setNoteText] = useState('')
  const [newTask, setNewTask]   = useState('')
  const [activeTab, setActiveTab] = useState('activity')
  const [showAppt, setShowAppt] = useState(false)
  const [apptDate, setApptDate] = useState('')
  const [apptChannel, setApptChannel] = useState('Teléfono')
  const [apptNotes, setApptNotes] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/leads/${id}`),
  })

  const { data: quotes = [], refetch: refetchQuotes } = useQuery({
    queryKey: ['lead-quotes', id],
    queryFn: () => api.get(`/leads/${id}/quotes`),
  })

  const { data: orders = [] } = useQuery({
    queryKey: ['lead-orders', id],
    queryFn: () => api.get(`/leads/${id}/orders`),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['lead', id] })

  const updateStatus = async (status) => {
    await api.patch(`/leads/${id}/status`, { status })
    refresh()
    showToast('Estado actualizado')
  }

  const updatePriority = async (priority) => {
    await api.put(`/leads/${id}`, { ...lead, priority })
    refresh()
    showToast('Prioridad actualizada')
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    await api.post(`/leads/${id}/notes`, { content: noteText })
    await api.post(`/leads/${id}/activities`, {
      type: 'Note', content: noteText, channel: lead?.channel || 'Web', direction: 'outbound'
    })
    setNoteText('')
    refresh()
    showToast('Nota guardada')
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    await api.post(`/leads/${id}/tasks`, { title: newTask })
    setNewTask('')
    refresh()
    showToast('Tarea creada')
  }

  const completeTask = async (taskId) => {
    await api.patch(`/tasks/${taskId}/complete`, {})
    refresh()
  }

  const saveAppt = async () => {
    if (!apptDate) return
    await api.post(`/leads/${id}/appointments`, {
      scheduled_at: apptDate, channel: apptChannel, notes: apptNotes
    })
    setShowAppt(false)
    setApptDate('')
    setApptNotes('')
    refresh()
    showToast('Cita agendada')
  }

  if (isLoading) return (
    <div className={styles.page}>
      <Header actions={<Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>← Volver</Button>} />
      <div className={styles.loading}><Spinner size="lg" /></div>
    </div>
  )

  if (!lead) return (
    <div className={styles.page}>
      <Header actions={<Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>← Volver</Button>} />
      <div className={styles.loading}>Lead no encontrado</div>
    </div>
  )

  const activities   = Array.isArray(lead.activities)   ? lead.activities   : []
  const tasks        = Array.isArray(lead.tasks)        ? lead.tasks        : []
  const appointments = Array.isArray(lead.appointments) ? lead.appointments : []
  const notes        = Array.isArray(lead.lead_notes)   ? lead.lead_notes   : []

  const TABS = [
    { id: 'activity', label: 'Actividad',    count: activities.length },
    { id: 'tasks',    label: 'Tareas',       count: tasks.filter(t => !t.completed).length },
    { id: 'appts',    label: 'Citas',        count: appointments.length },
    { id: 'notes',    label: 'Notas',        count: notes.length },
    { id: 'quotes',   label: 'Cotizaciones', count: quotes.length },
    { id: 'orders',   label: 'Órdenes',       count: orders.length },
  ]

  return (
    <div className={styles.page}>
      <Header actions={<Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>← Volver</Button>} />

      <div className={styles.content}>
        {/* Sidebar izquierdo */}
        <div className={styles.sidebar}>
          <Card className={styles.profileCard}>
            <Avatar name={lead.name || '?'} size="xl" />
            <h2 className={styles.leadName}>{lead.name || ''}</h2>
            {lead.company && <div className={styles.company}>🏢 {lead.company}</div>}
            <div className={styles.tags}>
              {lead.channel  && <Badge label={lead.channel} />}
              {lead.status   && <Badge label={lead.status} dot />}
              {lead.priority && <Badge label={lead.priority} />}
            </div>
            <div className={styles.contacts}>
              {lead.email && <div className={styles.contact}><span>✉️</span><span>{lead.email}</span></div>}
              {lead.phone && <div className={styles.contact}><span>📞</span><span>{lead.phone}</span></div>}
              {lead.agent && <div className={styles.contact}><span>🤖</span><span>{lead.agent}</span></div>}
            </div>
            <div className={styles.valueBlock}>
              <div className={styles.valueLabel}>Valor estimado</div>
              <div className={styles.valueAmount}>{fmt.currency(lead.estimated_value)}</div>
            </div>
            {lead.notes && (
              <div className={styles.notesBlock}>
                <div className={styles.valueLabel}>Notas</div>
                <div className={styles.notesText}>{lead.notes}</div>
              </div>
            )}
          </Card>

          <Card className={styles.actionsCard}>
            <Select label="Estado" value={lead.status || 'Nuevo'} onChange={e => updateStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select label="Prioridad" value={lead.priority || 'Media'} onChange={e => updatePriority(e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Card>
        </div>

        {/* Panel derecho */}
        <div className={styles.main}>
          <div className={styles.tabs}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.count > 0 && <span className={styles.tabCount}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* ACTIVIDAD */}
          {activeTab === 'activity' && (
            <Card className={styles.tabContent}>
              <div className={styles.noteForm}>
                <textarea
                  className={styles.noteInput}
                  placeholder="Escribe una actividad o comentario..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
                <Button size="sm" onClick={addNote} disabled={!noteText.trim()}>Guardar</Button>
              </div>
              {activities.length > 0 ? activities.map(a => (
                <div key={a.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>{a.direction === 'inbound' ? '💬' : '↩️'}</div>
                  <div className={styles.activityBody}>
                    <div className={styles.activityMeta}>
                      <span className={styles.activityType}>{a.type || 'Mensaje'}</span>
                      {a.channel && <Badge label={a.channel} />}
                      <span className={styles.activityTime}>{fmt.dateTime(a.created_at)}</span>
                    </div>
                    <div className={styles.activityContent}>{a.content || ''}</div>
                  </div>
                </div>
              )) : <Empty icon="💬" title="Sin actividad" />}
            </Card>
          )}

          {/* TAREAS */}
          {activeTab === 'tasks' && (
            <Card className={styles.tabContent}>
              <div className={styles.addRow}>
                <input
                  className={styles.addInput}
                  placeholder="Nueva tarea..."
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                />
                <Button size="sm" variant="ghost" onClick={addTask}>Agregar</Button>
              </div>
              {tasks.length > 0 ? tasks.map(t => (
                <div key={t.id} className={styles.taskItem}>
                  <div
                    className={`${styles.taskCheck} ${t.completed ? styles.taskDone : ''}`}
                    onClick={() => !t.completed && completeTask(t.id)}
                  >
                    {t.completed ? '✓' : ''}
                  </div>
                  <span className={t.completed ? styles.taskDoneText : ''}>{t.title || ''}</span>
                </div>
              )) : <Empty icon="✅" title="Sin tareas" />}
            </Card>
          )}

          {/* CITAS */}
          {activeTab === 'appts' && (
            <Card className={styles.tabContent}>
              <div className={styles.sectionHeader}>
                <Button size="sm" variant="ghost" onClick={() => setShowAppt(v => !v)}>
                  {showAppt ? 'Cancelar' : '+ Agendar cita'}
                </Button>
              </div>
              {showAppt && (
                <div className={styles.apptForm}>
                  <input className={styles.addInput} type="datetime-local" value={apptDate} onChange={e => setApptDate(e.target.value)} />
                  <select className={styles.addInput} value={apptChannel} onChange={e => setApptChannel(e.target.value)}>
                    {['WhatsApp','Teléfono','Email','Chat','Facebook','Instagram'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <textarea className={styles.addInput} placeholder="Notas (opcional)" value={apptNotes}
                    onChange={e => setApptNotes(e.target.value)} style={{ minHeight: 60 }} />
                  <Button size="sm" onClick={saveAppt} disabled={!apptDate}>Guardar cita</Button>
                </div>
              )}
              {appointments.length > 0 ? appointments.map(a => (
                <div key={a.id} className={styles.apptItem}>
                  <span>📅</span>
                  <div>
                    <div className={styles.apptDate}>{fmt.dateTime(a.scheduled_at)}</div>
                    <div className={styles.apptMeta}>{a.channel || ''}{a.notes ? ` · ${a.notes}` : ''}</div>
                  </div>
                  <Badge label={a.status || 'pending'} />
                </div>
              )) : <Empty icon="📅" title="Sin citas" />}
            </Card>
          )}

          {/* NOTAS */}
          {activeTab === 'notes' && (
            <Card className={styles.tabContent}>
              <div className={styles.noteForm}>
                <textarea
                  className={styles.noteInput}
                  placeholder="Escribe una nota..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
                <Button size="sm" onClick={addNote} disabled={!noteText.trim()}>Guardar</Button>
              </div>
              {notes.length > 0 ? notes.map(n => (
                <div key={n.id} className={styles.noteItem}>
                  <div className={styles.noteText}>{n.content || ''}</div>
                  <div className={styles.noteTime}>{fmt.timeAgo(n.created_at)}</div>
                </div>
              )) : <Empty icon="📝" title="Sin notas" />}
            </Card>
          )}

          {/* ÓRDENES */}
          {activeTab === 'orders' && (
            <Card className={styles.tabContent}>
              {orders.length === 0 ? (
                <Empty icon="📦" title="Sin órdenes" subtitle="Las órdenes del agente aparecerán aquí" />
              ) : orders.map(o => (
                <div key={o.id} className={styles.orderCard}>
                  <div className={styles.orderHeader}>
                    <span className={styles.orderNum}>{o.nro_orden}</span>
                    <span className={styles.orderStatus}>{o.status}</span>
                    <span className={styles.orderDate}>{fmt.dateTime(o.created_at)}</span>
                  </div>
                  <div className={styles.orderGrid}>
                    {o.marca    && <div className={styles.orderField}><span>🏷️ Producto</span><strong>{o.marca} {o.modelo}</strong></div>}
                    {o.medida   && <div className={styles.orderField}><span>📐 Medida</span><strong>{o.medida}</strong></div>}
                    {o.cantidad && <div className={styles.orderField}><span>🔢 Cantidad</span><strong>{o.cantidad} unidad(es)</strong></div>}
                    {o.precio_unitario && <div className={styles.orderField}><span>💵 Precio unit.</span><strong>{fmt.currency(o.precio_unitario)}</strong></div>}
                    {o.total    && <div className={styles.orderField}><span>💰 Total</span><strong className={styles.orderTotal}>{fmt.currency(o.total)}</strong></div>}
                    {o.tipo_servicio && <div className={styles.orderField}><span>🚚 Servicio</span><strong>{o.tipo_servicio}</strong></div>}
                    {o.comuna   && <div className={styles.orderField}><span>📍 Comuna</span><strong>{o.comuna}</strong></div>}
                    {o.fecha_entrega && <div className={styles.orderField}><span>📅 Fecha</span><strong>{o.fecha_entrega}</strong></div>}
                    {o.direccion && <div className={styles.orderField}><span>🏠 Dirección</span><strong>{o.direccion}</strong></div>}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* COTIZACIONES */}
          {activeTab === 'quotes' && (
            <Card className={styles.tabContent}>
              <div className={styles.sectionHeader}>
                <Button size="sm" onClick={() => navigate(`/quotes?lead=${id}`)}>+ Nueva cotización</Button>
              </div>
              {quotes.length > 0 ? quotes.map(q => (
                <div key={q.id} className={styles.quoteCard}>
                  <div className={styles.quoteCardTop}>
                    <span className={styles.quoteNum}>{q.quote_number || ''}</span>
                    <Badge label={q.status || 'borrador'} />
                  </div>
                  <div className={styles.quoteCardBot}>
                    <span className={styles.quoteDate}>{fmt.timeAgo(q.created_at)}</span>
                    <span className={styles.quoteTotal}>{fmt.currency(q.total)}</span>
                  </div>
                  <div className={styles.quoteBreak}>
                    <span>Neto: {fmt.currency(q.subtotal)}</span>
                    <span>IVA ({q.iva_rate || 19}%): {fmt.currency(q.iva_amount)}</span>
                  </div>
                </div>
              )) : <Empty icon="📋" title="Sin cotizaciones" subtitle="Ve a Cotizaciones para crear una" />}
            </Card>
          )}
        </div>
      </div>

      {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}
    </div>
  )
}
