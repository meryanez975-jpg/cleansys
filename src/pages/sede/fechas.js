// Fechas locales en formato AAAA-MM-DD (sin problemas de zona horaria)
export const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
// Orden de la semana para mostrar: lunes primero (valores de Date.getDay())
export const SEMANA_JS = [1, 2, 3, 4, 5, 6, 0]

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const deIso = s => new Date(s + 'T12:00:00')
export const hoyIso = () => iso(new Date())

export function sumarDias(s, n) {
  const d = deIso(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

// Lunes de la semana de hoy + offset semanas
export function lunesDeSemana(offset = 0) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7)
  return iso(d)
}

export function diasEntre(desde, hasta) {
  return Math.round((deIso(hasta) - deIso(desde)) / 86400000)
}

export function fechaCorta(s) {
  return deIso(s).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}
