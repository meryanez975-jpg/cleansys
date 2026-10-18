import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Inicio from './pages/Inicio'
import LoginSupervisor from './pages/LoginSupervisor'
import SemanaPlan from './pages/SemanaPlan'
import Materiales from './pages/Materiales'
import HistorialPersonal from './pages/HistorialPersonal'
import ControlCronometros from './pages/ControlCronometros'
import GestionPersonal from './pages/GestionPersonal'
import Sedes from './pages/Sedes'
import SedeApp from './pages/SedeApp'
import MarcarTienda, { RegistroCerrado, MarcarViejo } from './pages/MarcarTienda'

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
      {/* El registro general se cerró: cada tienda marca desde su link */}
      <Route path="/registro" element={<RegistroCerrado />} />
      <Route path="/marcar/:slug" element={<MarcarTienda />} />
      <Route path="/tienda/:slug/marcar" element={<MarcarViejo />} />
      <Route path="/historial" element={<HistorialPersonal />} />
      <Route path="/login-supervisor" element={<LoginSupervisor />} />
      {/* App de cada tienda: se entra con la contraseña de la tienda (/sede es el link anterior) */}
      <Route path="/tienda/:slug" element={<SedeApp />} />
      <Route path="/sede/:slug" element={<SedeApp />} />

      {/* Supervisor */}
      <Route path="/asignacion" element={<Navigate to="/semana" replace />} />
      <Route path="/asignacion/panel" element={<Navigate to="/semana" replace />} />
      <Route path="/semana" element={<Protegida><SemanaPlan /></Protegida>} />
      <Route path="/materiales" element={<Protegida><Materiales /></Protegida>} />
      <Route path="/control" element={<Protegida><ControlCronometros /></Protegida>} />
      {/* Las zonas las crea cada tienda; las tiendas se crean en Comidas → Administrador */}
      <Route path="/zonas" element={<Navigate to="/tiendas" replace />} />
      <Route path="/sedes" element={<Navigate to="/tiendas" replace />} />
      <Route path="/tiendas" element={<Protegida><Sedes /></Protegida>} />
      <Route path="/personal" element={<Protegida><GestionPersonal /></Protegida>} />
    </Routes>
  )
}
