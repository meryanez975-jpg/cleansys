import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Registro from './pages/Registro'
import Asignacion from './pages/Asignacion'
import SemanaPlan from './pages/SemanaPlan'
import Materiales from './pages/Materiales'
import HistorialPersonal from './pages/HistorialPersonal'
import ControlCronometros from './pages/ControlCronometros'
import GestionZonas from './pages/GestionZonas'
import GestionPersonal from './pages/GestionPersonal'
import LoginSupervisor from './pages/LoginSupervisor'

function PrivateRoute({ children }) {
  const { supervisor } = useAuth()
  if (!supervisor) return <Navigate to="/login-supervisor" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login-supervisor" replace />} />
      <Route path="/login-supervisor" element={<LoginSupervisor />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/asignacion" element={<PrivateRoute><Navigate to="/semana" replace /></PrivateRoute>} />
      <Route path="/asignacion/panel" element={<PrivateRoute><Navigate to="/semana" replace /></PrivateRoute>} />
      <Route path="/semana" element={<PrivateRoute><SemanaPlan /></PrivateRoute>} />
      <Route path="/materiales" element={<PrivateRoute><Materiales /></PrivateRoute>} />
      <Route path="/historial" element={<PrivateRoute><HistorialPersonal /></PrivateRoute>} />
      <Route path="/control" element={<PrivateRoute><ControlCronometros /></PrivateRoute>} />
      <Route path="/zonas" element={<PrivateRoute><GestionZonas /></PrivateRoute>} />
      <Route path="/personal" element={<PrivateRoute><GestionPersonal /></PrivateRoute>} />
    </Routes>
  )
}
