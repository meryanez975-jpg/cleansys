import { useState, useEffect, useCallback } from 'react'
import { zonasDeSede, personalDeSede, asignacionesDeSede } from '../../lib/sedes'
import { lunesDeSemana, sumarDias, hoyIso } from './fechas'
import VistaZonas from './VistaZonas'
import VistaPlan from './VistaPlan'
import VistaInventario from './VistaInventario'
import VistaPersonal from './VistaPersonal'

const VISTAS = [
  { id: 'zonas',      icono: '🧹', titulo: 'Zonas de limpieza', sub: 'Zonas, tareas y quién limpia' },
  { id: 'plan',       icono: '📅', titulo: 'Plan semanal',      sub: 'Quién limpia qué, por semana' },
  { id: 'inventario', icono: '📦', titulo: 'Inventario',        sub: 'Cuánto hay, agregar y usar' },
  { id: 'personal',   icono: '👥', titulo: 'Personal de la tienda', sub: 'Quiénes hacen limpieza aquí' },
]

// Panel de una sede: menú ☰ con sus secciones. Todo lo que se ve y se cambia
// aquí es solo de esta sede.
export default function PanelSede({ sesion, onSalir }) {
  const [vista, setVista]         = useState('zonas')
  const [menuAbierto, setMenu]    = useState(false)
  const [confirmarSalir, setConfirmarSalir] = useState(false)

  // Datos compartidos por las secciones
  const [zonas, setZonas]         = useState([])
  const [personal, setPersonal]   = useState([])
  const [avisos, setAvisos]       = useState([])   // asignaciones futuras sin persona válida
  const [error, setError]         = useState('')

  const sede = sesion.sede

  const recargarBase = useCallback(async () => {
    try {
      const [z, p] = await Promise.all([zonasDeSede(sede.id), personalDeSede(sede.nombre)])
      setZonas(z); setPersonal(p); setError('')
      // Avisos: tareas de hoy a 8 semanas cuya persona ya no está en la sede
      const hoy = hoyIso()
      const asig = await asignacionesDeSede(z.map(x => x.id), hoy, sumarDias(lunesDeSemana(0), 7 * 8))
      const ids = new Set(p.map(x => x.id))
      setAvisos(asig.filter(a => !ids.has(a.personal_id)))
    } catch (err) { setError(err.message) }
  }, [sede.id, sede.nombre])

  useEffect(() => { recargarBase() }, [recargarBase])

  const actual = VISTAS.find(v => v.id === vista)
  const comun = { sesion, zonas, personal, avisos, recargarBase }

  return (
    <div className="page">
      <div className="container">
        <div className="header">
          <button className="icon-btn" aria-label="Menú" onClick={() => setMenu(true)}>☰</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">{actual.icono} {actual.titulo}</p>
            <p className="header-sub">🏬 {sede.nombre}</p>
          </div>
        </div>

        {avisos.length > 0 && vista !== 'plan' && (
          <button onClick={() => setVista('plan')} style={{
            width: '100%', marginBottom: 12, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
            background: '#fef2f2', border: '1.5px solid #fecaca', color: '#b91c1c', fontWeight: 700, fontSize: 13, textAlign: 'left',
          }}>
            ⚠️ Hay {avisos.length} tarea{avisos.length !== 1 ? 's' : ''} sin persona (alguien ya no está). Tocá para cambiar.
          </button>
        )}

        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}

        {vista === 'zonas'      && <VistaZonas {...comun} />}
        {vista === 'plan'       && <VistaPlan {...comun} />}
        {vista === 'inventario' && <VistaInventario sesion={sesion} />}
        {vista === 'personal'   && <VistaPersonal personal={personal} sede={sede} zonas={zonas} />}
      </div>

      {menuAbierto && (
        <>
          <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.35)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: 280, maxWidth: '85vw', zIndex: 201,
            background: 'var(--bg-card)', boxShadow: '4px 0 24px rgba(59,130,246,0.15)', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ background: 'var(--primary-grad)', padding: '28px 20px 20px' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>🏬 {sede.nombre}</p>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>CleaSys — Tienda</p>
            </div>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {VISTAS.map(v => (
                <button key={v.id} onClick={() => { setVista(v.id); setMenu(false); recargarBase() }} style={{
                  display: 'flex', gap: 12, alignItems: 'center', padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                  border: 'none', textAlign: 'left', background: vista === v.id ? 'var(--primary-light)' : 'transparent',
                }}>
                  <span style={{ fontSize: 20 }}>{v.icono}</span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{v.titulo}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{v.sub}</span>
                  </span>
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
              <button onClick={() => { setMenu(false); setConfirmarSalir(true) }} style={{
                display: 'flex', gap: 12, alignItems: 'center', padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                border: 'none', textAlign: 'left', background: 'transparent',
              }}>
                <span style={{ fontSize: 20 }}>✏️</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </>
      )}

      {confirmarSalir && (
        <div className="modal-overlay" onClick={() => setConfirmarSalir(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">¿Cerrar sesión?</p>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>Después hay que volver a entrar con la contraseña de la tienda.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={onSalir}>Sí</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmarSalir(false)}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
