import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMateriales } from '../hooks/useMateriales'
import { useGuardiaNavegacion } from '../hooks/useGuardiaNavegacion'
import ModalConfirmSalida from '../components/ModalConfirmSalida'

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function estadoMaterial(fechaReposicion) {
  if (!fechaReposicion) return null
  const diff = (new Date(fechaReposicion) - new Date(hoy())) / (1000 * 60 * 60 * 24)
  if (diff < 0)  return { label: 'Vencido',   color: 'var(--danger)',  bg: 'var(--danger-light)' }
  if (diff <= 7) return { label: 'Reponer',    color: 'var(--warning)', bg: 'var(--warning-light)' }
  return           { label: 'En stock',       color: 'var(--success)', bg: 'var(--success-light)' }
}

const UNIDADES = ['unidad', 'litros', 'kg', 'paquete', 'caja', 'rollo', 'bolsa']

export default function Materiales() {
  const navigate = useNavigate()
  const { materiales, agregar, editar, eliminar } = useMateriales()

  const [hayCambios, setHayCambios]     = useState(false)
  const [guardadoOk, setGuardadoOk]     = useState(false)
  const { navegarConGuardia, showConfirm, confirmar, cancelar } = useGuardiaNavegacion(hayCambios)

  const [showForm, setShowForm]         = useState(false)
  const [editando, setEditando]         = useState(null)
  const [nombre, setNombre]             = useState('')
  const [sector, setSector]             = useState('')
  const [cantidad, setCantidad]         = useState('')
  const [unidad, setUnidad]             = useState('unidad')
  const [fechaCompra, setFechaCompra]   = useState(hoy())
  const [fechaRepos, setFechaRepos]     = useState('')
  const [foto, setFoto]                 = useState(null) // base64
  const [error, setError]               = useState('')

  function abrirNuevo() {
    setEditando(null)
    setNombre(''); setSector(''); setCantidad(''); setUnidad('unidad')
    setFechaCompra(hoy()); setFechaRepos(''); setFoto(null); setError('')
    setShowForm(true)
  }

  function abrirEditar(m) {
    setEditando(m)
    setNombre(m.nombre); setSector(m.sector || ''); setCantidad(String(m.cantidad)); setUnidad(m.unidad || 'unidad')
    setFechaCompra(m.fechaCompra || hoy()); setFechaRepos(m.fechaReposicion || '')
    setFoto(m.foto || null); setError(''); setShowForm(true)
  }

  function handleFoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setFoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleGuardarForm() {
    if (!nombre.trim()) { setError('Ingresá el nombre del material'); return }
    if (!cantidad) { setError('Ingresá la cantidad'); return }
    if (editando) {
      editar(editando.id, { nombre: nombre.trim(), sector: sector.trim(), cantidad, unidad, fechaCompra, fechaReposicion: fechaRepos, foto })
    } else {
      agregar(nombre, sector, cantidad, unidad, fechaCompra, fechaRepos, foto)
    }
    setHayCambios(true)
    setGuardadoOk(false)
    setShowForm(false)
  }

  function handleEliminar(id) {
    if (!window.confirm('¿Eliminar este material?')) return
    eliminar(id)
    setHayCambios(true)
    setGuardadoOk(false)
  }

  function handleGuardarTodo() {
    setGuardadoOk(true)
    setHayCambios(false)
    setTimeout(() => setGuardadoOk(false), 3000)
  }

  const vencidos  = materiales.filter(m => estadoMaterial(m.fechaReposicion)?.label === 'Vencido').length
  const reponer   = materiales.filter(m => estadoMaterial(m.fechaReposicion)?.label === 'Reponer').length

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navegarConGuardia(() => navigate('/asignacion'))}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Material de limpieza</p>
            <p className="header-sub">Inventario y reposición</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>+ Agregar</button>
        </div>

        {/* Alertas resumen */}
        {(vencidos > 0 || reponer > 0) && (
          <div style={{
            background: vencidos > 0 ? 'var(--danger-light)' : 'var(--warning-light)',
            border: `1px solid ${vencidos > 0 ? 'var(--danger)' : 'var(--warning)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: vencidos > 0 ? 'var(--danger)' : 'var(--warning)',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <span>{vencidos > 0 ? '🔴' : '🟡'}</span>
            <span>
              {vencidos > 0 && `${vencidos} material${vencidos > 1 ? 'es' : ''} vencido${vencidos > 1 ? 's' : ''}. `}
              {reponer > 0 && `${reponer} para reponer pronto.`}
            </span>
          </div>
        )}

        {/* Lista */}
        {materiales.length === 0 ? (
          <div className="card text-center" style={{ padding: 48 }}>
            <p style={{ fontSize: 40, marginBottom: 14 }}>🧴</p>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>
              Sin materiales cargados
            </p>
            <p className="text-muted">Presioná "+ Agregar" para empezar el inventario</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {materiales.map(m => {
              const estado = estadoMaterial(m.fechaReposicion)
              return (
                <div
                  key={m.id}
                  className="card"
                  style={{
                    borderLeft: `4px solid ${estado?.color || 'var(--border)'}`,
                    padding: '14px 16px',
                  }}
                >
                  <div className="flex-between">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                          {m.nombre}
                        </span>
                        {m.sector && (
                          <span style={{ fontSize: 11, fontWeight: 700, background: '#ede9fe', color: '#6d28d9', borderRadius: 999, padding: '2px 10px' }}>
                            {m.sector}
                          </span>
                        )}
                        {estado && (
                          <span style={{
                            background: estado.bg,
                            color: estado.color,
                            fontSize: 11, fontWeight: 700,
                            borderRadius: 999, padding: '2px 10px',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            {estado.label}
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                        📦 {m.cantidad} {m.unidad}
                      </p>

                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-light)', flexWrap: 'wrap' }}>
                        {m.fechaCompra && (
                          <span>
                            🛒 Compra:{' '}
                            {new Date(m.fechaCompra + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {m.fechaReposicion && (
                          <span>
                            🔄 Reponer:{' '}
                            {new Date(m.fechaReposicion + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {m.foto && (
                        <img src={m.foto} alt="foto material" style={{ marginTop: 10, width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 12, flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(m)}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(m.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Botón Guardar */}
        {hayCambios && materiales.length > 0 && (
          <button
            className="btn btn-success btn-block btn-lg"
            style={{ marginTop: 16 }}
            onClick={handleGuardarTodo}
          >
            Guardar cambios
          </button>
        )}

      </div>

      {/* Modal formulario */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <p className="modal-title">{editando ? 'Editar material' : 'Nuevo material'}</p>

            <div className="input-group">
              <label className="input-label">Nombre</label>
              <input
                className="input"
                placeholder="Ej: Lavandina..."
                value={nombre}
                onChange={e => { setNombre(e.target.value); setError('') }}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontSize: 13, fontWeight: 800, color: '#6d28d9' }}>🏷️ Sector</label>
              <input
                className="input"
                placeholder="Ej: Baño, Cocina, Tienda..."
                value={sector}
                onChange={e => setSector(e.target.value)}
                style={{ fontSize: 15, fontWeight: sector ? 700 : 400, borderColor: sector ? '#a78bfa' : undefined }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Cantidad</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder="Ej: 2"
                  value={cantidad}
                  onChange={e => { setCantidad(e.target.value); setError('') }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="input-label">Unidad</label>
                <select className="input" value={unidad} onChange={e => setUnidad(e.target.value)}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Fecha de compra</label>
              <input
                type="date"
                className="input"
                value={fechaCompra}
                onChange={e => setFechaCompra(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Fecha de reposición estimada</label>
              <input
                type="date"
                className="input"
                value={fechaRepos}
                onChange={e => setFechaRepos(e.target.value)}
              />
            </div>

            {/* Foto */}
            <div className="input-group">
              <label className="input-label">Foto del material</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: 'linear-gradient(135deg, #0ea5e9, #6d28d9)',
                  color: '#fff', borderRadius: 10, padding: '10px 0',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                }}>
                  📷 Cámara
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFoto} />
                </label>
                <label style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: '#f1f5f9', color: '#475569', borderRadius: 10, padding: '10px 0',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #e2e8f0',
                }}>
                  🖼 Galería
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
                </label>
              </div>
              {foto && (
                <div style={{ position: 'relative', marginTop: 8 }}>
                  <img src={foto} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                  <button onClick={() => setFoto(null)} style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
                    borderRadius: '50%', width: 26, height: 26, fontSize: 13,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
                </div>
              )}
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleGuardarForm}>
                {editando ? '✓ Guardar' : '+ Agregar'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && <ModalConfirmSalida onConfirmar={confirmar} onCancelar={cancelar} />}

      {/* Toast éxito */}
      {guardadoOk && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--success)', color: '#fff',
          borderRadius: 12, padding: '14px 28px',
          boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 15, fontWeight: 600, zIndex: 999,
        }}>
          <span style={{ fontSize: 20 }}>✅</span>
          ¡Guardado con éxito!
        </div>
      )}
    </div>
  )
}
