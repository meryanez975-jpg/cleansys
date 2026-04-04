import { Routes, Route, Navigate } from 'react-router-dom'
import Registro from './pages/Registro'
import Asignacion from './pages/Asignacion'
import SemanaPlan from './pages/SemanaPlan'
import Materiales from './pages/Materiales'
import HistorialPersonal from './pages/HistorialPersonal'
import GestionZonas from './pages/GestionZonas'
import GestionPersonal from './pages/GestionPersonal'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/registro" replace />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/asignacion" element={<Asignacion />} />
      <Route path="/semana" element={<SemanaPlan />} />
      <Route path="/materiales" element={<Materiales />} />
      <Route path="/historial" element={<HistorialPersonal />} />
      <Route path="/zonas" element={<GestionZonas />} />
      <Route path="/personal" element={<GestionPersonal />} />
    </Routes>
  )
}
