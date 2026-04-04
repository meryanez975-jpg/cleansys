import { useState } from 'react'

export default function PersonalModal({ personal, onAgregar, onEditar, onEliminar, onClose }) {
  const [nombre, setNombre] = useState('')
  const [sector, setSector] = useState('')
  const [editando, setEditando] = useState(null) // { id, nombre, sector }
  const [loading, setLoading] = useState(false)

  function handleAgregar() {
    if (!nombre.trim()) return
    setLoading(true)
    onAgregar(nombre, sector)
    setNombre('')
    setSector('')
    setLoading(false)
  }

  function handleEditar() {
    if (!editando?.nombre.trim()) return
    onEditar(editando.id, editando.nombre, editando.sector)
    setEditando(null)
  }

  function handleEliminar(id, nombrePersona) {
    if (!window.confirm(`¿Eliminar a ${nombrePersona}?`)) return
    onEliminar(id)
  }

  function handleClose() {
    const formSucia = nombre.trim() !== '' || sector.trim() !== ''
    const editandoActivo = editando !== null
    if (formSucia || editandoActivo) {
      if (!window.confirm('Tenés cambios sin guardar. ¿Cerrar igual?')) return
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal"
        style={{ maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="modal-title">👥 Gestionar Personal</p>

        {/* Lista actual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, maxHeight: 280, overflowY: 'auto' }}>
          {personal.length === 0 && (
            <p className="text-muted text-center">Sin personal agregado aún</p>
          )}
          {personal.map(p => (
            <div key={p.id} style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
            }}>
              {editando?.id === p.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    className="input"
                    style={{ padding: '6px 10px', fontSize: 13 }}
                    placeholder="Nombre"
                    value={editando.nombre}
                    onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                    autoFocus
                  />
                  <input
                    className="input"
                    style={{ padding: '6px 10px', fontSize: 13 }}
                    placeholder="Sector (opcional)"
                    value={editando.sector}
                    onChange={e => setEditando({ ...editando, sector: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={handleEditar}>✓ Guardar</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{p.nombre}</p>
                    {p.sector && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.sector}</p>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditando({ id: p.id, nombre: p.nombre, sector: p.sector || '' })}
                  >✏️</button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleEliminar(p.id, p.nombre)}
                  >🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Agregar nuevo */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Agregar persona
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="input"
              placeholder="Nombre completo *"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
            />
            <input
              className="input"
              placeholder="Sector (opcional)"
              value={sector}
              onChange={e => setSector(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
            />
            <button
              className="btn btn-primary btn-block"
              onClick={handleAgregar}
              disabled={!nombre.trim() || loading}
            >
              + Agregar
            </button>
          </div>
        </div>

        <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={handleClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
