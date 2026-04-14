import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { Button, Spinner, Empty, Modal, Input, Select } from '@/components/ui'
import api from '@/utils/api'
import styles from './Despachos.module.css'

const EMPTY_FORM = {
  medida: '', ancho_seccion_mm: '', diametro_aro_pulgadas: '', perfil_pct: '',
  diam_ext_cm: '', ancho_seccion_cm: '', caja_largo_cm: '', caja_ancho_cm: '',
  caja_alto_cm: '', volumen_cm3: '', peso_real_kg: '', categoria: 'pasajero',
}

function MedidaModal({ medida, onClose, onSaved }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(medida ? {
    medida: medida.medida, ancho_seccion_mm: medida.ancho_seccion_mm,
    diametro_aro_pulgadas: medida.diametro_aro_pulgadas, perfil_pct: medida.perfil_pct,
    diam_ext_cm: medida.diam_ext_cm, ancho_seccion_cm: medida.ancho_seccion_cm,
    caja_largo_cm: medida.caja_largo_cm, caja_ancho_cm: medida.caja_ancho_cm,
    caja_alto_cm: medida.caja_alto_cm, volumen_cm3: medida.volumen_cm3,
    peso_real_kg: medida.peso_real_kg, categoria: medida.categoria,
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Auto-calcular al ingresar dimensiones básicas
  const autoCalc = (patch) => {
    const f = { ...form, ...patch }
    const diam = parseFloat(f.diam_ext_cm) || 0
    const ancho = parseFloat(f.ancho_seccion_cm) || 0
    if (diam && ancho) {
      const vol = parseFloat((diam * diam * ancho).toFixed(2))
      setForm(p => ({
        ...p, ...patch,
        caja_largo_cm: diam, caja_ancho_cm: diam, caja_alto_cm: ancho,
        volumen_cm3: vol,
      }))
    } else {
      setForm(p => ({ ...p, ...patch }))
    }
  }

  const save = async () => {
    if (!form.medida) return setError('La medida es requerida')
    setSaving(true); setError('')
    try {
      await api.post('/despachos/neumaticos/dimensiones', form)
      qc.invalidateQueries(['neumatico-dimensiones'])
      onSaved()
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={medida ? `Editar ${medida.medida}` : 'Nueva medida'} onClose={onClose} width={560}>
      <div className={styles.formGrid2}>
        <Input label="Medida *" placeholder="Ej: 205/55R16" value={form.medida} onChange={e => set('medida', e.target.value.toUpperCase())} />
        <Select label="Categoría" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
          <option value="pasajero">Pasajero</option>
          <option value="camioneta">Camioneta / SUV</option>
        </Select>
        <Input label="Ancho sección (mm)" type="number" value={form.ancho_seccion_mm} onChange={e => set('ancho_seccion_mm', e.target.value)} />
        <Input label="Diámetro aro (pulgadas)" type="number" value={form.diametro_aro_pulgadas} onChange={e => set('diametro_aro_pulgadas', e.target.value)} />
        <Input label="Perfil (%)" type="number" value={form.perfil_pct} onChange={e => set('perfil_pct', e.target.value)} />
        <Input label="Peso real (kg)" type="number" step="0.1" value={form.peso_real_kg} onChange={e => set('peso_real_kg', e.target.value)} />
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 16 }}>📦 Dimensiones de caja</div>
      <div className={styles.formGrid2}>
        <Input label="Diámetro exterior (cm)" type="number" step="0.01" value={form.diam_ext_cm} onChange={e => autoCalc({ diam_ext_cm: e.target.value })} />
        <Input label="Ancho sección (cm)" type="number" step="0.01" value={form.ancho_seccion_cm} onChange={e => autoCalc({ ancho_seccion_cm: e.target.value })} />
        <Input label="Caja largo (cm)" type="number" step="0.01" value={form.caja_largo_cm} onChange={e => set('caja_largo_cm', e.target.value)} />
        <Input label="Caja ancho (cm)" type="number" step="0.01" value={form.caja_ancho_cm} onChange={e => set('caja_ancho_cm', e.target.value)} />
        <Input label="Caja alto (cm)" type="number" step="0.01" value={form.caja_alto_cm} onChange={e => set('caja_alto_cm', e.target.value)} />
        <Input label="Volumen (cm³)" type="number" step="0.01" value={form.volumen_cm3} onChange={e => set('volumen_cm3', e.target.value)} />
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}
      <div className={styles.modalFooter}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </Modal>
  )
}

export default function DespachosMedidas() {
  const [filtro, setFiltro] = useState('')
  const [editando, setEditando] = useState(null)
  const [nuevo, setNuevo] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['neumatico-dimensiones'],
    queryFn: () => api.get('/despachos/neumaticos/dimensiones?activo=true').then(r => r.data),
  })
  const medidas = (data?.data || []).filter(m =>
    !filtro || m.medida.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className={styles.page}>
      <Header title="Medidas de neumáticos" subtitle="Catálogo maestro de dimensiones para cálculo de despacho" />

      <div className={styles.toolbar}>
        <input className={styles.searchInput} value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar medida… (ej: 205 o R16)" />
        <Button onClick={() => setNuevo(true)}>+ Nueva medida</Button>
      </div>

      {isLoading ? <Spinner /> : medidas.length === 0 ? (
        <Empty icon="📐" title="Sin medidas" subtitle="Agrega medidas al catálogo para poder cotizar despachos." />
      ) : (
        <>
          <div className={styles.medidasHeader}>
            <span>Medida</span><span>Cat.</span><span>Ancho</span><span>Aro</span>
            <span>Diam. ext.</span><span>Caja</span><span>Peso</span><span></span>
          </div>
          <div className={styles.medidasList}>
            {medidas.map(m => (
              <div key={m.medida} className={styles.medidaRow}>
                <strong className={styles.medidaCode}>{m.medida}</strong>
                <span className={`${styles.catBadge} ${m.categoria === 'camioneta' ? styles.catCamioneta : ''}`}>
                  {m.categoria === 'camioneta' ? '🚙' : '🚗'}
                </span>
                <span>{m.ancho_seccion_mm} mm</span>
                <span>R{m.diametro_aro_pulgadas}</span>
                <span>{m.diam_ext_cm} cm</span>
                <span className={styles.medidaCaja}>
                  {m.caja_largo_cm}×{m.caja_ancho_cm}×{m.caja_alto_cm} cm
                </span>
                <span><strong>{m.peso_real_kg} kg</strong></span>
                <Button size="sm" variant="ghost" onClick={() => setEditando(m)}>✏️</Button>
              </div>
            ))}
          </div>
        </>
      )}

      {(nuevo || editando) && (
        <MedidaModal
          medida={editando}
          onClose={() => { setNuevo(false); setEditando(null) }}
          onSaved={() => { setNuevo(false); setEditando(null) }}
        />
      )}
    </div>
  )
}
