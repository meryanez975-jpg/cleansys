import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { verificarPin } from '../data/store'

export default function PinModal({ onClose }) {
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
      onClose()
    } else {
      setError('PIN incorrecto')
      setPin('')
    }
  }

  const teclado = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <p className="modal-title">🔐 Ingreso Supervisor</p>

        <div className="pin-display">
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
          ))}
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', textAlign: 'center', fontSize: 13, marginBottom: 12 }}>
            {error}
          </p>
        )}

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

        <button className="btn btn-ghost btn-block" style={{ marginTop: 16 }} onClick={onClose}>
          Cancelar
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-light)', marginTop: 12 }}>
          PIN por defecto: 1234
        </p>
      </div>
    </div>
  )
}
