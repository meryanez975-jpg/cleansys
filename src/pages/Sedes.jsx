import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listarSedes, resetearSede, linkDeSede, linkMarcar, PASSWORD_INICIAL_SEDE } from '../lib/sedes'

// Supervisor de limpieza: ve las tiendas y comparte el link de cada una.
// Las tiendas se crean en Comidas → Administrador → 🏬 Tiendas; las zonas
// y tareas las crea cada tienda desde su app.
export default function Sedes() {
  const navigate = useNavigate()
  const { supervisor } = useAuth()
  const [sedes, setSedes]         = useState([])
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [confirmar, setConfirmar] = useState(null)   // { sede } a la que se le reinicia la contraseña
  const [copiado, setCopiado]     = useState(null)   // id

  async function recargar() {
    try {
      setSedes(await listarSedes(supervisor.token))
      setError('')
    } catch (err) { setError(err.message) } finally { setCargando(false) }
  }
  useEffect(() => { recargar() }, [])

  async function confirmarAccion() {
    const { sede } = confirmar
    setConfirmar(null); setError('')
    try {
      await resetearSede(supervisor.token, sede.id)
      await recargar()
    } catch (err) { setError(err.message) }
  }

  async function copiar(s, link = linkDeSede(s.slug), clave = s.id) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(clave)
      setTimeout(() => setCopiado(null), 2000)
    } catch { window.prompt('Copiá el link:', link) }
  }

  function compartir(s) {
    const texto = `🧼 CleaSys — ${s.nombre}\n${linkDeSede(s.slug)}\nContraseña inicial: ${PASSWORD_INICIAL_SEDE} (la primera vez se cambia)`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div className="page">
      <div className="container">
        <div className="header">
          <button className="header-back" onClick={() => navigate('/')}>‹</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">🏬 Tiendas</p>
            <p className="header-sub">Se crean en Comidas → Administrador. Aquí está el link de cada una.</p>
          </div>
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}

        {cargando ? (
          [1, 2].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12, marginBottom: 12 }} />)
        ) : sedes.length === 0 ? (
          <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay tiendas. Se crean en Comidas → Administrador → 🏬 Tiendas.</p>
        ) : sedes.map(s => (
          <div key={s.id} className="card" style={{ marginBottom: 12, opacity: s.activo ? 1 : 0.55 }}>
            <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>🏬 {s.nombre}</p>
            <p className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
              {s.zonas} zona{s.zonas !== 1 ? 's' : ''} · {s.activo ? 'Activa' : 'Desactivada'} ·{' '}
              {s.debe_cambiar ? `🔑 Contraseña inicial (${PASSWORD_INICIAL_SEDE})` : '✅ Ya cambió la contraseña'}
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>🔑 Encargada (con contraseña)</p>
            <p style={{ fontSize: 12, color: 'var(--primary-dark)', wordBreak: 'break-all', marginBottom: 8 }}>{linkDeSede(s.slug)}</p>
            <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>🧹 Para marcar (celular fijo, sin contraseña)</p>
            <p style={{ fontSize: 12, color: 'var(--primary-dark)', wordBreak: 'break-all', marginBottom: 6 }}>{linkMarcar(s.slug)}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={() => copiar(s, linkMarcar(s.slug), s.id + '-m')}>{copiado === s.id + '-m' ? '✅ Copiado' : '🧹 Copiar link para marcar'}</button>
              <button className="btn btn-outline btn-sm" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🧹 Marcar limpieza — ${s.nombre}
${linkMarcar(s.slug)}
(Abrilo en el celular de la tienda y tocá "Agregar a pantalla de inicio")`)}`, '_blank')}>💬 WhatsApp</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={() => copiar(s)}>{copiado === s.id ? '✅ Copiado' : '🔗 Copiar link'}</button>
              <button className="btn btn-outline btn-sm" onClick={() => compartir(s)}>💬 WhatsApp</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmar({ sede: s })}>🔑 Reiniciar contraseña</button>
            </div>
          </div>
        ))}
      </div>

      {confirmar && (
        <div className="modal-overlay" onClick={() => setConfirmar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">¿Reiniciar la contraseña de {confirmar.sede.nombre}?</p>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Vuelve a {PASSWORD_INICIAL_SEDE} y se cierra la sesión en sus celulares. Al entrar se pide cambiarla.
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
