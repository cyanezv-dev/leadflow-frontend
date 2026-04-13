import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Card, Spinner, Toast } from '@/components/ui'
import api from '@/utils/api'
import styles from './Settings.module.css'

function Section({ title, icon, children }) {
  return (
    <Card className={styles.section}>
      <div className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>{icon}</span>
        {title}
      </div>
      <div className={styles.fields}>{children}</div>
    </Card>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {hint && <div className={styles.hint}>{hint}</div>}
      {children}
    </div>
  )
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingFav, setUploadingFav] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const uploadLogo = async (file) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/upload/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        set('company_logo_url', data.url)
        showToast('Logo subido correctamente')
      }
    } catch (e) {
      showToast('Error al subir el logo')
    } finally { setUploading(false) }
  }

  const uploadFavicon = async (file) => {
    setUploadingFav(true)
    try {
      const fd = new FormData()
      fd.append('favicon', file)
      const res = await fetch('/api/upload/favicon', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        set('company_favicon_url', data.url)
        showToast('Favicon subido correctamente')
      }
    } catch (e) {
      showToast('Error al subir el favicon')
    } finally { setUploadingFav(false) }
  }

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
  })

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/settings', form)
      queryClient.invalidateQueries(['settings'])
      showToast('Configuración guardada')
    } finally { setSaving(false) }
  }

  if (isLoading) return (
    <div className={styles.page}>
      <Header />
      <div className={styles.loading}><Spinner size="lg" /></div>
    </div>
  )

  return (
    <div className={styles.page}>
      <Header actions={
        <Button onClick={save} loading={saving}>💾 Guardar cambios</Button>
      } />

      <div className={styles.content}>

        {/* EMPRESA */}
        <Section title="Datos de la empresa" icon="🏢">
          <div className={styles.logoWrap}>
            {form.company_logo_url ? (
              <img src={form.company_logo_url} alt="Logo" className={styles.logoPreview} />
            ) : (
              <div className={styles.logoEmpty}>Sin logo</div>
            )}
            <div className={styles.logoActions}>
              <label className={styles.uploadBtn}>
                {uploading ? 'Subiendo…' : '📁 Subir logo'}
                <input type="file" accept="image/*" style={{display:'none'}}
                  onChange={e => e.target.files[0] && uploadLogo(e.target.files[0])} />
              </label>
              <Field label="O pega una URL del logo">
                <input className={styles.input} placeholder="https://empresa.com/logo.png"
                  value={form.company_logo_url || ''}
                  onChange={e => set('company_logo_url', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className={styles.logoWrap} style={{ marginTop: 20 }}>
            <div className={styles.faviconPreviewWrap}>
              {form.company_favicon_url ? (
                <img src={form.company_favicon_url} alt="Favicon" className={styles.faviconPreview} />
              ) : (
                <div className={styles.faviconEmpty}>Sin favicon</div>
              )}
            </div>
            <div className={styles.logoActions}>
              <Field label="Favicon (pestaña del navegador)" hint="PNG, SVG, ICO o WebP · máx. 512 KB. Se usa en la tienda pública.">
                <label className={styles.uploadBtn}>
                  {uploadingFav ? 'Subiendo…' : '📁 Subir favicon'}
                  <input type="file" accept=".ico,.png,.svg,.webp,image/*" style={{ display: 'none' }}
                    onChange={e => e.target.files[0] && uploadFavicon(e.target.files[0])} />
                </label>
              </Field>
              <Field label="O URL del favicon">
                <input className={styles.input} placeholder="https://empresa.com/favicon.ico"
                  value={form.company_favicon_url || ''}
                  onChange={e => set('company_favicon_url', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className={styles.grid2}>
            <Field label="Nombre de la empresa">
              <input className={styles.input} placeholder="Cambiatuneumatico.com"
                value={form.company_name || ''}
                onChange={e => set('company_name', e.target.value)} />
            </Field>
            <Field label="RUT">
              <input className={styles.input} placeholder="76.123.456-7"
                value={form.company_rut || ''}
                onChange={e => set('company_rut', e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <input className={styles.input} placeholder="+56 9 1234 5678"
                value={form.company_phone || ''}
                onChange={e => set('company_phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <input className={styles.input} type="email" placeholder="contacto@empresa.com"
                value={form.company_email || ''}
                onChange={e => set('company_email', e.target.value)} />
            </Field>
            <Field label="Sitio web">
              <input className={styles.input} placeholder="https://empresa.com"
                value={form.company_website || ''}
                onChange={e => set('company_website', e.target.value)} />
            </Field>
            <Field label="IVA por defecto (%)">
              <input className={styles.input} type="number" min="0" max="100" placeholder="19"
                value={form.iva_default || '19'}
                onChange={e => set('iva_default', e.target.value)} />
            </Field>
          </div>
          <Field label="Dirección">
            <input className={styles.input} placeholder="Av. Providencia 1234, Santiago"
              value={form.company_address || ''}
              onChange={e => set('company_address', e.target.value)} />
          </Field>
          <Field label="Texto al pie de la cotización">
            <textarea className={`${styles.input} ${styles.textarea}`}
              placeholder="Gracias por su preferencia. Precios en CLP con IVA incluido."
              value={form.quote_footer || ''}
              onChange={e => set('quote_footer', e.target.value)} />
          </Field>
        </Section>

        {/* DATOS DE TRANSFERENCIA */}
        <Section title="Datos bancarios para transferencia" icon="🏦">
          <div className={styles.grid2}>
            <Field label="Banco">
              <input className={styles.input} placeholder="Banco Santander"
                value={form.bank_name || ''}
                onChange={e => set('bank_name', e.target.value)} />
            </Field>
            <Field label="Tipo de cuenta">
              <select className={`${styles.input} ${styles.select}`}
                value={form.bank_account_type || ''}
                onChange={e => set('bank_account_type', e.target.value)}>
                <option value="">Seleccionar...</option>
                <option value="Cuenta Corriente">Cuenta Corriente</option>
                <option value="Cuenta Vista">Cuenta Vista</option>
                <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                <option value="Cuenta RUT">Cuenta RUT</option>
              </select>
            </Field>
            <Field label="N° de cuenta">
              <input className={styles.input} placeholder="000-12345678"
                value={form.bank_account_number || ''}
                onChange={e => set('bank_account_number', e.target.value)} />
            </Field>
            <Field label="Nombre del titular">
              <input className={styles.input} placeholder="Empresa SpA"
                value={form.bank_account_name || ''}
                onChange={e => set('bank_account_name', e.target.value)} />
            </Field>
            <Field label="RUT del titular">
              <input className={styles.input} placeholder="76.123.456-7"
                value={form.bank_rut || ''}
                onChange={e => set('bank_rut', e.target.value)} />
            </Field>
            <Field label="Email para confirmación de pago">
              <input className={styles.input} type="email" placeholder="pagos@empresa.com"
                value={form.bank_email || ''}
                onChange={e => set('bank_email', e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* LINKS DE PAGO */}
        <Section title="Links de pago" icon="🔗">
          <p className={styles.sectionDesc}>
            Agrega hasta 3 links de pago que aparecerán en la cotización (Mercado Pago, Flow, Stripe, etc.)
          </p>
          {[1, 2, 3].map(n => (
            <div key={n} className={styles.grid2} style={{ marginBottom: 12 }}>
              <Field label={`Link ${n} — Nombre`}>
                <input className={styles.input} placeholder={n === 1 ? 'Mercado Pago' : n === 2 ? 'Flow' : 'Otro'}
                  value={form[`payment_link_${n}_label`] || ''}
                  onChange={e => set(`payment_link_${n}_label`, e.target.value)} />
              </Field>
              <Field label={`Link ${n} — URL`}>
                <input className={styles.input} placeholder="https://link.mercadopago.cl/..."
                  value={form[`payment_link_${n}_url`] || ''}
                  onChange={e => set(`payment_link_${n}_url`, e.target.value)} />
              </Field>
            </div>
          ))}
        </Section>

        {/* NOTIFICACIONES */}
        <Section title="Notificaciones automáticas" icon="📨">
          <div className={styles.grid2}>
            <Field label="WhatsApp de envío" hint="Número Twilio configurado en el agente">
              <input className={styles.input} placeholder="whatsapp:+14155238886"
                value={form.whatsapp_number || ''}
                onChange={e => set('whatsapp_number', e.target.value)} />
            </Field>
            <Field label="Email de envío (SendGrid)" hint="Email verificado en SendGrid">
              <input className={styles.input} type="email" placeholder="cotizaciones@empresa.com"
                value={form.sendgrid_from_email || ''}
                onChange={e => set('sendgrid_from_email', e.target.value)} />
            </Field>
          </div>
        </Section>

        <div className={styles.saveBar}>
          <Button onClick={save} loading={saving} size="lg">
            💾 Guardar toda la configuración
          </Button>
        </div>

      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
