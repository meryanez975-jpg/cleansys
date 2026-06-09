import { createContext, useContext, useState } from 'react'
import { supabase } from '../supabase/client'

const CLAVE = 'cleansys_sesion'
const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [supervisor, setSupervisor] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CLAVE)) } catch { return null }
  })

  function loginWithEmail(sup) {
    localStorage.setItem(CLAVE, JSON.stringify(sup))
    setSupervisor(sup)
  }

  function logout() {
    localStorage.removeItem(CLAVE)
    setSupervisor(null)
    supabase.auth.signOut().catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ supervisor, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
