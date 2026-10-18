import { supabase } from '../supabase/client'

// Sedes de limpieza: las crea el supervisor general; cada sede entra a su
// app con su link y su contraseña (inicial: limpieza123). Todo pasa por
// funciones de la base (ver sql/20261018160000_sedes_limpieza.sql).
export const PASSWORD_INICIAL_SEDE = 'limpieza123'

async function rpc(nombre, params) {
  const { data, error } = await supabase.rpc(nombre, params)
  if (error) {
    const msg = error.message || ''
    if (/fetch|network/i.test(msg)) throw new Error('Sin conexión. Revisá el internet e intentá de nuevo.')
    if (/function .* does not exist|Could not find the function/i.test(msg)) throw new Error('Falta instalar las sedes en la base de datos.')
    throw new Error(msg || 'Error desconocido')
  }
  return data
}

export const linkDeSede = slug => `${window.location.origin}/tienda/${slug}`

// ── Supervisor general (token de su sesión) ──
export const listarSedes   = token => rpc('limp_admin_listar_sedes', { p_token: token })
export const guardarSede   = (token, { id = null, nombre, activo = true }) =>
  rpc('limp_admin_guardar_sede', { p_token: token, p_id: id, p_nombre: nombre, p_activo: activo })
export const resetearSede  = (token, id) => rpc('limp_admin_resetear_sede', { p_token: token, p_id: id })

// ── App de la sede ──
export async function entrarSede(slug, password) {
  const r = await rpc('limp_sede_login', { p_slug: slug, p_password: password })
  if (r?.error) throw new Error(r.error)
  return r
}
export const sesionSede          = token => rpc('limp_sede_sesion', { p_token: token })
export const cambiarPasswordSede = (token, nueva) => rpc('limp_sede_cambiar_password', { p_token: token, p_nueva: nueva })
export const salirSede           = token => rpc('limp_sede_logout', { p_token: token })

// horarios: { mañana: { desde, hasta }, noche: { desde, hasta } } (solo los turnos que se usan)
export const guardarZona  = (token, { id = null, nombre, tareas, horarios }) =>
  rpc('limp_sede_guardar_zona', { p_token: token, p_id: id, p_nombre: nombre, p_tareas: tareas, p_horarios: horarios })
export const eliminarZona = (token, id) => rpc('limp_sede_eliminar_zona', { p_token: token, p_id: id })

export async function zonasDeSede(sedeId) {
  const { data, error } = await supabase
    .from('limpieza_zonas')
    .select('id, nombre, tareas, horarios')
    .eq('sede_id', sedeId)
    .eq('activo', true)
    .order('nombre')
  if (error) throw new Error(error.message)
  return data || []
}

// ── Personal de la sede: el personal fijo de MenuSoft cuyo sector es esta sede ──
const norm = t => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export async function personalDeSede(sedeNombre) {
  const { data, error } = await supabase
    .from('com_personal')
    .select('id, nombre, sector, turno, activo, "diaLibre", ausencias, "modoTurno", "horarioTodosInicio", "horariosPorDia"')
    .neq('activo', false)
    .order('nombre')
  if (error) throw new Error(error.message)
  return (data || []).filter(p => norm(p.sector) === norm(sedeNombre))
}

// ── Materiales de la sede ──
export async function materialesDeSede(sedeId) {
  const { data, error } = await supabase
    .from('limpieza_materiales')
    .select('id, nombre, cantidad, unidad, "fechaCompra", "fechaFin", "fechaReposicion"')
    .eq('sede_id', sedeId)
    .eq('activo', true)
    .order('nombre')
  if (error) throw new Error(error.message)
  return data || []
}
export const guardarMaterial  = (token, id, datos) => rpc('limp_sede_guardar_material', { p_token: token, p_id: id, p_datos: datos })
export const eliminarMaterial = (token, id) => rpc('limp_sede_eliminar_material', { p_token: token, p_id: id })

// ── Plan semanal de la sede ──
export async function asignacionesDeSede(zonaIds, desde, hasta) {
  if (zonaIds.length === 0) return []
  const { data, error } = await supabase
    .from('limpieza_asignaciones')
    .select('id, personal_id, zona_id, turno, fecha, "personalNombre"')
    .in('zona_id', zonaIds)
    .eq('activo', true)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha')
  if (error) throw new Error(error.message)
  return data || []
}
export const asignar = (token, { zonaId, personalId, turno, fechas }) =>
  rpc('limp_sede_asignar', { p_token: token, p_zona_id: zonaId, p_personal_id: personalId, p_turno: turno, p_fechas: fechas })
export const quitarAsignacion = (token, id) => rpc('limp_sede_quitar_asignacion', { p_token: token, p_id: id })
export const cambiarPersona   = (token, id, personalId) =>
  rpc('limp_sede_cambiar_persona', { p_token: token, p_id: id, p_personal_id: personalId })

// ── Compras de materiales de la tienda ──
export async function comprasDeSede(sedeId) {
  const { data, error } = await supabase
    .from('limpieza_compras')
    .select('id, material_id, fecha, paquetes, unidades_por_paquete, precio_paquete, nota')
    .eq('sede_id', sedeId)
    .order('fecha', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}
export const registrarCompra = (token, materialId, datos) =>
  rpc('limp_sede_registrar_compra', { p_token: token, p_material_id: materialId, p_datos: datos })
export const eliminarCompra = (token, id) => rpc('limp_sede_eliminar_compra', { p_token: token, p_id: id })
