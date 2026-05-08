import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

const CLAVE = 'cleansys_sesion'
const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [supervisor, setSupervisor] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CLAVE)) } catch { return null }
  })
  const supRef = useRef(null)
  supRef.current = supervisor

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email && !supRef.current) {
        const { data } = await supabase
          .from('com_admins')
          .select('id, nombre, rol, email')
          .ilike('email', session.user.email)
          .eq('activo', true)
          .single()
        if (data) {
          const sup = { id: data.id, nombre: data.nombre, rol: data.rol, email: data.email }
          localStorage.setItem(CLAVE, JSON.stringify(sup))
          setSupervisor(sup)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  function login(sup) {
    localStorage.setItem(CLAVE, JSON.stringify(sup))
    setSupervisor(sup)
  }

  function logout() {
    localStorage.removeItem(CLAVE)
    setSupervisor(null)
    supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ supervisor, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
