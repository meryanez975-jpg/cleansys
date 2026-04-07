// =====================================================
// STORE LOCAL — reemplaza Supabase para modo offline
// Cuando tengas Supabase: solo cambiar los hooks,
// este archivo queda de respaldo.
// =====================================================

const KEYS = {
  personal:      'cleansys_personal',
  zonas:         'cleansys_zonas',
  asignaciones:  'cleansys_asignaciones',
  registros:     'cleansys_registros',
  supervisores:  'cleansys_supervisores',
}

// Datos iniciales la primera vez que se abre la app
const SEED = {
  personal: [],
  zonas: [
    { id: 'z1', nombre: 'Baño',   activo: true },
    { id: 'z2', nombre: 'Tienda', activo: true },
  ],
  asignaciones: [],
  registros:    [],
  supervisores: [
    { id: 's1', nombre: 'Supervisor', pin: '1234', activo: true },
  ],
}

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

function leer(key) {
  try {
    const raw = localStorage.getItem(KEYS[key])
    if (raw === null) {
      escribir(key, SEED[key])
      return SEED[key]
    }
    return JSON.parse(raw)
  } catch {
    return SEED[key]
  }
}

function escribir(key, data) {
  localStorage.setItem(KEYS[key], JSON.stringify(data))
}

// ── PERSONAL ──────────────────────────────────────
export function getPersonal() {
  return leer('personal').filter(p => p.activo)
}

export function addPersonal(nombre, sector) {
  const all = leer('personal')
  const nuevo = { id: genId(), nombre: nombre.trim(), sector: sector.trim(), activo: true }
  escribir('personal', [...all, nuevo])
  return nuevo
}

export function editPersonal(id, nombre, sector) {
  const all = leer('personal')
  escribir('personal', all.map(p =>
    p.id === id ? { ...p, nombre: nombre.trim(), sector: sector.trim() } : p
  ))
}

export function removePersonal(id) {
  const all = leer('personal')
  escribir('personal', all.map(p => p.id === id ? { ...p, activo: false } : p))
}

// ── ZONAS ─────────────────────────────────────────
export function getZonas() {
  return leer('zonas').filter(z => z.activo)
}

export function addZona(nombre) {
  const all = leer('zonas')
  const nueva = { id: genId(), nombre: nombre.trim(), activo: true }
  escribir('zonas', [...all, nueva])
  return nueva
}

export function editZona(id, nombre) {
  const all = leer('zonas')
  escribir('zonas', all.map(z => z.id === id ? { ...z, nombre: nombre.trim() } : z))
}

export function removeZona(id) {
  const all = leer('zonas')
  escribir('zonas', all.map(z => z.id === id ? { ...z, activo: false } : z))
}

// ── ASIGNACIONES ──────────────────────────────────
export function getAsignaciones(fecha) {
  const personal = leer('personal')
  const zonas    = leer('zonas')
  return leer('asignaciones')
    .filter(a => a.fecha === fecha)
    .map(a => ({
      ...a,
      personal: personal.find(p => p.id === a.personal_id)
        || (a.personalNombre ? { id: a.personal_id, nombre: a.personalNombre, sector: a.personalSector || '' } : null),
      zona: zonas.find(z => z.id === a.zona_id) || null,
    }))
}

export function addAsignacion(personal_id, zona_id, turno, fecha, personalNombre = '', personalSector = '') {
  const all = leer('asignaciones')
  const existe = all.find(a =>
    a.personal_id === personal_id && a.fecha === fecha && a.turno === turno
  )
  if (existe) return { error: 'Esta persona ya está asignada en este turno' }
  const nueva = { id: genId(), personal_id, zona_id, turno, fecha, personalNombre, personalSector, creado_en: new Date().toISOString() }
  escribir('asignaciones', [...all, nueva])
  return { error: null }
}

export function editAsignacion(id, datos) {
  const all = leer('asignaciones')
  escribir('asignaciones', all.map(a => a.id === id ? { ...a, ...datos } : a))
}

export function removeAsignacion(id) {
  escribir('asignaciones', leer('asignaciones').filter(a => a.id !== id))
  // borrar registro asociado
  escribir('registros', leer('registros').filter(r => r.asignacion_id !== id))
}

