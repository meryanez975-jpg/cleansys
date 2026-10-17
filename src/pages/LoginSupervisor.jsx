import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const estiloInput = {
  width: '100%', padding: '13px 16px', boxSizing: 'border-box',
  background: 'var(--bg-card)', border: '1.5px solid var(--border)',
  borderRadius: 12, color: 'var(--text)', fontSize: 16,
  outline: 'none',
}

const estiloError = {
  padding: '10px 14px',
  background: '#fee2e2', border: '1.5px solid #fecaca',
  borderRadius: 10, color: '#dc2626',
  fontSize: 13, fontWeight: 600, textAlign: 'center', margin: 0,
}

function estiloBoton(deshabilitado) {
  return {
    width: '100%', padding: '13px 16px',
    background: 'var(--primary)', border: 'none',
    borderRadius: 12, color: '#fff',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    opacity: deshabilitado ? 0.6 : 1,
    transition: 'opacity 0.15s',
  }
}

function Encabezado({ icono, titulo, sub }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{
        width: 68, height: 68,
        background: 'var(--primary-light)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px', fontSize: 32,
      }}>{icono}</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{titulo}</h2>
      <p className="text-muted">{sub}</p>
    </div>
  )
}

export default function LoginSupervisor() {
  const navigate = useNavigate()
  const location = useLocation()
  const { supervisor, login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')

  const destino = location.state?.desde || '/semana'

  useEffect(() => {
    if (supervisor && !supervisor.debeCambiar) navigate(destino, { replace: true })
  }, [supervisor])

  async function handleSubmit(e) {
    e.preventDefault()
    setCargando(true); setError('')
    try { await login(email, password) }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }

  if (supervisor?.debeCambiar) return <CambiarPassword />

  const deshabilitado = cargando || !email.trim() || !password
  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: 340 }}>
        <Encabezado icono="🧹" titulo="CleaSys" sub="Acceso del supervisor" />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" autoComplete="username" placeholder="Correo" value={email}
            onChange={e => { setEmail(e.target.value); setError('') }} required style={estiloInput} />
          <input type="password" autoComplete="current-password" placeholder="Contraseña" value={password}
            onChange={e => { setPassword(e.target.value); setError('') }} required style={estiloInput} />

          {error && <p style={estiloError}>{error}</p>}

          <button type="submit" disabled={deshabilitado} style={estiloBoton(deshabilitado)}>
            {cargando ? 'Verificando...' : 'Entrar'}
          </button>
          <p className="text-muted" style={{ fontSize: 12, textAlign: 'center' }}>
            ¿Olvidaste tu contraseña? Pedile al administrador que te asigne una nueva.
          </p>
        </form>
      </div>
    </div>
  )
}

// Primer ingreso (o contraseña puesta por el admin): hay que elegir una propia
function CambiarPassword() {
  const { supervisor, cambiarPassword, logout } = useAuth()
  const [nueva, setNueva]       = useState('')
  const [repetir, setRepetir]   = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (nueva.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (nueva !== repetir) { setError('Las contraseñas no coinciden.'); return }
    setCargando(true); setError('')
    try { await cambiarPassword(nueva) }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }

  const deshabilitado = cargando || !nueva || !repetir
  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: 340 }}>
        <Encabezado icono="🔑" titulo="Nueva contraseña" sub={`Hola ${supervisor?.nombre || ''}, elegí tu propia contraseña para continuar`} />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="password" autoComplete="new-password" placeholder="Contraseña nueva" value={nueva}
            onChange={e => { setNueva(e.target.value); setError('') }} required style={estiloInput} />
          <input type="password" autoComplete="new-password" placeholder="Repetir contraseña" value={repetir}
            onChange={e => { setRepetir(e.target.value); setError('') }} required style={estiloInput} />

          {error && <p style={estiloError}>{error}</p>}

          <button type="submit" disabled={deshabilitado} style={estiloBoton(deshabilitado)}>
            {cargando ? 'Guardando...' : 'Guardar y entrar'}
          </button>
          <button type="button" onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', padding: 8 }}>
            Salir
          </button>
        </form>
      </div>
    </div>
  )
}
