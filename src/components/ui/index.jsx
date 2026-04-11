import clsx from 'clsx'
import { CHANNEL_COLORS, STATUS_COLORS, PRIORITY_COLORS } from '@/utils/format'
import styles from './ui.module.css'

// ── Button ────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', className, loading, ...props }) {
  return (
    <button
      className={clsx(styles.btn, styles[`btn-${variant}`], styles[`btn-${size}`], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <span className={styles.spinner} />}
      {children}
    </button>
  )
}

// ── Badge ─────────────────────────────────────────────────────
export function Badge({ label, type = 'default', dot = false }) {
  const color =
    CHANNEL_COLORS[label] || STATUS_COLORS[label] || PRIORITY_COLORS[label] || null

  return (
    <span
      className={styles.badge}
      style={color ? {
        background: color + '18',
        color,
        borderColor: color + '30',
      } : undefined}
    >
      {dot && <span className={styles.badgeDot} style={color ? { background: color } : undefined} />}
      {label}
    </span>
  )
}

// ── Avatar ────────────────────────────────────────────────────
export function Avatar({ name, size = 'md', src }) {
  const initials = name
    ? name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  if (src) return <img className={clsx(styles.avatar, styles[`avatar-${size}`])} src={src} alt={name} />

  return (
    <div className={clsx(styles.avatar, styles[`avatar-${size}`])}>
      {initials}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, error, className, ...props }) {
  return (
    <div className={styles.inputGroup}>
      {label && <label className={styles.inputLabel}>{label}</label>}
      <input className={clsx(styles.input, error && styles.inputError, className)} {...props} />
      {error && <span className={styles.inputErrorMsg}>{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, className, ...props }) {
  return (
    <div className={styles.inputGroup}>
      {label && <label className={styles.inputLabel}>{label}</label>}
      <select className={clsx(styles.input, styles.select, error && styles.inputError, className)} {...props}>
        {children}
      </select>
      {error && <span className={styles.inputErrorMsg}>{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className, ...props }) {
  return (
    <div className={styles.inputGroup}>
      {label && <label className={styles.inputLabel}>{label}</label>}
      <textarea className={clsx(styles.input, styles.textarea, error && styles.inputError, className)} {...props} />
      {error && <span className={styles.inputErrorMsg}>{error}</span>}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className, ...props }) {
  return <div className={clsx(styles.card, className)} {...props}>{children}</div>
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  return <div className={clsx(styles.spinnerEl, styles[`spinner-${size}`])} />
}

// ── Empty State ───────────────────────────────────────────────
export function Empty({ icon = '📭', title = 'Sin datos', subtitle }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{icon}</div>
      <div className={styles.emptyTitle}>{title}</div>
      {subtitle && <div className={styles.emptySub}>{subtitle}</div>}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────
export function StatCard({ label, value, icon, color = '#4f7cff', trend, suffix = '' }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ background: color + '18', color }}>
        {icon}
      </div>
      <div className={styles.statBody}>
        <div className={styles.statValue}>{value}{suffix}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
      {trend !== undefined && (
        <div className={clsx(styles.statTrend, trend >= 0 ? styles.trendUp : styles.trendDown)}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ children, onClose, title, width = 480 }) {
  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: width }}>
        {title && (
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{title}</h2>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>
        )}
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────
export function Toast({ message, type = 'success', onClose }) {
  return (
    <div className={clsx(styles.toast, styles[`toast-${type}`])}>
      <span>{type === 'success' ? '✓' : '!'}</span>
      <span>{message}</span>
      <button onClick={onClose}>✕</button>
    </div>
  )
}
export { default as ComunaInput } from './ComunaInput'
