import { Routes, Route, Navigate } from 'react-router-dom'
import Registro from './pages/Registro'
import Asignacion from './pages/Asignacion'
import SemanaPlan from './pages/SemanaPlan'
import Materiales from './pages/Materiales'
import HistorialPersonal from './pages/HistorialPersonal'
import ControlCronometros from './pages/ControlCronometros'
import GestionZonas from './pages/GestionZonas'
import GestionPersonal from './pages/GestionPersonal'
import LoginSupervisor from './pages/LoginSupervisor'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login-supervisor" replace />} />
      <Route path="/login-supervisor" element={<LoginSupervisor />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/asignacion" element={<Navigate to="/semana" replace />} />
      <Route path="/asignacion/panel" element={<Navigate to="/semana" replace />} />
      <Route path="/semana" element={<SemanaPlan />} />
      <Route path="/materiales" element={<Materiales />} />
      <Route path="/historial" element={<HistorialPersonal />} />
      <Route path="/control" element={<ControlCronometros />} />
      <Route path="/zonas" element={<GestionZonas />} />
      <Route path="/personal" element={<GestionPersonal />} />
    </Routes>
  )
}