// ── REGISTROS ─────────────────────────────────────
export function getRegistros(fecha) {
  const asignaciones = leer('asignaciones').filter(a => a.fecha === fecha)
  const personal     = leer('personal')
  const zonas        = leer('zonas')
  const ids          = asignaciones.map(a => a.id)
  return leer('registros')
    .filter(r => ids.includes(r.asignacion_id))
    .map(r => {
      const asig = asignaciones.find(a => a.id === r.asignacion_id)
      return {
        ...r,
        asignacion: asig ? {
          ...asig,
          personal: personal.find(p => p.id === asig.personal_id) || null,
          zona:     zonas.find(z => z.id === asig.zona_id) || null,
        } : null,
      }
    })
}

export function marcarEntrada(asignacion_id) {
  const all = leer('registros')
  if (all.find(r => r.asignacion_id === asignacion_id)) return
  const nuevo = {
    id: genId(),
    asignacion_id,
    hora_entrada: new Date().toISOString(),
    hora_salida:  null,
    completado:   false,
    notas:        '',
  }
  escribir('registros', [...all, nuevo])
}

export function marcarSalida(asignacion_id, notas = '') {
  const all = leer('registros')
  escribir('registros', all.map(r =>
    r.asignacion_id === asignacion_id
      ? { ...r, hora_salida: new Date().toISOString(), completado: true, notas }
      : r
  ))
}

// ── MATERIALES ────────────────────────────────────
export function getMateriales() {
  try {
    const raw = localStorage.getItem('cleansys_materiales')
    if (raw === null) { localStorage.setItem('cleansys_materiales', '[]'); return [] }
    return JSON.parse(raw).filter(m => m.activo)
  } catch { return [] }
}

export function addMaterial(nombre, cantidad, unidad, fechaCompra, fechaReposicion) {
  const raw = localStorage.getItem('cleansys_materiales')
  const all = raw ? JSON.parse(raw) : []
  const nuevo = { id: genId(), nombre: nombre.trim(), cantidad, unidad: unidad.trim(), fechaCompra, fechaReposicion, activo: true }
  localStorage.setItem('cleansys_materiales', JSON.stringify([...all, nuevo]))
  return nuevo
}

export function editMaterial(id, datos) {
  const raw = localStorage.getItem('cleansys_materiales')
  const all = raw ? JSON.parse(raw) : []
  localStorage.setItem('cleansys_materiales', JSON.stringify(
    all.map(m => m.id === id ? { ...m, ...datos } : m)
  ))
}

export function removeMaterial(id) {
  const raw = localStorage.getItem('cleansys_materiales')
  const all = raw ? JSON.parse(raw) : []
  localStorage.setItem('cleansys_materiales', JSON.stringify(
    all.map(m => m.id === id ? { ...m, activo: false } : m)
  ))
}

export function getAsignacionesPorPersonalYMes(personal_id, mes) {
  const personal = leer('personal')
  const zonas    = leer('zonas')
  return leer('asignaciones')
    .filter(a => a.personal_id === personal_id && a.fecha.startsWith(mes))
    .map(a => ({
      ...a,
      personal: personal.find(p => p.id === a.personal_id) || null,
      zona:     zonas.find(z => z.id === a.zona_id) || null,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function getAsignacionesPorFechas(fechas) {
  const personal = leer('personal')
  const zonas    = leer('zonas')
  return leer('asignaciones')
    .filter(a => fechas.includes(a.fecha))
    .map(a => ({
      ...a,
      personal: personal.find(p => p.id === a.personal_id)
        || (a.personalNombre ? { id: a.personal_id, nombre: a.personalNombre, sector: a.personalSector || '' } : null),
      zona: zonas.find(z => z.id === a.zona_id) || null,
    }))
}

// ── SUPERVISORES ──────────────────────────────────
export function verificarPin(pin) {
  return leer('supervisores').find(s => s.pin === pin && s.activo) || null
}

export function cambiarPin(id, nuevoPin) {
  const all = leer('supervisores')
  escribir('supervisores', all.map(s => s.id === id ? { ...s, pin: nuevoPin } : s))
}
