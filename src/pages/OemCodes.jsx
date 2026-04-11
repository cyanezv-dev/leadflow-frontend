import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Empty, Toast, Modal } from '@/components/ui'
import api from '@/utils/api'
import styles from './OemCodes.module.css'

function OemModal({ oem, onClose, onSaved }) {
  const [form, setForm] = useState({
    brand_oem:   oem.brand_oem   || '',
    brand_car:   oem.brand_car   || '',
    description: oem.description || '',
    logo_url:    oem.logo_url    || '',
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const uploadLogo = async (file) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const token = localStorage.getItem('lf_token')
      const res = await fetch('/api/oem-codes/' + oem.code + '/logo', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd
      })
      const data = await res.json()
      if (data.url) set('logo_url', data.url)
    } finally { setUploading(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/oem-codes/' + oem.code, form)
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title={'Editar código OEM: ' + oem.code} onClose={onClose} width={520}>
      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label>Código</label>
          <div className={styles.codeDisplay}>{oem.code}</div>
        </div>
        <div className={styles.formField}>
          <label>Marca del auto</label>
          <input className={styles.input} value={form.brand_car} onChange={e=>set('brand_car',e.target.value)}/>
        </div>
        <div className={styles.formField} style={{gridColumn:'1/-1'}}>
          <label>Nombre OEM</label>
          <input className={styles.input} value={form.brand_oem} onChange={e=>set('brand_oem',e.target.value)}/>
        </div>
        <div className={styles.formField} style={{gridColumn:'1/-1'}}>
          <label>Descripción</label>
          <textarea className={styles.textarea} rows={2} value={form.description} onChange={e=>set('description',e.target.value)}/>
        </div>
        <div className={styles.formField} style={{gridColumn:'1/-1'}}>
          <label>Logo</label>
          <div className={styles.logoRow}>
            {form.logo_url && (
              <img src={form.logo_url} className={styles.logoPreview} alt={oem.code}
                onError={e=>e.target.style.display='none'}/>
            )}
            <div className={styles.logoActions}>
              <label className={styles.uploadBtn}>
                {uploading ? '⏳ Subiendo...' : '📁 Subir logo'}
                <input type="file" accept="image/*" style={{display:'none'}}
                  onChange={e=>e.target.files[0]&&uploadLogo(e.target.files[0])} disabled={uploading}/>
              </label>
              <input className={styles.input} placeholder="O pega URL del logo..."
                value={form.logo_url} onChange={e=>set('logo_url',e.target.value)}/>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.modalFooter}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={saving}>💾 Guardar</Button>
      </div>
    </Modal>
  )
}

export default function OemCodes() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const { data: codes=[], isLoading, refetch } = useQuery({
    queryKey: ['oem-codes'],
    queryFn: () => api.get('/oem-codes'),
  })

  // Group by brand_car
  const byBrand = {}
  codes.forEach(c => {
    if (!byBrand[c.brand_car]) byBrand[c.brand_car] = []
    byBrand[c.brand_car].push(c)
  })

  return (
    <div className={styles.page}>
      <Header/>
      <div className={styles.content}>
        <div className={styles.pageTitle}>
          <h1 className={styles.title}>🏎️ Homologaciones OEM</h1>
          <p className={styles.subtitle}>Códigos de homologación de fabricantes de vehículos para neumáticos</p>
        </div>

        {isLoading ? <div className={styles.loading}><Spinner/></div> : (
          <div className={styles.brandsGrid}>
            {Object.entries(byBrand).map(([brand, items]) => (
              <Card key={brand} className={styles.brandCard}>
                <div className={styles.brandHeader}>
                  {items[0]?.logo_url ? (
                    <img src={items[0].logo_url} className={styles.brandLogo} alt={brand}
                      onError={e=>e.target.style.display='none'}/>
                  ) : (
                    <div className={styles.brandLogoPlaceholder}>🚗</div>
                  )}
                  <div className={styles.brandName}>{brand}</div>
                  <div className={styles.brandCount}>{items.length} código{items.length>1?'s':''}</div>
                </div>
                <div className={styles.codesList}>
                  {items.map(c => (
                    <div key={c.code} className={styles.codeRow} onClick={()=>setEditing(c)}>
                      <div className={styles.codeLeft}>
                        <span className={styles.codeBadge}>{c.code}</span>
                        <div>
                          <div className={styles.codeName}>{c.brand_oem}</div>
                          <div className={styles.codeDesc}>{c.description}</div>
                        </div>
                      </div>
                      <div className={styles.codeActions}>
                        {c.logo_url
                          ? <img src={c.logo_url} className={styles.codeLogoSmall} alt={c.code} onError={e=>e.target.style.display='none'}/>
                          : <span className={styles.noLogo}>Sin logo</span>
                        }
                        <button className={styles.editBtn}>✏️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <OemModal
          oem={editing}
          onClose={()=>setEditing(null)}
          onSaved={()=>{ refetch(); showToast('✓ Guardado') }}
        />
      )}
      {toast && <Toast message={toast} onClose={()=>setToast('')}/>}
    </div>
  )
}
