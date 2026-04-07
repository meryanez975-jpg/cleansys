import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMateriales } from '../hooks/useMateriales'
import { useGuardiaNavegacion } from '../hooks/useGuardiaNavegacion'
import ModalConfirmSalida from '../components/ModalConfirmSalida'
import * as store from '../data/store'

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function diasDesde(fechaISO) {
  if (!fechaISO) return null
  const diff = (new Date(hoy()) - new Date(fechaISO)) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.round(diff))
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

  const [vista, setVista]               = useState('hub') // 'hub' | 'agregados' | 'contabilidad'
  const [hayCambios, setHayCambios]     = useState(false)
  const [guardadoOk, setGuardadoOk]     = useState(false)
  const { navegarConGuardia, showConfirm, confirmar, cancelar } = useGuardiaNavegacion(hayCambios)

  // Form agregar/editar
  const [showForm, setShowForm]         = useState(false)
  const [editando, setEditando]         = useState(null)
  const [nombre, setNombre]             = useState('')
  const [sector, setSector]             = useState('')
  const [cantidad, setCantidad]         = useState('')
  const [unidad, setUnidad]             = useState('unidad')
  const [fechaCompra, setFechaCompra]   = useState(hoy())
  const [fechaRepos, setFechaRepos]     = useState('')
  const [foto, setFoto]                 = useState(null)
  const [error, setError]               = useState('')
  const [fotoVisor, setFotoVisor]       = useState(null)

  // Contabilidad
  const [cambios, setCambios]           = useState(() => store.getCambiosMateriales())
  const [notaCambio, setNotaCambio]     = useState('')
  const [showModalCambio, setShowModalCambio] = useState(null) // material seleccionado

  function refetchCambios() { setCambios(store.getCambiosMateriales()) }

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
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        setFoto(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = ev.target.result
    }
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
  }

  function handleGuardarTodo() {
    setGuardadoOk(true)
    setHayCambios(false)
    setTimeout(() => setGuardadoOk(false), 3000)
  }

  function handleRegistrarCambio() {
    if (!showModalCambio) return
    store.registrarCambioMaterial(showModalCambio.id, showModalCambio.nombre, notaCambio)
    refetchCambios()
    setShowModalCambio(null)
    setNotaCambio('')
  }

  const vencidos = materiales.filter(m => estadoMaterial(m.fechaReposicion)?.label === 'Vencido').length
  const reponer  = materiales.filter(m => estadoMaterial(m.fechaReposicion)?.label === 'Reponer').length

  // ── HUB ──────────────────────────────────────────────────────────
  if (vista === 'hub') {
    return (
      <div className="page">
        <div className="container">
          <div className="header">
            <button className="header-back" onClick={() => navegarConGuardia(() => navigate('/asignacion'))}>←</button>
            <div style={{ flex: 1 }}>
              <p className="header-title">Material de limpieza</p>
              <p className="header-sub">Inventario y reposición</p>
            </div>
          </div>

          {/* Alerta rápida */}
          {(vencidos > 0 || reponer > 0) && (
            <div style={{
              background: vencidos > 0 ? 'var(--danger-light)' : 'var(--warning-light)',
              border: `1px solid ${vencidos > 0 ? 'var(--danger)' : 'var(--warning)'}`,
              borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 20,
              fontSize: 13, color: vencidos > 0 ? 'var(--danger)' : 'var(--warning)',
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <span>{vencidos > 0 ? '🔴' : '🟡'}</span>
              <span>
                {vencidos > 0 && `${vencidos} material${vencidos > 1 ? 'es' : ''} vencido${vencidos > 1 ? 's' : ''}. `}
                {reponer > 0 && `${reponer} para reponer pronto.`}
              </span>
            </div>
          )}

          {/* Las 2 tarjetas */}
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>

            {/* Agregados */}
            <button
              onClick={() => setVista('agregados')}
              style={{
                flex: 1, padding: '28px 16px',
                background: 'linear-gradient(135deg, #dbeafe, #ede9fe)',
                border: '2px solid #a78bfa',
                borderRadius: 16, cursor: 'pointer', textAlign: 'center',
                boxShadow: '0 4px 16px rgba(109,40,217,0.12)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 42 }}>📦</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#4c1d95' }}>Agregados</span>
              <span style={{ fontSize: 12, color: '#6d28d9', fontWeight: 500 }}>
                {materiales.length} producto{materiales.length !== 1 ? 's' : ''} cargado{materiales.length !== 1 ? 's' : ''}
              </span>
            </button>

            {/* Contabilidad */}
            <button
              onClick={() => setVista('contabilidad')}
              style={{
                flex: 1, padding: '28px 16px',
                background: 'linear-gradient(135deg, #dcfce7, #d1fae5)',
                border: '2px solid #34d399',
                borderRadius: 16, cursor: 'pointer', textAlign: 'center',
                boxShadow: '0 4px 16px rgba(16,185,129,0.12)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 42 }}>📊</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#064e3b' }}>Contabilidad</span>
              <span style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>
                {cambios.length} cambio{cambios.length !== 1 ? 's' : ''} registrado{cambios.length !== 1 ? 's' : ''}
              </span>
            </button>

          </div>
        </div>
        {showConfirm && <ModalConfirmSalida onConfirmar={confirmar} onCancelar={cancelar} />}
      </div>
    )
  }

  // ── VISTA AGREGADOS ───────────────────────────────────────────────
  if (vista === 'agregados') {
    return (
      <div className="page">
        <div className="container">
          <div className="header">
            <button className="header-back" onClick={() => setVista('hub')}>←</button>
            <div style={{ flex: 1 }}>
              <p className="header-title">Agregados</p>
              <p className="header-sub">Productos en inventario</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>+ Agregar</button>
          </div>

          {(vencidos > 0 || reponer > 0) && (
            <div style={{
              background: vencidos > 0 ? 'var(--danger-light)' : 'var(--warning-light)',
              border: `1px solid ${vencidos > 0 ? 'var(--danger)' : 'var(--warning)'}`,
              borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: vencidos > 0 ? 'var(--danger)' : 'var(--warning)',
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <span>{vencidos > 0 ? '🔴' : '🟡'}</span>
              <span>
                {vencidos > 0 && `${vencidos} material${vencidos > 1 ? 'es' : ''} vencido${vencidos > 1 ? 's' : ''}. `}
                {reponer > 0 && `${reponer} para reponer pronto.`}
              </span>
            </div>
          )}

          {materiales.length === 0 ? (
            <div className="card text-center" style={{ padding: 48 }}>
              <p style={{ fontSize: 40, marginBottom: 14 }}>🧴</p>
              <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Sin materiales cargados</p>
              <p className="text-muted">Presioná "+ Agregar" para empezar el inventario</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {materiales.map(m => {
                const estado = estadoMaterial(m.fechaReposicion)
                return (
                  <div key={m.id} className="card" style={{ borderLeft: `4px solid ${estado?.color || 'var(--border)'}`, padding: 0, overflow: 'hidden' }}>
                    {m.foto && (
                      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setFotoVisor(m.foto)}>
                        <img src={m.foto} alt="foto" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block', borderBottom: '1px solid var(--border)' }} />
                        <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.45)', color: '#fff', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                          🔍 Ver foto
                        </div>
                      </div>
                    )}
                    <div className="flex-between" style={{ padding: '12px 14px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{m.nombre}</span>
                          {m.sector && (
                            <span style={{ fontSize: 11, fontWeight: 700, background: '#ede9fe', color: '#6d28d9', borderRadius: 999, padding: '2px 10px' }}>{m.sector}</span>
                          )}
                          {estado && (
                            <span style={{ background: estado.bg, color: estado.color, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 10px', textTransform: 'uppercase' }}>{estado.label}</span>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>📦 {m.cantidad} {m.unidad}</p>
                        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-light)', flexWrap: 'wrap' }}>
                          {m.fechaCompra && <span>🛒 {new Date(m.fechaCompra + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                          {m.fechaReposicion && <span>🔄 {new Date(m.fechaReposicion + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                        </div>
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

          {hayCambios && materiales.length > 0 && (
            <button className="btn btn-success btn-block btn-lg" style={{ marginTop: 16 }} onClick={handleGuardarTodo}>
              Guardar cambios
            </button>
          )}
        </div>

        {/* Modal form */}
        {showForm && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 400 }}>
              <p className="modal-title">{editando ? 'Editar material' : 'Nuevo material'}</p>

              <div className="input-group">
                <label className="input-label">Nombre</label>
                <input className="input" placeholder="Ej: Lavandina..." value={nombre} onChange={e => { setNombre(e.target.value); setError('') }} autoFocus />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: 13, fontWeight: 800, color: '#6d28d9' }}>🏷️ Sector</label>
                <input className="input" placeholder="Ej: Baño, Cocina, Tienda..." value={sector} onChange={e => setSector(e.target.value)}
                  style={{ fontSize: 15, fontWeight: sector ? 700 : 400, borderColor: sector ? '#a78bfa' : undefined }} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Cantidad</label>
                  <input className="input" type="number" min="0" placeholder="Ej: 2" value={cantidad} onChange={e => { setCantidad(e.target.value); setError('') }} />
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
                <input type="date" className="input" value={fechaCompra} onChange={e => setFechaCompra(e.target.value)} />
              </div>

              <div className="input-group">
                <label className="input-label">Fecha de reposición estimada</label>
                <input type="date" className="input" value={fechaRepos} onChange={e => setFechaRepos(e.target.value)} />
              </div>

              <div className="input-group">
                <label className="input-label">Foto del material</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg, #0ea5e9, #6d28d9)', color: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    📷 Cámara
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFoto} />
                  </label>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f1f5f9', color: '#475569', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #e2e8f0' }}>
                    🖼 Galería
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
                  </label>
                </div>
                {foto && (
                  <div style={{ position: 'relative', marginTop: 8 }}>
                    <img src={foto} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                    <button onClick={() => setFoto(null)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 26, height: 26, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                )}
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleGuardarForm}>{editando ? '✓ Guardar' : '+ Agregar'}</button>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {fotoVisor && (
          <div onClick={() => setFotoVisor(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <img src={fotoVisor} alt="foto ampliada" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
            <button onClick={() => setFotoVisor(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        )}

        {showConfirm && <ModalConfirmSalida onConfirmar={confirmar} onCancelar={cancelar} />}

        {guardadoOk && (
          <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: 'var(--success)', color: '#fff', borderRadius: 12, padding: '14px 28px', boxShadow: '0 4px 20px rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, zIndex: 999 }}>
            <span style={{ fontSize: 20 }}>✅</span> ¡Guardado con éxito!
          </div>
        )}
      </div>
    )
  }

  // ── VISTA CONTABILIDAD ────────────────────────────────────────────
  return (
    <div className="page">
      <div className="container">
        <div className="header">
          <button className="header-back" onClick={() => setVista('hub')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Contabilidad</p>
            <p className="header-sub">Duración y cambios de productos</p>
          </div>
        </div>

        {/* Tarjetas de productos con su historial */}
        {materiales.length === 0 ? (
          <div className="card text-center" style={{ padding: 40 }}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>📊</p>
            <p style={{ fontWeight: 700, color: 'var(--text)' }}>No hay productos cargados</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {materiales.map(m => {
              const estado   = estadoMaterial(m.fechaReposicion)
              const diasUso  = diasDesde(m.fechaCompra)
              const historial = cambios.filter(c => c.material_id === m.id)
              const ultimoCambio = historial[0]

              return (
                <div key={m.id} className="card" style={{ padding: '14px 16px', borderLeft: `4px solid ${estado?.color || 'var(--border)'}` }}>
                  {/* Encabezado producto */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{m.nombre}</span>
                      {m.sector && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: '#ede9fe', color: '#6d28d9', borderRadius: 999, padding: '2px 10px' }}>{m.sector}</span>
                      )}
                    </div>
                    {estado && (
                      <span style={{ background: estado.bg, color: estado.color, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 10px', textTransform: 'uppercase' }}>{estado.label}</span>
                    )}
                  </div>

                  {/* Estadísticas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', margin: 0 }}>{diasUso ?? '—'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>días en uso</p>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: 0 }}>{historial.length}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>cambios registrados</p>
                    </div>
                  </div>

                  {/* Último cambio */}
                  {ultimoCambio && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: '#059669' }}>Último cambio: </span>
                      <span style={{ color: '#065f46' }}>
                        {new Date(ultimoCambio.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {ultimoCambio.notas && <span style={{ color: 'var(--text-muted)' }}> · {ultimoCambio.notas}</span>}
                    </div>
                  )}

                  {/* Historial colapsado */}
                  {historial.length > 1 && (
                    <div style={{ marginBottom: 10 }}>
                      {historial.slice(1).map(c => (
                        <div key={c.id} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                          🔄 {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {c.notas && ` · ${c.notas}`}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botón registrar cambio */}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', fontSize: 13, fontWeight: 700, color: '#059669', borderColor: '#34d399' }}
                    onClick={() => { setShowModalCambio(m); setNotaCambio('') }}
                  >
                    + Registrar cambio de producto
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal registrar cambio */}
      {showModalCambio && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <p className="modal-title">Registrar cambio</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              📦 {showModalCambio.nombre}
            </p>
            <div className="input-group">
              <label className="input-label">Nota (opcional)</label>
              <input
                className="input"
                placeholder="Ej: Se terminó, se reemplazó por nuevo..."
                value={notaCambio}
                onChange={e => setNotaCambio(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRegistrarCambio}>
                ✓ Registrar
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModalCambio(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && <ModalConfirmSalida onConfirmar={confirmar} onCancelar={cancelar} />}
    </div>
  )
}
