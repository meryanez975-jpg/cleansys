import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  entrarSede, sesionSede, cambiarPasswordSede, salirSede,
  zonasDeSede, guardarZona, eliminarZona,
} from '../lib/sedes'

// App de una sede (/sede/:slug): se entra con la contraseña de la sede y la
// sesión queda guardada en el celular. Cada sede maneja solo sus zonas.
const claveSesion = slug => `cleansys_sede_${slug}`

const estiloInput = {
  width: '100%', padding: '13px 16px', boxSizing: 'border-box',
  background: 'var(--bg-card)', border: '1.5px solid var(--border)',
  borderRadius: 12, color: 'var(--text)', fontSize: 16, outline: 'none',
}
const estiloError = {
  padding: '10px 14px', background: '#fee2e2', border: '1.5px solid #fecaca',
  borderRadius: 10, color: '#dc2626', fontSize: 13, fontWeight: 600, textAlign: 'center', margin: 0,
}

export default function SedeApp() {
  const { slug } = useParams()
  const [sesion, setSesion] = useState(() => {
    try { return JSON.parse(localStorage.getItem(claveSesion(slug))) } catch { return null }
  })

  function guardar(data) {
    try {
      if (data) localStorage.setItem(claveSesion(slug), JSON.stringify(data))
      else localStorage.removeItem(claveSesion(slug))
    } catch {}
    setSesion(data)
  }

  // Al abrir: confirmar que la sesión sigue valiendo (contraseña reiniciada
  // o sede desactivada → pide entrar de nuevo). Sin internet se mantiene.
  useEffect(() => {
    if (!sesion?.token) return
    sesionSede(sesion.token)
      .then(r => guardar({ ...sesion, sede: r.sede, debeCambiar: r.debe_cambiar }))
      .catch(err => { if (!/conexión/i.test(err.message)) guardar(null) })
  }, [])

  function salir() {
    if (sesion?.token) salirSede(sesion.token).catch(() => {})
    guardar(null)
  }

  if (!sesion) return <Entrar slug={slug} onEntrar={r => guardar({ token: r.token, sede: r.sede, debeCambiar: r.debe_cambiar })} />
  if (sesion.debeCambiar) return <NuevaPassword sesion={sesion} onListo={() => guardar({ ...sesion, debeCambiar: false })} onSalir={salir} />
  return <PanelSede sesion={sesion} onSalir={salir} />
}

function Encabezado({ titulo, sub }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{
        width: 68, height: 68, background: 'var(--primary-light)', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 32,
      }}>🧼</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{titulo}</h2>
      <p className="text-muted">{sub}</p>
    </div>
  )
}

function Entrar({ slug, onEntrar }) {
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')

  async function enviar(e) {
    e.preventDefault()
    setCargando(true); setError('')
    try { onEntrar(await entrarSede(slug, password)) }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }

  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: 340 }}>
        <Encabezado titulo="CleaSys" sub="Entrá con la contraseña de tu sede" />
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="password" autoComplete="current-password" placeholder="Contraseña de la sede" value={password}
            onChange={e => { setPassword(e.target.value); setError('') }} required style={estiloInput} />
          {error && <p style={estiloError}>{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={cargando || !password}>
            {cargando ? 'Verificando...' : 'Entrar'}
          </button>
          <p className="text-muted" style={{ fontSize: 12, textAlign: 'center' }}>
            ¿No la sabés? Pedísela al supervisor general.
          </p>
        </form>
      </div>
    </div>
  )
}

function NuevaPassword({ sesion, onListo, onSalir }) {
  const [nueva, setNueva]       = useState('')
  const [repetir, setRepetir]   = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')

  async function enviar(e) {
    e.preventDefault()
    if (nueva.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (nueva !== repetir) { setError('Las contraseñas no coinciden.'); return }
    setCargando(true); setError('')
    try { await cambiarPasswordSede(sesion.token, nueva); onListo() }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }

  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: 340 }}>
        <Encabezado titulo={`📍 ${sesion.sede?.nombre}`} sub="Primera vez: elegí la contraseña de la sede" />
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="password" autoComplete="new-password" placeholder="Contraseña nueva" value={nueva}
            onChange={e => { setNueva(e.target.value); setError('') }} required style={estiloInput} />
          <input type="password" autoComplete="new-password" placeholder="Repetir contraseña" value={repetir}
            onChange={e => { setRepetir(e.target.value); setError('') }} required style={estiloInput} />
          {error && <p style={estiloError}>{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={cargando || !nueva || !repetir}>
            {cargando ? 'Guardando...' : 'Guardar y entrar'}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onSalir}>Salir</button>
        </form>
      </div>
    </div>
  )
}

