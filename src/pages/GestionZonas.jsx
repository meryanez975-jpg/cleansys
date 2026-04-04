import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useZonas } from '../hooks/useZonas'

export default function GestionZonas() {
  const navigate = useNavigate()
  const { zonas, crearZona, editarZona, desactivarZona } = useZonas()

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [editando, setEditando]       = useState(null) // { id, nombre }
  const [error, setError]             = useState('')

  function handleCrear() {
    if (!nuevoNombre.trim()) { setError('Ingresá un nombre'); return }
    crearZona(nuevoNombre)
    setNuevoNombre('')
    setError('')
  }

  function handleGuardarEdicion() {
    if (!editando?.nombre.trim()) return
    editarZona(editando.id, editando.nombre)
    setEditando(null)
  }

  function handleEliminar(id, nombre) {
    if (!window.confirm(`¿Desactivar la zona "${nombre}"?`)) return
    desactivarZona(id)
  }

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Zonas de limpieza</p>
            <p className="header-sub">{zonas.length} zona{zonas.length !== 1 ? 's' : ''} activa{zonas.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Formulario agregar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>
            Agregar nueva zona
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Ej: Cocina, Depósito, Pasillo..."
              value={nuevoNombre}
              onChange={e => { setNuevoNombre(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleCrear()}
              style={{ flex: 1 }}
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={handleCrear}
              disabled={!nuevoNombre.trim()}
            >
              + Agregar
            </button>
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>

        {/* Lista de zonas */}
        {zonas.length === 0 ? (
          <div className="card text-center" style={{ padding: 40 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🏢</p>
            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Sin zonas cargadas</p>
            <p className="text-muted">Agregá la primera zona arriba</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {zonas.map(z => (
              <div key={z.id} className="card" style={{ padding: '14px 16px' }}>
                {editando?.id === z.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      className="input"
                      value={editando.nombre}
                      onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleGuardarEdicion()}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-success" style={{ flex: 1 }} onClick={handleGuardarEdicion}>
                        ✓ Guardar
                      </button>
                      <button className="btn btn-ghost" onClick={() => setEditando(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                      background: 'var(--primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      🏢
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{z.nombre}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditando({ id: z.id, nombre: z.nombre })}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleEliminar(z.id, z.nombre)}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
