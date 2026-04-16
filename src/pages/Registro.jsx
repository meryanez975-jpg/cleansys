import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'
import { useAsignaciones } from '../hooks/useAsignaciones'
import { useRegistros } from '../hooks/useRegistros'
import * as store from '../data/store'

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function formatHora(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatFechaCorta(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

// Próximas asignaciones del empleado (desde mañana, este mes + el siguiente)
function getProximasAsignaciones(personal_id) {
  const fechaHoy = hoy()
  const [y, m] = fechaHoy.slice(0, 7).split('-').map(Number)
  const mesActual = `${y}-${String(m).padStart(2, '0')}`
  const nextMonth = m === 12
    ? `${y + 1}-01`
    : `${y}-${String(m + 1).padStart(2, '0')}`

  const zonas = JSON.parse(localStorage.getItem('cleansys_zonas') || '[]')

  return JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
    .filter(a =>
      a.personal_id === personal_id &&
      a.activo !== false &&
      a.fecha > fechaHoy &&
      (a.fecha.startsWith(mesActual) || a.fecha.startsWith(nextMonth))
    )
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.turno === 'mañana' ? -1 : 1))
    .map(a => ({
      ...a,
      zona: zonas.find(z => z.id === a.zona_id) || null,
    }))
}

export default function Registro() {
  const fechaHoy = hoy()

  // Personal desde Supabase (igual que SemanaPlan e HistorialPersonal)
  const [personal, setPersonal]           = useState([])
  const [loadingPersonal, setLoadingPersonal] = useState(true)

  useEffect(() => {
    supabase.from('com_personal').select('id, nombre, sector, turno').eq('activo', true).order('nombre')
      .then(({ data }) => {
        if (data) setPersonal(data)
        setLoadingPersonal(false)
      })
  }, [])

  const { asignaciones } = useAsignaciones(fechaHoy)
  const { marcarEntrada, marcarSalida, getRegistroPorAsignacion } = useRegistros(fechaHoy)

  const [empleadoId, setEmpleadoId]   = useState(null)
  const [busqueda, setBusqueda]       = useState('')
  const [confirmando, setConfirmando] = useState(null)
  const [notas, setNotas]             = useState('')
  const [imagen, setImagen]           = useState(null)

  function handleImagen(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImagen(ev.target.result)
    reader.readAsDataURL(file)
  }

  const empleadoSeleccionado = personal.find(p => p.id === empleadoId)

  // Asignaciones de hoy para el empleado seleccionado — matchear por personal_id directo
  const tareasHoy = asignaciones.filter(a => a.personal_id === empleadoId)

  const proximosDias = empleadoId
    ? getProximasAsignaciones(empleadoId)
    : []

  const personalFiltrado = personal.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  // ── PANTALLA 1: elegir nombre ──────────────────────────────────
  if (!empleadoId) {
    return (
      <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        <div className="container">

          <div className="header">
            <div>
              <p className="header-title">Registro Personal</p>
              <p className="header-sub">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          <div className="card">
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>
              ¿Quién sos?
            </p>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Elegí tu nombre para ver tus tareas
            </p>

            <input
              className="input"
              placeholder="Buscar nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ marginBottom: 12 }}
              autoFocus
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
              {loadingPersonal ? (
                <p className="text-muted text-center" style={{ padding: 20 }}>Cargando personal...</p>
              ) : personalFiltrado.length === 0 ? (
                <p className="text-muted text-center" style={{ padding: 20 }}>
                  {personal.length === 0 ? 'No hay personal cargado aún' : 'Sin resultados'}
                </p>
              ) : (
                personalFiltrado.map(p => {
                  const tieneHoy = asignaciones.some(a => a.personal_id === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => setEmpleadoId(p.id)}
                      style={{
                        background: tieneHoy ? 'var(--primary-light)' : 'var(--bg)',
                        border: `1.5px solid ${tieneHoy ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: tieneHoy ? 'var(--primary)' : 'var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: tieneHoy ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 15,
                      }}>
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{p.nombre}</p>
                        {p.sector && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.sector}</p>}
                      </div>
                      {tieneHoy && (
                        <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>Tarea hoy</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PANTALLA 2: mis tareas ─────────────────────────────────────
  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => setEmpleadoId(null)}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">{empleadoSeleccionado?.nombre}</p>
            <p className="header-sub">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* ── SECCIÓN: HOY ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
          }}>
            Hoy
          </p>

          {tareasHoy.length === 0 ? (
            <div className="card text-center" style={{ padding: 32 }}>
              <p style={{ fontSize: 32, marginBottom: 10 }}>😴</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
                Sin tareas hoy
              </p>
              <p className="text-muted">No tenés limpieza asignada para hoy</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tareasHoy.map(a => {
                const reg          = getRegistroPorAsignacion(a.id)
                const tieneEntrada = !!reg?.hora_entrada
                const tieneSalida  = !!reg?.hora_salida
                const esManana     = a.turno === 'mañana'

                return (
                  <div key={a.id} className="card" style={{
                    borderLeft: `4px solid ${esManana ? 'var(--manana-badge)' : 'var(--noche-badge)'}`,
                  }}>
                    {/* Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 26 }}>{esManana ? '☀️' : '🌙'}</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
                          {a.zona?.nombre}
                        </p>
                        <span className={`badge badge-${esManana ? 'manana' : 'noche'}`}>
                          Turno {esManana ? 'Mañana' : 'Noche'}
                        </span>
                      </div>
                    </div>

                    {/* Estado */}
                    {tieneSalida ? (
                      <div style={{ background: 'var(--success-light)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 18 }}>✅</span>
                          <strong style={{ color: 'var(--success)', fontSize: 14 }}>¡Limpieza completada!</strong>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          Entrada: {formatHora(reg.hora_entrada)} → Salida: {formatHora(reg.hora_salida)}
                        </p>
                        {reg.notas && (
                          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>📝 {reg.notas}</p>
                        )}
                        {reg.imagen && (
                          <img src={reg.imagen} alt="foto limpieza" style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 180, objectFit: 'cover' }} />
                        )}
                      </div>

                    ) : tieneEntrada ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{
                          background: 'var(--warning-light)', borderRadius: 10, padding: '10px 14px',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <span style={{ fontSize: 18 }}>🟡</span>
                          <div>
                            <p style={{ fontWeight: 600, color: 'var(--warning)', fontSize: 14 }}>En limpieza</p>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                              Entrada: {formatHora(reg.hora_entrada)}
                            </p>
                          </div>
                        </div>

                        {confirmando === a.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                              className="input"
                              placeholder="Observaciones (opcional)"
                              value={notas}
                              onChange={e => setNotas(e.target.value)}
                            />

                            <label style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                              border: `2px dashed ${imagen ? '#15803d' : 'var(--border)'}`,
                              background: imagen ? '#f0fdf4' : 'var(--bg)',
                              transition: 'all 0.15s',
                            }}>
                              <span style={{ fontSize: 22 }}>{imagen ? '✅' : '📷'}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: imagen ? '#15803d' : 'var(--text-muted)' }}>
                                {imagen ? 'Foto adjuntada' : 'Adjuntar foto (opcional)'}
                              </span>
                              <input type="file" accept="image/*" capture="environment" onChange={handleImagen} style={{ display: 'none' }} />
                            </label>

                            {imagen && (
                              <div style={{ position: 'relative' }}>
                                <img src={imagen} alt="preview" style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover' }} />
                                <button
                                  onClick={() => setImagen(null)}
                                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                                >✕</button>
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-success"
                                style={{ flex: 1 }}
                                onClick={() => { marcarSalida(a.id, notas, imagen); setConfirmando(null); setNotas(''); setImagen(null) }}
                              >
                                ✓ Confirmar salida
                              </button>
                              <button className="btn btn-ghost" onClick={() => { setConfirmando(null); setNotas(''); setImagen(null) }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button className="btn btn-primary btn-block btn-lg" onClick={() => setConfirmando(a.id)}>
                            Marcar Salida →
                          </button>
                        )}
                      </div>

                    ) : (
                      <button className="btn btn-outline btn-block btn-lg" onClick={() => marcarEntrada(a.id)}>
                        📍 Marcar Entrada
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── SECCIÓN: PRÓXIMOS DÍAS ── */}
        {proximosDias.length > 0 && (
          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
            }}>
              Próximas limpiezas
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proximosDias.map(a => {
                const esManana = a.turno === 'mañana'
                return (
                  <div key={a.id} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${esManana ? 'var(--manana-badge)' : 'var(--noche-badge)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '12px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: 'var(--shadow)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{esManana ? '☀️' : '🌙'}</span>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', textTransform: 'capitalize' }}>
                          {formatFechaCorta(a.fecha)}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          🏢 {a.zona?.nombre || a.zonaId || '—'} · Turno {esManana ? 'mañana' : 'noche'}
                        </p>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 10px',
                      background: esManana ? 'var(--manana-bg)' : 'var(--noche-bg)',
                      color: esManana ? 'var(--manana-badge)' : 'var(--noche-badge)',
                    }}>
                      {esManana ? 'Mañana' : 'Noche'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sin nada asignado en el período */}
        {tareasHoy.length === 0 && proximosDias.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setEmpleadoId(null)}>
              ← Volver
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
