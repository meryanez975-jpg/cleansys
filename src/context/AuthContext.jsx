import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

const CLAVE = 'cleansys_sesion'
const ROLES = ['cleansys', 'admin']   // quiénes pueden usar las pantallas del supervisor
const AuthContext = createContext()

// Login propio (usuarios creados en Comidas → Usuarios). Las contraseñas y
// sesiones viven en tablas cerradas; todo pasa por funciones de la base.
async function rpc(nombre, params) {
  const { data, error } = await supabase.rpc(nombre, params)
  if (error) {
    const msg = error.message || ''
    throw new Error(/fetch|network/i.test(msg) ? 'Sin conexión. Revisá el internet e intentá de nuevo.' : msg)
  }
  return data
}

export function AuthProvider({ children }) {
  const [supervisor, setSupervisor] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CLAVE)) } catch { return null }
  })

  function guardar(data) {
    if (data) localStorage.setItem(CLAVE, JSON.stringify(data))
    else localStorage.removeItem(CLAVE)
    setSupervisor(data)
  }

  // Al abrir: confirmar que la sesión sigue valiendo. Las de antes (solo
  // correo, sin token) se descartan y hay que entrar con contraseña.
  useEffect(() => {
    if (!supervisor) return
    if (!supervisor.token) { guardar(null); return }
    rpc('sesion_actual', { p_token: supervisor.token })
      .then(u => {
        if (!u || !ROLES.includes(u.rol)) guardar(null)
        else guardar({ ...supervisor, nombre: u.nombre, rol: u.rol, email: u.email, debeCambiar: u.debe_cambiar })
      })
      .catch(() => { /* sin conexión: se mantiene la sesión guardada */ })
  }, [])

  async function login(email, password) {
    const u = await rpc('login_usuario', { p_email: email, p_password: password })
    if (u?.error) throw new Error(u.error)
    if (!ROLES.includes(u.rol)) {
      await rpc('logout_usuario', { p_token: u.token }).catch(() => {})
      throw new Error('Este correo no tiene acceso a CleaSys.')
    }
    guardar({ token: u.token, id: u.id, nombre: u.nombre, rol: u.rol, email: u.email, debeCambiar: u.debe_cambiar })
  }

  async function cambiarPassword(nueva) {
    await rpc('cambiar_password', { p_token: supervisor.token, p_nueva: nueva })
    guardar({ ...supervisor, debeCambiar: false })
  }

  function logout() {
    if (supervisor?.token) rpc('logout_usuario', { p_token: supervisor.token }).catch(() => {})
    guardar(null)
  }

  return (
    <AuthContext.Provider value={{ supervisor, login, cambiarPassword, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
