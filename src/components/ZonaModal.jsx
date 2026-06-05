import { useState } from 'react'
import { getTareasZona, setTareasZona } from '../data/store'

export default function ZonaModal({ zonas, onCrear, onEditar, onEliminar, onClose }) {
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [editando, setEditando]       = useState(null)
  const [loading, setLoading]         = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [expandidoTareas, setExpandidoTareas] = useState(null)
  const [nuevaTarea, setNuevaTarea]   = useState('')
  const [tareasMap, setTareasMap]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('cleansys_zonas_tareas') || '{}') } catch { return {} }
  })

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
    setLoading(true)
    await onEliminar(id)
    setConfirmEliminar(null)
    setLoading(false)
  }

  function agregarTarea(zona_id) {
    if (!nuevaTarea.trim()) return
    const actual = tareasMap[zona_id] || []
    const nueva = [...actual, nuevaTarea.trim()]
    setTareasZona(zona_id, nueva)
    setTareasMap({ ...tareasMap, [zona_id]: nueva })
    setNuevaTarea('')
  }

  function eliminarTarea(zona_id, idx) {
    const actual = tareasMap[zona_id] || []
    const nueva = actual.filter((_, i) => i !== idx)
    setTareasZona(zona_id, nueva)
    setTareasMap({ ...tareasMap, [zona_id]: nueva })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <p className="modal-title">🧹 Gestionar Zonas</p>

        {/* Lista de zonas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, maxHeight: 420, overflowY: 'auto' }}>
          {zonas.map(z => {
            const tareas   = tareasMap[z.id] || []
            const expandido = expandidoTareas === z.id

            return (
              <div key={z.id} style={{
                background: 'var(--bg)', borderRadius: 10,
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}>
                {/* Modo editar nombre */}
                {editando?.id === z.id ? (
                  <div style={{ display: 'flex', gap: 8, padding: '8px 12px', alignItems: 'center' }}>
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
                  </div>

                /* Modo confirmar eliminar */
                ) : confirmEliminar === z.id ? (
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>¿Desactivar "{z.nombre}"?</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleEliminar(z.id)} disabled={loading}>
                        Sí, desactivar
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmEliminar(null)}>Cancelar</button>
                    </div>
                  </div>

                /* Vista normal */
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>🏢 {z.nombre}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {tareas.length > 0 ? `${tareas.length} tarea${tareas.length !== 1 ? 's' : ''}` : ''}
                      </span>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => { setExpandidoTareas(expandido ? null : z.id); setNuevaTarea('') }}
                      >
                        {expandido ? '▲' : '+ Tareas'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditando({ id: z.id, nombre: z.nombre })}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmEliminar(z.id)}>🗑</button>
                    </div>

                    {/* Panel tareas */}
                    {expandido && (
                      <div style={{
                        borderTop: '1px solid var(--border)',
                        padding: '10px 12px',
                        background: 'var(--bg-card)',
                      }}>
                        <p style={{
                          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
                        }}>
                          Tareas al finalizar limpieza
                        </p>

                        {tareas.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                            Sin tareas. Agregá la primera abajo.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                            {tareas.map((t, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: 'var(--primary-light)', borderRadius: 7, padding: '6px 10px',
                              }}>
                                <span style={{ fontSize: 12, flex: 1, color: 'var(--text)' }}>☑ {t}</span>
                                <button
                                  onClick={() => eliminarTarea(z.id, i)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--danger)', fontSize: 17, padding: 0, lineHeight: 1, fontWeight: 700,
                                  }}
                                >×</button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="input"
                            placeholder="Ej: Limpiar mesadas..."
                            value={nuevaTarea}
                            onChange={e => setNuevaTarea(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && agregarTarea(z.id)}
                            style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => agregarTarea(z.id)}
                            disabled={!nuevaTarea.trim()}
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}

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

        <button className="btn btn-ghost btn-block" style={{ marginTop: 16 }} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
