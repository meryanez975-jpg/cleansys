import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase/client'

export default function LoginSupervisor() {
  const navigate = useNavigate()
  const { supervisor, loginWithEmail } = useAuth()
  const [email, setEmail]       = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (supervisor) navigate('/asignacion', { replace: true })
  }, [supervisor])

  async function handleSubmit(e) {
    e.preventDefault()
    const correo = email.trim().toLowerCase()
    if (!correo) return
    setCargando(true); setError('')
    try {
      const { data } = await supabase
        .from('com_admins')
        .select('id, nombre, rol, email')
        .ilike('email', correo)
        .eq('activo', true)
        .single()

      if (!data) {
        setError('Este correo no tiene acceso a CleaSys.')
        return
      }
      if (data.rol !== 'cleansys') {
        setError('Este correo no tiene acceso a CleaSys.')
        return
      }
      loginWithEmail({ id: data.id, nombre: data.nombre, rol: data.rol, email: data.email })
    } catch {
      setError('Este correo no tiene acceso a CleaSys.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: 340 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 68, height: 68,
            background: 'var(--primary-light)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: 32,
          }}>🧹</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>CleaSys</h2>
          <p className="text-muted">Ingresá tu correo para entrar</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="tu@gmail.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            required
            style={{
              width: '100%', padding: '13px 16px', boxSizing: 'border-box',
              background: 'var(--bg-card)', border: '1.5px solid var(--border)',
              borderRadius: 12, color: 'var(--text)', fontSize: 15,
              outline: 'none',
            }}
          />

          {error && (
            <p style={{
              padding: '10px 14px',
              background: '#fee2e2', border: '1.5px solid #fecaca',
              borderRadius: 10, color: '#dc2626',
              fontSize: 13, fontWeight: 600, textAlign: 'center', margin: 0,
            }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando || !email.trim()}
            style={{
              width: '100%', padding: '13px 16px',
              background: 'var(--primary)', border: 'none',
              borderRadius: 12, color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              opacity: cargando || !email.trim() ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {cargando ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

      </div>
    </div>
  )
}
