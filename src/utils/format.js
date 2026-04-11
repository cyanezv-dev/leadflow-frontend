import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export const IVA = 1.19
export const withIva = (n) => Math.round((parseFloat(n)||0) * IVA)
export const netPrice = (n) => Math.round((parseFloat(n)||0) / IVA)

export const fmt = {
  currency: (v) =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency', currency: 'CLP', maximumFractionDigits: 0
    }).format(v || 0),

  number: (v) =>
    new Intl.NumberFormat('es-CL').format(v || 0),

  date: (d) => d
    ? format(new Date(d), "d 'de' MMM, yyyy", { locale: es })
    : '—',

  dateTime: (d) => d
    ? format(new Date(d), "d MMM yyyy, HH:mm", { locale: es })
    : '—',

  timeAgo: (d) => d
    ? formatDistanceToNow(new Date(d), { locale: es, addSuffix: true })
    : '—',

  initials: (name) => name
    ? name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?',
}

export const CHANNEL_COLORS = {
  WhatsApp: '#25d366',
  Facebook: '#1877f2',
  Instagram:'#e1306c',
  Chat:     '#60a5fa',
  Teléfono: '#fbbf24',
  Telefono: '#fbbf24',
  Web:      '#34d399',
  Email:    '#f472b6',
}

export const STATUS_COLORS = {
  Nuevo:       '#60a5fa',
  Contactado:  '#818cf8',
  Calificado:  '#a78bfa',
  Propuesta:   '#fb923c',
  Negociación: '#fbbf24',
  Negociacion: '#fbbf24',
  Ganado:      '#34d399',
  Perdido:     '#f87171',
}

export const PRIORITY_COLORS = {
  Alta:  '#f87171',
  Media: '#fbbf24',
  Baja:  '#34d399',
}
