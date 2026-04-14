import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Spinner, Empty, Modal, Input } from '@/components/ui'
import api from '@/utils/api'
import styles from './Despachos.module.css'

const COURIER_ICONS = {
  CHILEXPRESS: '🔵', STARKEN: '🟠', BLUEX: '🔷', CORREOS: '🟡', ENVIAME: '🟢',
}

function CourierModal({ courier, onClose, onSaved }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...courier })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      await api.put(`/despachos/couriers/${courier.id}`, form)
      qc.invalidateQueries(['couriers-config'])
      onSaved()
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Configurar ${courier.nombre}`} onClose={onClose} width={520}>
      <div className={styles.formGrid2}>
        <Input label="Factor divisor volumétrico" type="number" value={form.factor_divisor} onChange={e => set('factor_divisor', e.target.value)}
          hint="Estándar industria: 4000 (peso vol = volumen cm³ / 4000)" />
        <Input label="Peso máximo (kg)" type="number" step="0.1" value={form.peso_max_kg} onChange={e => set('peso_max_kg', e.target.value)} />
        <Input label="Largo máximo (cm)" type="number" step="0.1" value={form.dim_max_largo_cm} onChange={e => set('dim_max_largo_cm', e.target.value)} />
        <Input label="Ancho máximo (cm)" type="number" step="0.1" value={form.dim_max_ancho_cm} onChange={e => set('dim_max_ancho_cm', e.target.value)} />
        <Input label="Alto máximo (cm)" type="number" step="0.1" value={form.dim_max_alto_cm} onChange={e => set('dim_max_alto_cm', e.target.value)} />
        <Input label="Recargo sobredimensión (%)" type="number" step="0.1" value={form.recargo_sobredim_pct || 0} onChange={e => set('recargo_sobredim_pct', e.target.value)} />
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 16 }}>🔗 Integración API</div>
      <div className={styles.formGrid2}>
        <Input label="URL base API" value={form.api_base_url || ''} onChange={e => set('api_base_url', e.target.value)} placeholder="https://…" />
        <Input label="Variable de entorno (API Key)" value={form.api_key_env || ''} onChange={e => set('api_key_env', e.target.value)} placeholder="CHILEXPRESS_API_KEY" hint="Solo el nombre de la variable, sin el valor" />
      </div>

      <div className={styles.toggleRow}>
        <label className={styles.toggleLabel}>
          <input type="checkbox" checked={form.acepta_neumaticos !== false} onChange={e => set('acepta_neumaticos', e.target.checked)} />
          Acepta neumáticos
        </label>
        <label className={styles.toggleLabel}>
          <input type="checkbox" checked={form.activo !== false} onChange={e => set('activo', e.target.checked)} />
          Activo
        </label>
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}
      <div className={styles.modalFooter}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
      </div>
    </Modal>
  )
}

export default function DespachosCouriers() {
  const [editando, setEditando] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['couriers-config'],
    queryFn: () => api.get('/despachos/couriers'),
  })
  const couriers = data?.data || []

  return (
    <div className={styles.page}>
      <Header title="Configuración de couriers" subtitle="Límites, factores y credenciales de integración" />

      <div className={styles.infoBox}>
        ℹ️ Las tarifas reales se calculan vía API de cada courier (fase 2). Por ahora puedes ajustar los límites de dimensiones y peso para validar si un envío es viable.
      </div>

      {isLoading ? <Spinner /> : couriers.length === 0 ? (
        <Empty icon="🚚" title="Sin couriers" />
      ) : (
        <div className={styles.couriersList}>
          {couriers.map(c => (
            <div key={c.id} className={`${styles.courierConfigCard} ${!c.activo ? styles.inactivo : ''}`}>
              <div className={styles.courierConfigHeader}>
                <span className={styles.courierConfigIcon}>{COURIER_ICONS[c.codigo] || '📦'}</span>
                <div className={styles.courierConfigInfo}>
                  <div className={styles.courierConfigNombre}>{c.nombre}</div>
                  <div className={styles.courierConfigCodigo}>{c.codigo}</div>
                </div>
                <div className={styles.courierConfigBadges}>
                  {c.acepta_neumaticos && <span className={styles.chip}>🔄 Acepta neumáticos</span>}
                  {!c.activo && <span className={styles.chipOff}>Inactivo</span>}
                </div>
              </div>

              <div className={styles.courierLimits}>
                <div className={styles.limitItem}>
                  <span className={styles.limitLabel}>Factor divisor</span>
                  <strong>{c.factor_divisor}</strong>
                </div>
                <div className={styles.limitItem}>
                  <span className={styles.limitLabel}>Peso máx.</span>
                  <strong>{c.peso_max_kg} kg</strong>
                </div>
                <div className={styles.limitItem}>
                  <span className={styles.limitLabel}>Largo máx.</span>
                  <strong>{c.dim_max_largo_cm} cm</strong>
                </div>
                <div className={styles.limitItem}>
                  <span className={styles.limitLabel}>Ancho máx.</span>
                  <strong>{c.dim_max_ancho_cm} cm</strong>
                </div>
                <div className={styles.limitItem}>
                  <span className={styles.limitLabel}>Alto máx.</span>
                  <strong>{c.dim_max_alto_cm} cm</strong>
                </div>
              </div>

              {c.api_base_url && (
                <div className={styles.apiUrl}>🔗 {c.api_base_url}</div>
              )}

              <div className={styles.courierConfigFooter}>
                <Button size="sm" variant="outline" onClick={() => setEditando(c)}>⚙️ Configurar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <CourierModal
          courier={editando}
          onClose={() => setEditando(null)}
          onSaved={() => setEditando(null)}
        />
      )}
    </div>
  )
}
