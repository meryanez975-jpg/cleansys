import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersonal } from '../hooks/usePersonal'

export default function GestionPersonal() {
  const navigate = useNavigate()
  const { personal, agregar, editar, eliminar } = usePersonal()

  const [nombre, setNombre]     = useState('')
  const [sector, setSector]     = useState('')
  const [editando, setEditando] = useState(null) // { id, nombre, sector }
  const [busqueda, setBusqueda] = useState('')
  const [error, setError]       = useState('')
  const [showForm, setShowForm] = useState(false)

  const filtrado = personal.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  function handleAgregar() {
    if (!nombre.trim()) { setError('Ingresá el nombre'); return }
    agregar(nombre, sector)
    setNombre(''); setSector(''); setError('')
    setShowForm(false)
  }

  function handleGuardarEdicion() {
    if (!editando?.nombre.trim()) return
    editar(editando.id, editando.nombre, editando.sector)
    setEditando(null)
  }

  function handleEliminar(id, nombrePersona) {
    if (!window.confirm(`¿Eliminar a ${nombrePersona}?`)) return
    eliminar(id)
  }

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Personal</p>
            <p className="header-sub">{personal.length} persona{personal.length !== 1 ? 's' : ''} registrada{personal.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            + Agregar
          </button>
        </div>

        {/* Formulario agregar */}
        {showForm && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>
              Nueva persona
            </p>
            <div className="input-group">
              <label className="input-label">Nombre completo *</label>
              <input
                className="input"
                placeholder="Ej: María García"
                value={nombre}
                onChange={e => { setNombre(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleAgregar()}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label className="input-label">Sector (opcional)</label>
              <input
                className="input"
                placeholder="Ej: Planta baja, Primer piso..."
                value={sector}
                onChange={e => setSector(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAgregar}>
                + Agregar
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setError('') }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Buscador */}
        {personal.length > 0 && (
          <input
            className="input"
            placeholder="Buscar persona..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ marginBottom: 12 }}
          />
        )}

        {/* Lista */}
        {personal.length === 0 ? (
          <div className="card text-center" style={{ padding: 40 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>👥</p>
            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Sin personal cargado</p>
            <p className="text-muted">Presioná "+ Agregar" para empezar</p>
          </div>
        ) : filtrado.length === 0 ? (
          <p className="text-muted text-center" style={{ padding: 20 }}>Sin resultados</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtrado.map(p => (
              <div key={p.id} className="card" style={{ padding: '14px 16px' }}>
                {editando?.id === p.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Nombre</label>
                      <input
                        className="input"
                        value={editando.nombre}
                        onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                        autoFocus
                      />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Sector</label>
                      <input
                        className="input"
                        placeholder="Sector (opcional)"
                        value={editando.sector}
                        onChange={e => setEditando({ ...editando, sector: e.target.value })}
                      />
                    </div>
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
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--primary)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 17,
                    }}>
                      {p.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{p.nombre}</p>
                      {p.sector && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.sector}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditando({ id: p.id, nombre: p.nombre, sector: p.sector || '' })}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleEliminar(p.id, p.nombre)}
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
