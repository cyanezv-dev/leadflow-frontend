import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { Button, Badge, Avatar, Card, Spinner, Empty, Modal, Input, Select } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './Leads.module.css'

const STATUSES = ['Nuevo','Contactado','Calificado','Propuesta','Negociación','Ganado','Perdido']
const CHANNELS = ['WhatsApp','Facebook','Instagram','Chat','Teléfono','Web','Email']

function NewLeadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name:'', last_name:'', company:'', email:'', phone:'',
    channel:'Web', status:'Nuevo', priority:'Media',
    estimated_value:'', notes:''
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const submit = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const full_name = form.last_name ? `${form.name} ${form.last_name}` : form.name
      const lead = await api.post('/leads', {
        ...form,
        name: full_name,
        estimated_value: parseFloat(form.estimated_value)||0
      })
      onCreated(lead)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Nuevo Lead" onClose={onClose} width={560}>
      <div className={styles.modalGrid}>
        <Input label="Nombre *" placeholder="María" value={form.name} onChange={e=>set('name',e.target.value)}/>
        <Input label="Apellido" placeholder="González" value={form.last_name} onChange={e=>set('last_name',e.target.value)}/>
        <Input label="Empresa" placeholder="Tech Innovate MX" value={form.company} onChange={e=>set('company',e.target.value)}/>
        <Input label="Email" type="email" placeholder="correo@empresa.com" value={form.email} onChange={e=>set('email',e.target.value)}/>
        <Input label="Teléfono" placeholder="+56 9 1234 5678" value={form.phone} onChange={e=>set('phone',e.target.value)}/>
        <Input label="Valor estimado" type="number" placeholder="150000" value={form.estimated_value} onChange={e=>set('estimated_value',e.target.value)}/>
        <Select label="Canal" value={form.channel} onChange={e=>set('channel',e.target.value)}>
          {CHANNELS.map(c=><option key={c}>{c}</option>)}
        </Select>
        <Select label="Estado" value={form.status} onChange={e=>set('status',e.target.value)}>
          {STATUSES.map(s=><option key={s}>{s}</option>)}
        </Select>
        <Select label="Prioridad" value={form.priority} onChange={e=>set('priority',e.target.value)}>
          {['Alta','Media','Baja'].map(p=><option key={p}>{p}</option>)}
        </Select>
      </div>
      <div className={styles.modalFull}>
        <Input label="Notas" placeholder="Información relevante..." value={form.notes} onChange={e=>set('notes',e.target.value)}/>
      </div>
      <div className={styles.modalActions}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} loading={saving} disabled={!form.name}>✓ Crear Lead</Button>
      </div>
    </Modal>
  )
}

export default function Leads() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [showNew, setShowNew] = useState(false)

  const { data: leads=[], isLoading } = useQuery({
    queryKey: ['leads', search, filterStatus, filterChannel],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filterStatus)  p.set('status', filterStatus)
      if (filterChannel) p.set('channel', filterChannel)
      if (search)        p.set('search', search)
      return api.get('/leads?'+p.toString())
    },
  })

  return (
    <div className={styles.page}>
      <Header
        onSearch={setSearch}
        actions={<Button size="sm" onClick={()=>setShowNew(true)}>➕ Nuevo Lead</Button>}
      />
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <span className={styles.count}>{leads.length} lead{leads.length!==1?'s':''}</span>
          <div className={styles.filters}>
            <select className={styles.filter} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              {STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <select className={styles.filter} value={filterChannel} onChange={e=>setFilterChannel(e.target.value)}>
              <option value="">Todos los canales</option>
              {CHANNELS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <Card className={styles.tableCard}>
          {isLoading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : leads.length===0 ? (
            <Empty icon="👤" title="No se encontraron leads" subtitle="Ajusta los filtros o crea uno nuevo"/>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Canal</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Valor</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead=>(
                  <tr key={lead.id} className={styles.row} onClick={()=>navigate(`/leads/${lead.id}`)}>
                    <td>
                      <div className={styles.leadCell}>
                        <Avatar name={lead.name} size="sm"/>
                        <div>
                          <div className={styles.leadName}>{lead.name}</div>
                          <div className={styles.leadCompany}>{lead.company}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge label={lead.channel}/></td>
                    <td><Badge label={lead.status} dot/></td>
                    <td>
                      <div className={styles.priorityCell}>
                        <span className={`${styles.priorityDot} ${styles['p'+lead.priority]}`}/>
                        <span>{lead.priority}</span>
                      </div>
                    </td>
                    <td className={styles.mono}>{fmt.currency(lead.estimated_value)}</td>
                    <td className={styles.date}>{fmt.timeAgo(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {showNew && (
        <NewLeadModal
          onClose={()=>setShowNew(false)}
          onCreated={()=>queryClient.invalidateQueries(['leads'])}
        />
      )}
    </div>
  )
}
