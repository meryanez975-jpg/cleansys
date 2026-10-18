import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { entrarSede, sesionSede, cambiarPasswordSede, salirSede, usarManifiestoTienda } from '../lib/sedes'
import PanelSede from './sede/PanelSede'

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
  // Para instalar la app de la encargada con el nombre de la tienda
  useEffect(() => { usarManifiestoTienda(slug) }, [slug])

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
        <Encabezado titulo="CleaSys" sub="Entrá con la contraseña de tu tienda" />
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="password" autoComplete="current-password" placeholder="Contraseña de la tienda" value={password}
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
        <Encabezado titulo={`🏬 ${sesion.sede?.nombre}`} sub="Primera vez: elegí la contraseña de la tienda" />
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
