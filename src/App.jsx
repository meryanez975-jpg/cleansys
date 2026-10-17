import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Inicio from './pages/Inicio'
import Registro from './pages/Registro'
import LoginSupervisor from './pages/LoginSupervisor'
import SemanaPlan from './pages/SemanaPlan'
import Materiales from './pages/Materiales'
import HistorialPersonal from './pages/HistorialPersonal'
import ControlCronometros from './pages/ControlCronometros'
import GestionZonas from './pages/GestionZonas'
import GestionPersonal from './pages/GestionPersonal'

// Pantallas del supervisor: piden iniciar sesión con correo y contraseña
function Protegida({ children }) {
  const { supervisor } = useAuth()
  const location = useLocation()
  if (!supervisor || supervisor.debeCambiar) {
    return <Navigate to="/login-supervisor" replace state={{ desde: location.pathname + location.search }} />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Públicas: el personal marca su limpieza; el historial se ve desde el panel Sistema */}
      <Route path="/" element={<Inicio />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/historial" element={<HistorialPersonal />} />
      <Route path="/login-supervisor" element={<LoginSupervisor />} />

      {/* Supervisor */}
      <Route path="/asignacion" element={<Navigate to="/semana" replace />} />
      <Route path="/asignacion/panel" element={<Navigate to="/semana" replace />} />
      <Route path="/semana" element={<Protegida><SemanaPlan /></Protegida>} />
      <Route path="/materiales" element={<Protegida><Materiales /></Protegida>} />
      <Route path="/control" element={<Protegida><ControlCronometros /></Protegida>} />
      <Route path="/zonas" element={<Protegida><GestionZonas /></Protegida>} />
      <Route path="/personal" element={<Protegida><GestionPersonal /></Protegida>} />
    </Routes>
  )
}
