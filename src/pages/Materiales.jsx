import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMateriales } from '../hooks/useMateriales'
import { useGuardiaNavegacion } from '../hooks/useGuardiaNavegacion'
import ModalConfirmSalida from '../components/ModalConfirmSalida'
import { useZonas } from '../hooks/useZonas'
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
  const { zonas } = useZonas()

  const [vista, setVista]               = useState('agregados') // 'agregados' | 'contabilidad'
  const [hayCambios, setHayCambios]     = useState(false)
  const [guardadoOk, setGuardadoOk]     = useState(false)
  const { navegarConGuardia, showConfirm, confirmar, cancelar } = useGuardiaNavegacion(hayCambios)

  // Form agregar/editar
  const [showForm, setShowForm]     = useState(false)
  const [editando, setEditando]     = useState(null)
  const [nombre, setNombre]         = useState('')
  const [sector, setSector]         = useState('')
  const [cantidad, setCantidad]     = useState('')
  const [unidad, setUnidad]         = useState('unidad')
  const [fechaCompra, setFechaCompra] = useState(hoy())
  const [fechaRepos, setFechaRepos]   = useState('')
  const [foto, setFoto]             = useState(null)
  const [error, setError]           = useState('')
  const [fotoVisor, setFotoVisor]   = useState(null)
  const [showOtroInput, setShowOtroInput]     = useState(false)
  const [otroNombre, setOtroNombre]           = useState('')
  const [sectoresAbiertos, setSectoresAbiertos]   = useState({})
  const [productosAbiertos, setProductosAbiertos] = useState({})
  const [customSectores, setCustomSectores] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cleansys_sectores_custom') || '[]') }
    catch { return [] }
  })

  function guardarCustomSector(nombre) {
    if (!nombre || customSectores.includes(nombre)) return
    const nuevos = [...customSectores, nombre]
    setCustomSectores(nuevos)
    localStorage.setItem('cleansys_sectores_custom', JSON.stringify(nuevos))
  }

  // Contabilidad
  const [cambios, setCambios]             = useState(() => store.getCambiosMateriales())
  const [fechaCambio, setFechaCambio]     = useState(hoy())
  const [showModalCambio, setShowModalCambio] = useState(null)
  const [contMes, setContMes]             = useState(new Date().getMonth())
  const [contAnio, setContAnio]           = useState(new Date().getFullYear())
  const [confirmEliminar, setConfirmEliminar] = useState(null) // { tipo: 'material'|'cambio', id, nombre }

  function refetchCambios() { setCambios(store.getCambiosMateriales()) }

  function mesContAnterior() {
    if (contMes === 0) { setContMes(11); setContAnio(y => y - 1) }
    else setContMes(m => m - 1)
  }
  function mesContSiguiente() {
    if (contMes === 11) { setContMes(0); setContAnio(y => y + 1) }
    else setContMes(m => m + 1)
  }

  function confirmarEliminar() {
    if (!confirmEliminar) return
    if (confirmEliminar.tipo === 'material') {
      eliminar(confirmEliminar.id)
      setHayCambios(true)
    } else {
      store.removeCambioMaterial(confirmEliminar.id)
      refetchCambios()
    }
    setConfirmEliminar(null)
  }

  function abrirNuevo() {
    setEditando(null)
    setNombre(''); setSector(''); setCantidad(''); setUnidad('unidad')
    setFechaCompra(hoy()); setFechaRepos(''); setFoto(null); setError('')
    setShowOtroInput(false); setOtroNombre('')
    setShowForm(true)
  }

  function abrirEditar(m) {
    setEditando(m)
    setNombre(m.nombre); setSector(m.sector || ''); setCantidad(String(m.cantidad))
    setUnidad(m.unidad || 'unidad'); setFechaCompra(m.fechaCompra || hoy())
    setFechaRepos(m.fechaReposicion || ''); setFoto(m.foto || null); setError('')
    setShowOtroInput(false); setOtroNombre('')
    setShowForm(true)
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

  function handleEliminar(id, nombre) {
    setConfirmEliminar({ tipo: 'material', id, nombre })
  }

  function handleGuardarTodo() {
    setGuardadoOk(true)
    setHayCambios(false)
    setTimeout(() => setGuardadoOk(false), 3000)
  }

  function handleRegistrarCambio() {
    if (!showModalCambio) return
    store.registrarCambioMaterial(showModalCambio.id, showModalCambio.nombre, fechaCambio)
    refetchCambios()
    setShowModalCambio(null)
    setFechaCambio(hoy())
  }

  const vencidos = materiales.filter(m => estadoMaterial(m.fechaReposicion)?.label === 'Vencido').length
  const reponer  = materiales.filter(m => estadoMaterial(m.fechaReposicion)?.label === 'Reponer').length

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
          {vista === 'agregados' && (
            <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>+ Agregar</button>
          )}
        </div>

        {/* Tarjetas de selección — igual que SemanaPlan */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => setVista('agregados')}
            style={{
              flex: 1, padding: '14px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: vista === 'agregados' ? '#6d28d9' : '#ede9fe',
              boxShadow: vista === 'agregados' ? '0 3px 10px rgba(109,40,217,0.35)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <p style={{ fontSize: 22, fontWeight: 800, color: vista === 'agregados' ? '#fff' : '#6d28d9', margin: 0 }}>{materiales.length}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: vista === 'agregados' ? '#fff' : '#6d28d9', margin: 0 }}>📦 Agregados</p>
          </button>

          <button
            onClick={() => setVista('contabilidad')}
            style={{
              flex: 1, padding: '14px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: vista === 'contabilidad' ? '#059669' : '#dcfce7',
              boxShadow: vista === 'contabilidad' ? '0 3px 10px rgba(5,150,105,0.35)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <p style={{ fontSize: 22, fontWeight: 800, color: vista === 'contabilidad' ? '#fff' : '#059669', margin: 0 }}>{cambios.length}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: vista === 'contabilidad' ? '#fff' : '#059669', margin: 0 }}>📊 Contabilidad</p>
          </button>
        </div>

        {/* Alerta */}
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

        {/* ── AGREGADOS ── */}
        {vista === 'agregados' && (() => {
          const grupos = materiales.reduce((acc, m) => {
            const s = m.sector || 'Sin sector'
            if (!acc[s]) acc[s] = []
            acc[s].push(m)
            return acc
          }, {})
          return (
            <>
              {materiales.length === 0 ? (
                <div className="card text-center" style={{ padding: 48 }}>
                  <p style={{ fontSize: 40, marginBottom: 14 }}>🧴</p>
                  <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Sin materiales cargados</p>
                  <p className="text-muted">Presioná "+ Agregar" para empezar el inventario</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(grupos).map(([sec, mats]) => {
                    const abierto = !!sectoresAbiertos['ag-' + sec]
                    return (
                      <div key={sec}>
                        <button
                          onClick={() => setSectoresAbiertos(p => ({ ...p, ['ag-' + sec]: !p['ag-' + sec] }))}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', borderRadius: abierto ? '12px 12px 0 0' : 12,
                            border: 'none', cursor: 'pointer',
                            background: abierto ? '#6d28d9' : '#ede9fe',
                            transition: 'all 0.15s',
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: 14, color: abierto ? '#fff' : '#6d28d9' }}>🏷️ {sec}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: abierto ? 'rgba(255,255,255,0.8)' : '#7c3aed' }}>
                            {mats.length} {mats.length === 1 ? 'producto' : 'productos'}
                          </span>
                        </button>
                        {abierto && (
                          <div style={{ border: '1px solid #ede9fe', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {mats.map(m => {
                              const estado   = estadoMaterial(m.fechaReposicion)
                              const prodOpen = !!productosAbiertos['ag-' + m.id]
                              return (
                                <div key={m.id} style={{ borderLeft: `4px solid ${estado?.color || '#a78bfa'}`, background: '#fff', borderBottom: '1px solid #f3f4f6' }}>
                                  <button
                                    onClick={() => setProductosAbiertos(p => ({ ...p, ['ag-' + m.id]: !p['ag-' + m.id] }))}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                  >
                                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{m.nombre}</span>
                                    {estado && <span style={{ background: estado.bg, color: estado.color, fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase' }}>{estado.label}</span>}
                                  </button>
                                  {prodOpen && (
                                    <div style={{ padding: '0 14px 12px' }}>
                                      {m.foto && (
                                        <div style={{ position: 'relative', cursor: 'pointer', marginBottom: 8 }} onClick={() => setFotoVisor(m.foto)}>
                                          <img src={m.foto} alt="foto" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8 }} />
                                          <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.45)', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>🔍 Ver foto</div>
                                        </div>
                                      )}
                                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>📦 {m.cantidad} {m.unidad}</p>
                                      {m.fechaCompra && <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 10 }}>🛒 {new Date(m.fechaCompra + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => abrirEditar(m)}>✏️ Editar</button>
                                        <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleEliminar(m.id, m.nombre)}>🗑 Eliminar</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {materiales.length > 0 && (
                <button className="btn btn-success btn-block btn-lg" style={{ marginTop: 16 }} onClick={handleGuardarTodo}>✓ Guardar</button>
              )}
            </>
          )
        })()}

        {/* ── CONTABILIDAD ── */}
        {vista === 'contabilidad' && (() => {
          const mesStr    = `${contAnio}-${String(contMes + 1).padStart(2, '0')}`
          const mesNombre = new Date(contAnio, contMes, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
          const grupos = materiales.reduce((acc, m) => {
            const s = m.sector || 'Sin sector'
            if (!acc[s]) acc[s] = []
            acc[s].push(m)
            return acc
          }, {})
          return (
            <>
              {/* Navegador de mes */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                borderRadius: 12, padding: '10px 8px', marginBottom: 12,
              }}>
                <button
                  onClick={mesContAnterior}
                  style={{
                    background: '#dcfce7', border: 'none', borderRadius: 8,
                    padding: '8px 20px', cursor: 'pointer',
                    color: '#059669', fontWeight: 700, fontSize: 20,
                  }}
                >‹</button>
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', textTransform: 'capitalize' }}>
                  {mesNombre}
                </span>
                <button
                  onClick={mesContSiguiente}
                  style={{
                    background: '#dcfce7', border: 'none', borderRadius: 8,
                    padding: '8px 20px', cursor: 'pointer',
                    color: '#059669', fontWeight: 700, fontSize: 20,
                  }}
                >›</button>
              </div>

              {materiales.length === 0 ? (
                <div className="card text-center" style={{ padding: 40 }}>
                  <p style={{ fontSize: 36, marginBottom: 10 }}>📊</p>
                  <p style={{ fontWeight: 700, color: 'var(--text)' }}>No hay productos cargados</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(grupos).map(([sec, mats]) => {
                    const abierto = !!sectoresAbiertos['ct-' + sec]
                    return (
                      <div key={sec}>
                        <button
                          onClick={() => setSectoresAbiertos(p => ({ ...p, ['ct-' + sec]: !p['ct-' + sec] }))}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', borderRadius: abierto ? '12px 12px 0 0' : 12,
                            border: 'none', cursor: 'pointer',
                            background: abierto ? '#059669' : '#dcfce7',
                            transition: 'all 0.15s',
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: 14, color: abierto ? '#fff' : '#059669' }}>🏷️ {sec}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: abierto ? 'rgba(255,255,255,0.8)' : '#16a34a' }}>
                            {mats.length} {mats.length === 1 ? 'producto' : 'productos'}
                          </span>
                        </button>
                        {abierto && (
                          <div style={{ border: '1px solid #dcfce7', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {mats.map(m => {
                              const cambiosMes = cambios.filter(c => c.material_id === m.id && c.fecha.startsWith(mesStr))
                              const prodOpen   = !!productosAbiertos['ct-' + m.id]
                              return (
                                <div key={m.id} style={{ background: '#fff', borderBottom: '1px solid #f0fdf4' }}>
                                  <button
                                    onClick={() => setProductosAbiertos(p => ({ ...p, ['ct-' + m.id]: !p['ct-' + m.id] }))}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                  >
                                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{m.nombre}</span>
                                    {cambiosMes.length > 0 && (
                                      <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#059669', borderRadius: 999, padding: '2px 8px' }}>
                                        {cambiosMes.length} este mes
                                      </span>
                                    )}
                                  </button>
                                  {prodOpen && (
                                    <div style={{ padding: '0 16px 12px' }}>
                                      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ fontSize: 28, fontWeight: 800, color: cambiosMes.length > 0 ? '#059669' : '#94a3b8', lineHeight: 1 }}>{cambiosMes.length}</span>
                                        <div>
                                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>cambio{cambiosMes.length !== 1 ? 's' : ''} en este mes</p>
                                          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, textTransform: 'capitalize' }}>{mesNombre}</p>
                                        </div>
                                      </div>
                                      {cambiosMes.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                                          {cambiosMes.map(c => (
                                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#f0fdf4', borderRadius: 8 }}>
                                              <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>
                                                📅 {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                              </span>
                                              <button
                                                onClick={() => setConfirmEliminar({ tipo: 'cambio', id: c.id, nombre: `cambio del ${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}` })}
                                                style={{
                                                  background: '#fee2e2', border: '1.5px solid #fecaca',
                                                  borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                                                  color: '#dc2626', fontWeight: 700, fontSize: 12,
                                                }}
                                              >
                                                🗑️
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ width: '100%', fontSize: 13, fontWeight: 700, color: '#059669', borderColor: '#34d399' }}
                                        onClick={() => { setShowModalCambio(m); setFechaCambio(hoy()) }}
                                      >
                                        + Registrar cambio
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}

      </div>

      {/* Modal form nuevo/editar */}
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
              {(() => {
                const sectoresGestion = zonas.map(z => z.nombre)
                const sectoresCustom  = [...new Set([
                  ...customSectores,
                  ...materiales.map(m => m.sector).filter(s => s && !sectoresGestion.includes(s)),
                ])]
                const chipStyle = (activo) => ({
                  padding: '7px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                  border: `2px solid ${activo ? '#6d28d9' : '#e2e8f0'}`,
                  background: activo ? '#ede9fe' : '#f8fafc',
                  color: activo ? '#6d28d9' : '#64748b',
                  fontWeight: activo ? 700 : 500, transition: 'all 0.12s',
                })
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* Sección: sectores de gestión */}
                    {sectoresGestion.length > 0 && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          De gestión
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {sectoresGestion.map(n => (
                            <button key={n} type="button" style={chipStyle(sector === n)}
                              onClick={() => { setSector(sector === n ? '' : n); setShowOtroInput(false) }}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Divisor */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Solo materiales
                      </span>
                      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                    </div>

                    {/* Sección: sectores solo de materiales */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {sectoresCustom.map(n => (
                        <button key={n} type="button" style={chipStyle(sector === n)}
                          onClick={() => { setSector(sector === n ? '' : n); setShowOtroInput(false) }}>
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => { setShowOtroInput(v => !v); setSector(''); setOtroNombre('') }}
                        style={chipStyle(showOtroInput)}
                      >
                        + Nuevo
                      </button>
                    </div>

                    {showOtroInput && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="input"
                          placeholder="Nombre del sector de material..."
                          value={otroNombre}
                          onChange={e => setOtroNombre(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && otroNombre.trim()) {
                              const n = otroNombre.trim()
                              setSector(n); guardarCustomSector(n); setShowOtroInput(false)
                            }
                          }}
                          autoFocus
                          style={{ flex: 1, fontSize: 13 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (otroNombre.trim()) {
                              const n = otroNombre.trim()
                              setSector(n); guardarCustomSector(n); setShowOtroInput(false)
                            }
                          }}
                          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#6d28d9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                        >
                          ✓
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}
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

      {/* Modal confirmar eliminación */}
      {confirmEliminar && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(30,58,95,0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setConfirmEliminar(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 18, padding: '28px 24px',
            width: '100%', maxWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>
              {confirmEliminar.tipo === 'material' ? '🧴' : '📅'}
            </div>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginBottom: 8 }}>
              {confirmEliminar.tipo === 'material' ? '¿Eliminar material?' : '¿Eliminar registro?'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Se eliminará <strong>{confirmEliminar.nombre}</strong>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={confirmarEliminar}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 10, cursor: 'pointer',
                  background: '#dc2626', border: 'none',
                  color: '#fff', fontWeight: 700, fontSize: 15,
                }}
              >
                Sí, eliminar
              </button>
              <button
                onClick={() => setConfirmEliminar(null)}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                  background: 'var(--bg)', border: '1.5px solid var(--border)',
                  color: 'var(--text)', fontWeight: 700, fontSize: 14,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar cambio */}
      {showModalCambio && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <p className="modal-title">Registrar cambio</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>📦 {showModalCambio.nombre}</p>
            <div className="input-group">
              <label className="input-label">Fecha</label>
              <input type="date" className="input" value={fechaCambio} onChange={e => setFechaCambio(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRegistrarCambio}>✓ Registrar</button>
              <button className="btn btn-ghost" onClick={() => setShowModalCambio(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Visor foto en grande */}
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
