import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useZonas } from '../hooks/useZonas'
import * as store from '../data/store'

function getTareasMap() {
  try { return JSON.parse(localStorage.getItem('cleansys_zonas_tareas') || '{}') } catch { return {} }
}

export default function GestionZonas() {
  const navigate = useNavigate()
  const { zonas, crearZona, editarZona, desactivarZona } = useZonas()

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [editando, setEditando]       = useState(null)
  const [error, setError]             = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [expandidoTareas, setExpandidoTareas] = useState(null)
  const [nuevaTarea, setNuevaTarea]   = useState('')
  const [tareasMap, setTareasMap]     = useState(getTareasMap)

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

  function handleEliminar(id) {
    desactivarZona(id)
    setConfirmEliminar(null)
  }

  function agregarTarea(zona_id) {
    if (!nuevaTarea.trim()) return
    const actual = tareasMap[zona_id] || []
    const nueva = [...actual, nuevaTarea.trim()]
    store.setTareasZona(zona_id, nueva)
    setTareasMap({ ...tareasMap, [zona_id]: nueva })
    setNuevaTarea('')
  }

  function eliminarTarea(zona_id, idx) {
    const actual = tareasMap[zona_id] || []
    const nueva = actual.filter((_, i) => i !== idx)
    store.setTareasZona(zona_id, nueva)
    setTareasMap({ ...tareasMap, [zona_id]: nueva })
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
            {zonas.map(z => {
              const tareas = tareasMap[z.id] || []
              const expandido = expandidoTareas === z.id

              return (
                <div key={z.id} className="card" style={{ padding: '14px 16px' }}>

                  {/* Modo editar nombre */}
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

                  /* Modo confirmar eliminar */
                  ) : confirmEliminar === z.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                        ¿Desactivar la zona "{z.nombre}"?
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Las asignaciones existentes no se eliminarán.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleEliminar(z.id)}>
                          Sí, desactivar
                        </button>
                        <button className="btn btn-ghost" onClick={() => setConfirmEliminar(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>

                  /* Vista normal */
                  ) : (
                    <>
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
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {tareas.length === 0 ? 'Sin tareas definidas' : `${tareas.length} tarea${tareas.length !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => { setExpandidoTareas(expandido ? null : z.id); setNuevaTarea('') }}
                          >
                            {expandido ? '▲' : '+ Tareas'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditando({ id: z.id, nombre: z.nombre })}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirmEliminar(z.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>

                      {/* Panel tareas */}
                      {expandido && (
                        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                          <p style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
                          }}>
                            Tareas al finalizar limpieza
                          </p>

                          {tareas.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                              Sin tareas aún. Agregá la primera abajo.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                              {tareas.map((t, i) => (
                                <div key={i} style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  background: 'var(--primary-light)', borderRadius: 8, padding: '8px 12px',
                                }}>
                                  <span style={{ fontSize: 13, flex: 1, color: 'var(--text)', fontWeight: 500 }}>
                                    ☑ {t}
                                  </span>
                                  <button
                                    onClick={() => eliminarTarea(z.id, i)}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: 'var(--danger)', fontSize: 18, padding: 0, lineHeight: 1, fontWeight: 700,
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              className="input"
                              placeholder="Ej: Limpiar mesadas, Acomodar productos..."
                              value={nuevaTarea}
                              onChange={e => setNuevaTarea(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && agregarTarea(z.id)}
                              style={{ flex: 1, fontSize: 13 }}
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
          </div>
        )}
      </div>
    </div>
  )
}
