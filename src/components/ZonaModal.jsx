import { useState } from 'react'

export default function ZonaModal({ zonas, onCrear, onEditar, onEliminar, onClose }) {
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [editando, setEditando] = useState(null) // { id, nombre }
  const [loading, setLoading] = useState(false)

  async function handleCrear() {
    if (!nuevoNombre.trim()) return
    setLoading(true)
    await onCrear(nuevoNombre)
    setNuevoNombre('')
    setLoading(false)
  }

  async function handleEditar() {
    if (!editando?.nombre.trim()) return
    setLoading(true)
    await onEditar(editando.id, editando.nombre)
    setEditando(null)
    setLoading(false)
  }

  async function handleEliminar(id) {
    if (!window.confirm('¿Desactivar esta zona?')) return
    setLoading(true)
    await onEliminar(id)
    setLoading(false)
  }

  function handleClose() {
    if (nuevoNombre.trim() !== '' || editando !== null) {
      if (!window.confirm('Tenés cambios sin guardar. ¿Cerrar igual?')) return
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <p className="modal-title">🧹 Gestionar Zonas</p>

        {/* Lista de zonas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, maxHeight: 260, overflowY: 'auto' }}>
          {zonas.map(z => (
            <div key={z.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg)', borderRadius: 8, padding: '8px 12px',
              border: '1px solid var(--border)'
            }}>
              {editando?.id === z.id ? (
                <>
                  <input
                    className="input"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                    value={editando.nombre}
                    onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && handleEditar()}
                    autoFocus
                  />
                  <button className="btn btn-success btn-sm" onClick={handleEditar} disabled={loading}>✓</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>🏢 {z.nombre}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditando({ id: z.id, nombre: z.nombre })}>✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(z.id)}>🗑</button>
                </>
              )}
            </div>
          ))}
          {zonas.length === 0 && (
            <p className="text-muted text-center">Sin zonas activas</p>
          )}
        </div>

        {/* Agregar nueva zona */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Nueva zona (ej: Cocina)"
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCrear()}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleCrear}
            disabled={!nuevoNombre.trim() || loading}
          >
            + Agregar
          </button>
        </div>

        <button className="btn btn-ghost btn-block" style={{ marginTop: 16 }} onClick={handleClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
