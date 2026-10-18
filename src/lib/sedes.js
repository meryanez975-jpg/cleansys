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

export const linkDeSede = slug => `${window.location.origin}/sede/${slug}`

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

export const guardarZona  = (token, { id = null, nombre, tareas }) =>
  rpc('limp_sede_guardar_zona', { p_token: token, p_id: id, p_nombre: nombre, p_tareas: tareas })
export const eliminarZona = (token, id) => rpc('limp_sede_eliminar_zona', { p_token: token, p_id: id })

export async function zonasDeSede(sedeId) {
  const { data, error } = await supabase
    .from('limpieza_zonas')
    .select('id, nombre, tareas')
    .eq('sede_id', sedeId)
    .eq('activo', true)
    .order('nombre')
  if (error) throw new Error(error.message)
  return data || []
}
