import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listarSedes, guardarSede, resetearSede, linkDeSede, PASSWORD_INICIAL_SEDE } from '../lib/sedes'

// Supervisor general: crea las sedes y comparte el link de cada una.
// Las zonas y tareas las crea cada sede desde su app.
export default function Sedes() {
  const navigate = useNavigate()
  const { supervisor } = useAuth()
  const [sedes, setSedes]         = useState([])
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [nueva, setNueva]         = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando]   = useState(null)   // { id, nombre }
  const [confirmar, setConfirmar] = useState(null)   // { tipo: 'reset' | 'activo', sede }
  const [copiado, setCopiado]     = useState(null)   // id

  async function recargar() {
    try {
      setSedes(await listarSedes(supervisor.token))
      setError('')
    } catch (err) { setError(err.message) } finally { setCargando(false) }
  }
  useEffect(() => { recargar() }, [])

  async function crear(e) {
    e.preventDefault()
    if (!nueva.trim()) return
    setGuardando(true); setError('')
    try {
      await guardarSede(supervisor.token, { nombre: nueva })
      setNueva('')
      await recargar()
    } catch (err) { setError(err.message) } finally { setGuardando(false) }
  }

  async function renombrar(e) {
    e.preventDefault()
    const s = sedes.find(x => x.id === editando.id)
    setGuardando(true); setError('')
    try {
      await guardarSede(supervisor.token, { id: s.id, nombre: editando.nombre, activo: s.activo })
      setEditando(null)
      await recargar()
    } catch (err) { setError(err.message) } finally { setGuardando(false) }
  }

  async function confirmarAccion() {
    const { tipo, sede } = confirmar
    setConfirmar(null); setError('')
    try {
      if (tipo === 'reset') await resetearSede(supervisor.token, sede.id)
      else await guardarSede(supervisor.token, { id: sede.id, nombre: sede.nombre, activo: !sede.activo })
      await recargar()
    } catch (err) { setError(err.message) }
  }

  async function copiar(s) {
    try {
      await navigator.clipboard.writeText(linkDeSede(s.slug))
      setCopiado(s.id)
      setTimeout(() => setCopiado(null), 2000)
    } catch { window.prompt('Copiá el link:', linkDeSede(s.slug)) }
  }

  function compartir(s) {
    const texto = `🧼 CleaSys — Sede ${s.nombre}\n${linkDeSede(s.slug)}\nContraseña inicial: ${PASSWORD_INICIAL_SEDE} (la primera vez se cambia)`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div className="page">
      <div className="container">
        <div className="header">
          <button className="header-back" onClick={() => navigate('/')}>‹</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Sedes de limpieza</p>
            <p className="header-sub">Cada sede tiene su link y crea sus propias zonas y tareas</p>
          </div>
        </div>

        <form className="card" onSubmit={crear} style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>➕ Nueva sede</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Ej: Majoli" value={nueva}
              onChange={e => { setNueva(e.target.value); setError('') }} />
            <button type="submit" className="btn btn-primary" disabled={guardando || !nueva.trim()}>Crear</button>
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
            Contraseña inicial: <strong>{PASSWORD_INICIAL_SEDE}</strong> — la primera vez que entren se pide cambiarla.
          </p>
        </form>

        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}

        {cargando ? (
          [1, 2].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12, marginBottom: 12 }} />)
        ) : sedes.length === 0 ? (
          <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay sedes. Creá la primera arriba.</p>
        ) : sedes.map(s => (
          <div key={s.id} className="card" style={{ marginBottom: 12, opacity: s.activo ? 1 : 0.55 }}>
            {editando?.id === s.id ? (
              <form onSubmit={renombrar} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="input" style={{ flex: 1, minWidth: 0 }} value={editando.nombre} autoFocus
                  onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>✓</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>✕</button>
              </form>
            ) : (
              <div className="flex-between" style={{ marginBottom: 6 }}>
                <p style={{ fontWeight: 800, fontSize: 16 }}>📍 {s.nombre}</p>
                <button className="btn btn-ghost btn-sm" title="Renombrar" onClick={() => setEditando({ id: s.id, nombre: s.nombre })}>✏️</button>
              </div>
            )}
            <p className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
              {s.zonas} zona{s.zonas !== 1 ? 's' : ''} · {s.activo ? 'Activa' : 'Desactivada'} ·{' '}
              {s.debe_cambiar ? `🔑 Contraseña inicial (${PASSWORD_INICIAL_SEDE})` : '✅ Ya cambió la contraseña'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--primary-dark)', wordBreak: 'break-all', marginBottom: 10 }}>{linkDeSede(s.slug)}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={() => copiar(s)}>{copiado === s.id ? '✅ Copiado' : '🔗 Copiar link'}</button>
              <button className="btn btn-outline btn-sm" onClick={() => compartir(s)}>💬 WhatsApp</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmar({ tipo: 'reset', sede: s })}>🔑 Reiniciar contraseña</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmar({ tipo: 'activo', sede: s })}>{s.activo ? '⏸️ Desactivar' : '▶️ Activar'}</button>
            </div>
          </div>
        ))}
      </div>

      {confirmar && (
        <div className="modal-overlay" onClick={() => setConfirmar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">
              {confirmar.tipo === 'reset'
                ? `¿Reiniciar la contraseña de ${confirmar.sede.nombre}?`
                : `¿${confirmar.sede.activo ? 'Desactivar' : 'Activar'} ${confirmar.sede.nombre}?`}
            </p>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              {confirmar.tipo === 'reset'
                ? `Vuelve a ${PASSWORD_INICIAL_SEDE} y se cierra la sesión en sus celulares. Al entrar se pide cambiarla.`
                : confirmar.sede.activo
                  ? 'Su app deja de abrir y se cierra la sesión en sus celulares. No se borra nada.'
                  : 'Su app vuelve a abrir con su contraseña.'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmarAccion}>Sí</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmar(null)}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
