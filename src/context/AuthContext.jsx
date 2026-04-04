import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [supervisor, setSupervisor] = useState({ id: 'supervisor', nombre: 'Supervisor' })

  function login(sup) {
    setSupervisor(sup)
  }

  function logout() {
    setSupervisor(null)
  }

  return (
    <AuthContext.Provider value={{ supervisor, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
