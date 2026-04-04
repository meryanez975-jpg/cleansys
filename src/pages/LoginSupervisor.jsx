import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { verificarPin } from '../data/store'

export default function LoginSupervisor() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handlePress(val) {
    if (pin.length >= 4) return
    const nuevo = pin + val
    setPin(nuevo)
    setError('')
    if (nuevo.length === 4) {
      setTimeout(() => chequear(nuevo), 150)
    }
  }

  function borrar() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  function chequear(pinValor) {
    const sup = verificarPin(pinValor)
    if (sup) {
      login(sup)
      navigate('/asignacion/panel')
    } else {
      setError('PIN incorrecto')
      setPin('')
    }
  }

  const teclado = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: 340 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 68, height: 68,
            background: 'var(--primary-light)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            fontSize: 32
          }}>
            🔐
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            Acceso Supervisor
          </h2>
          <p className="text-muted">Ingresá tu PIN de 4 dígitos</p>
        </div>

        {/* PIN dots */}
        <div className="pin-display" style={{ marginBottom: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} style={{ width: 18, height: 18 }} />
          ))}
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', textAlign: 'center', fontSize: 14, marginBottom: 16, fontWeight: 600 }}>
            {error}
          </p>
        )}

        {/* Teclado */}
        <div className="pin-grid">
          {teclado.map((k, i) =>
            k === '' ? (
              <div key={i} />
            ) : k === '⌫' ? (
              <button key={i} className="pin-btn del" onClick={borrar}>{k}</button>
            ) : (
              <button key={i} className="pin-btn" onClick={() => handlePress(k)}>{k}</button>
            )
          )}
        </div>

        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 20 }}
          onClick={() => navigate('/registro')}
        >
          Ir a Registro
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-light)', marginTop: 14 }}>
          PIN por defecto: 1234
        </p>
      </div>
    </div>
  )
}