function PanelSede({ sesion, onSalir }) {
  const [zonas, setZonas]         = useState([])
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [editando, setEditando]   = useState(null)   // { id, nombre, tareas: [] } — id null = nueva
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [borrar, setBorrar]       = useState(null)   // zona
  const [confirmarSalir, setConfirmarSalir] = useState(false)

  async function recargar() {
    try { setZonas(await zonasDeSede(sesion.sede.id)); setError('') }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }
  useEffect(() => { recargar() }, [])

  function agregarTarea() {
    const t = nuevaTarea.trim()
    if (!t) return
    setEditando(p => ({ ...p, tareas: [...p.tareas, t] }))
    setNuevaTarea('')
  }

  async function guardarEdicion(e) {
    e.preventDefault()
    const tareas = nuevaTarea.trim() ? [...editando.tareas, nuevaTarea.trim()] : editando.tareas
    setGuardando(true); setError('')
    try {
      await guardarZona(sesion.token, { id: editando.id, nombre: editando.nombre, tareas })
      setEditando(null); setNuevaTarea('')
      await recargar()
    } catch (err) { setError(err.message) } finally { setGuardando(false) }
  }

  async function confirmarBorrar() {
    const z = borrar
    setBorrar(null); setError('')
    try { await eliminarZona(sesion.token, z.id); await recargar() }
    catch (err) { setError(err.message) }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="header">
          <div style={{ flex: 1 }}>
            <p className="header-title">📍 {sesion.sede?.nombre}</p>
            <p className="header-sub">Zonas de limpieza y sus tareas</p>
          </div>
          <button className="icon-btn" title="Sesión" onClick={() => setConfirmarSalir(true)}>✏️</button>
        </div>

        {error && <p style={{ ...estiloError, marginBottom: 12 }}>{error}</p>}

        {!editando && (
          <button className="btn btn-primary btn-block" style={{ marginBottom: 16 }}
            onClick={() => { setEditando({ id: null, nombre: '', tareas: [] }); setNuevaTarea('') }}>
            ➕ Nueva zona de limpieza
          </button>
        )}

        {editando && (
          <form className="card" onSubmit={guardarEdicion} style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{editando.id ? '✏️ Editar zona' : '➕ Nueva zona'}</p>
            <div className="input-group">
              <label className="input-label">Nombre de la zona</label>
              <input className="input" placeholder="Ej: Baño, Depósito, Escalera" value={editando.nombre} autoFocus
                onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Tareas que se realizan en esta zona</label>
              {editando.tareas.length === 0 && <p className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>Todavía no hay tareas.</p>}
              {editando.tareas.map((t, i) => (
                <div key={i} className="flex-between" style={{ padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>✓ {t}</span>
                  <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => setEditando(p => ({ ...p, tareas: p.tareas.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Ej: Sacar cartones" value={nuevaTarea}
                  onChange={e => setNuevaTarea(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarTarea() } }} />
                <button type="button" className="btn btn-outline" onClick={agregarTarea} disabled={!nuevaTarea.trim()}>+ Agregar</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={guardando || !editando.nombre.trim()}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setEditando(null); setNuevaTarea('') }}>Cancelar</button>
            </div>
          </form>
        )}

        {cargando ? (
          [1, 2].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12, marginBottom: 12 }} />)
        ) : zonas.length === 0 ? (
          <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay zonas. Creá la primera.</p>
        ) : zonas.map(z => (
          <div key={z.id} className="card" style={{ marginBottom: 12 }}>
            <div className="flex-between" style={{ marginBottom: 6 }}>
              <p style={{ fontWeight: 800, fontSize: 16 }}>🧹 {z.nombre}</p>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm" title="Editar"
                  onClick={() => { setEditando({ id: z.id, nombre: z.nombre, tareas: [...(z.tareas || [])] }); setNuevaTarea(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>✏️</button>
                <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => setBorrar(z)}>🗑️</button>
              </div>
            </div>
            {(z.tareas || []).length === 0
              ? <p className="text-muted" style={{ fontSize: 12 }}>Sin tareas cargadas</p>
              : (z.tareas || []).map((t, i) => <p key={i} style={{ fontSize: 14, padding: '2px 0' }}>✓ {t}</p>)}
          </div>
        ))}
      </div>

      {borrar && (
        <div className="modal-overlay" onClick={() => setBorrar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">¿Eliminar la zona {borrar.nombre}?</p>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>Lo que ya se registró en esta zona queda en el historial.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarBorrar}>Sí, eliminar</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setBorrar(null)}>No</button>
            </div>
          </div>
        </div>
      )}

      {confirmarSalir && (
        <div className="modal-overlay" onClick={() => setConfirmarSalir(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">¿Cerrar sesión?</p>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>Después hay que volver a entrar con la contraseña de la sede.</p>
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
