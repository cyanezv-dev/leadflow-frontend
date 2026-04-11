import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Avatar, Card, Spinner, Empty, Toast, Modal, Input, Select } from '@/components/ui'
import { fmt } from '@/utils/format'
import api from '@/utils/api'
import styles from './Contacts.module.css'

const CHANNELS = ['Web','WhatsApp','Facebook','Instagram','Chat','Teléfono','Email']

function ContactModal({ contact, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:        contact?.name        || '',
    last_name:   contact?.last_name   || '',
    email:       contact?.email       || '',
    phone:       contact?.phone       || '',
    rut:         contact?.rut         || '',
    company:     contact?.company     || '',
    company_rut: contact?.company_rut || '',
    job_title:   contact?.job_title   || '',
    channel:     contact?.channel     || 'Web',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      if (contact?.id) {
        await api.put(`/contacts/${contact.id}`, form)
      } else {
        await api.post('/contacts', form)
      }
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title={contact?.id ? 'Editar contacto' : 'Nuevo contacto'} onClose={onClose} width={600}>
      <div className={styles.mSection}>
        <div className={styles.mSectionTitle}>👤 Datos personales</div>
        <div className={styles.mGrid}>
          <Input label="Nombre *" placeholder="María" value={form.name} onChange={e => set('name', e.target.value)} />
          <Input label="Apellido" placeholder="González" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
          <Input label="RUT" placeholder="12.345.678-9" value={form.rut} onChange={e => set('rut', e.target.value)} />
          <Input label="Teléfono" placeholder="+56 9 1234 5678" value={form.phone} onChange={e => set('phone', e.target.value)} />
          <Input label="Email" type="email" placeholder="correo@empresa.com" value={form.email} onChange={e => set('email', e.target.value)} />
          <Select label="Canal de origen" value={form.channel} onChange={e => set('channel', e.target.value)}>
            {CHANNELS.map(c => <option key={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      <div className={styles.mSection}>
        <div className={styles.mSectionTitle}>🏢 Datos empresa</div>
        <div className={styles.mGrid}>
          <Input label="Empresa" placeholder="Tech Innovate Ltda." value={form.company} onChange={e => set('company', e.target.value)} />
          <Input label="RUT empresa" placeholder="76.123.456-7" value={form.company_rut} onChange={e => set('company_rut', e.target.value)} />
          <Input label="Cargo" placeholder="Gerente de Operaciones" value={form.job_title} onChange={e => set('job_title', e.target.value)} />
        </div>
      </div>

      <div className={styles.mActions}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={saving} disabled={!form.name}>
          {contact?.id ? '💾 Guardar cambios' : '✓ Crear contacto'}
        </Button>
      </div>
    </Modal>
  )
}

function DeleteModal({ contact, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)
  const confirm = async () => {
    setLoading(true)
    await api.delete(`/contacts/${contact.id}`)
    onDeleted()
    onClose()
  }
  return (
    <Modal title="Eliminar contacto" onClose={onClose} width={400}>
      <p className={styles.deleteText}>
        ¿Estás seguro que deseas eliminar a <strong>{contact.name} {contact.last_name || ''}</strong>?
        Esta acción eliminará también todas sus actividades, notas y cotizaciones.
      </p>
      <div className={styles.mActions}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={confirm} loading={loading}>Eliminar</Button>
      </div>
    </Modal>
  )
}

export default function Contacts() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast] = useState('')
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => api.get('/contacts' + (search ? `?search=${search}` : '')),
  })

  const refresh = () => queryClient.invalidateQueries(['contacts'])

  return (
    <div className={styles.page}>
      <Header
        onSearch={setSearch}
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>➕ Nuevo Contacto</Button>
        }
      />

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statNum}>{contacts.length}</div>
            <div className={styles.statLabel}>Total contactos</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>{contacts.filter(c => c.email).length}</div>
            <div className={styles.statLabel}>Con email</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>{contacts.filter(c => c.company).length}</div>
            <div className={styles.statLabel}>Con empresa</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>{contacts.filter(c => c.channel === 'WhatsApp').length}</div>
            <div className={styles.statLabel}>Vía WhatsApp</div>
          </div>
        </div>

        {/* Grid de contactos */}
        {isLoading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : contacts.length === 0 ? (
          <Empty icon="👥" title="Sin contactos" subtitle="Los contactos aparecerán aquí automáticamente cuando el agente reciba mensajes" />
        ) : (
          <div className={styles.grid}>
            {contacts.map(c => (
              <div key={c.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <Avatar name={c.name} size="md" />
                  <div className={styles.cardInfo}>
                    <div className={styles.cardName}>{c.name} {c.last_name || ''}</div>
                    {c.job_title && <div className={styles.cardJob}>{c.job_title}</div>}
                    {c.company && <div className={styles.cardCompany}>🏢 {c.company}</div>}
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.actionBtn} onClick={() => setEditing(c)} title="Editar">✏️</button>
                    <button className={`${styles.actionBtn} ${styles.actionDel}`} onClick={() => setDeleting(c)} title="Eliminar">🗑️</button>
                  </div>
                </div>

                <div className={styles.cardDetails}>
                  {c.email && (
                    <div className={styles.detail}>
                      <span className={styles.detailIcon}>✉️</span>
                      <a href={`mailto:${c.email}`} className={styles.detailLink}>{c.email}</a>
                    </div>
                  )}
                  {c.phone && (
                    <div className={styles.detail}>
                      <span className={styles.detailIcon}>📞</span>
                      <a href={`tel:${c.phone}`} className={styles.detailLink}>{c.phone}</a>
                    </div>
                  )}
                  {c.rut && (
                    <div className={styles.detail}>
                      <span className={styles.detailIcon}>🪪</span>
                      <span>{c.rut}</span>
                    </div>
                  )}
                  {c.company_rut && (
                    <div className={styles.detail}>
                      <span className={styles.detailIcon}>📄</span>
                      <span>RUT empresa: {c.company_rut}</span>
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.channel}>{c.channel}</span>
                  <span className={styles.date}>{fmt.timeAgo(c.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <ContactModal onClose={() => setShowNew(false)} onSaved={() => { refresh(); showToast('Contacto creado') }} />
      )}
      {editing && (
        <ContactModal contact={editing} onClose={() => setEditing(null)} onSaved={() => { refresh(); showToast('Contacto actualizado') }} />
      )}
      {deleting && (
        <DeleteModal contact={deleting} onClose={() => setDeleting(null)} onDeleted={() => { refresh(); showToast('Contacto eliminado') }} />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
