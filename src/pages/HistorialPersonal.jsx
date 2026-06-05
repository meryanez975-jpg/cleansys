import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase/client'

function formatMesLargo(anio, mes) {
  return new Date(anio, mes, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}
function formatFecha(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}
function formatHora(isoStr) {
  if (!isoStr) return null
  return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function HistorialPersonal() {
  const navigate = useNavigate()
  const now = new Date()

  const [histMes, setHistMes]   = useState(now.getMonth())   // 0-11
  const [histAnio, setHistAnio] = useState(now.getFullYear())
  const [selId, setSelId]           = useState(null)
  const [categoriaFiltro, setCategoriaFiltro] = useState(null)
  const [filtroZona, setFiltroZona] = useState(null)  // null | zona_id
  const [personalSupabase, setPersonalSupabase] = useState([])
  const [loadingPersonal, setLoadingPersonal]   = useState(true)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    supabase.from('com_personal').select('id, nombre, sector, turno').eq('activo', true).order('nombre')
      .then(({ data }) => {
        if (data) setPersonalSupabase(data)
        setLoadingPersonal(false)
      })
  }, [])

  function mesAnterior() {
    if (histMes === 0) { setHistMes(11); setHistAnio(y => y - 1) }
    else setHistMes(m => m - 1)
    setSelId(null)
  }
  function mesSiguiente() {
    if (histMes === 11) { setHistMes(0); setHistAnio(y => y + 1) }
    else setHistMes(m => m + 1)
    setSelId(null)
  }

  const { allAsigs, allRegs, allZonas } = useMemo(() => {
    try {
      return {
        allAsigs: JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]').filter(a => a.activo !== false),
        allRegs:  JSON.parse(localStorage.getItem('cleansys_registros') || '[]'),
        allZonas: JSON.parse(localStorage.getItem('cleansys_zonas') || '[]'),
      }
    } catch { return { allAsigs: [], allRegs: [], allZonas: [] } }
  }, [histMes, histAnio, tick])

  function eliminarTodo() {
    localStorage.removeItem('cleansys_asignaciones')
    localStorage.removeItem('cleansys_registros')
    setTick(t => t + 1)
    setSelId(null)
    setShowConfirmDelete(false)
  }

  function asigsFiltradas(personal_id) {
    const prefix = `${histAnio}-${String(histMes + 1).padStart(2, '0')}-`
    return allAsigs
      .filter(a => {
        if (a.personal_id !== personal_id) return false
        if (!a.fecha.startsWith(prefix)) return false
        if (filtroZona && a.zona_id !== filtroZona) return false
        return true
      })
      .map(a => ({
        ...a,
        zona: allZonas.find(z => z.id === a.zona_id) || null,
        registro: allRegs.find(r => r.asignacion_id === a.id) || null,
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }

  function categoriaDe(p) {
    const asigs = asigsFiltradas(p.id)
    if (asigs.length === 0) return 'sinAsignacion'
    return asigs.some(a => a.registro?.completado) ? 'cumplieron' : 'noCumplieron'
  }

  const personalFiltrado = personalSupabase.filter(p => {
    if (categoriaFiltro && categoriaDe(p) !== categoriaFiltro) return false
    if (filtroZona) {
      const prefix = `${histAnio}-${String(histMes + 1).padStart(2, '0')}-`
      const tieneZona = allAsigs.some(a => a.personal_id === p.id && a.zona_id === filtroZona && a.fecha.startsWith(prefix))
      if (!tieneZona) return false
    }
    return true
  })

  const labelPeriodo = formatMesLargo(histAnio, histMes)

  return (
    <>
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Historial del personal</p>
            <p className="header-sub" style={{ textTransform: 'capitalize' }}>{labelPeriodo}</p>
          </div>
          <button
            onClick={() => setShowConfirmDelete(true)}
            title="Eliminar todo"
            style={{
              background: '#fee2e2', border: '1.5px solid #fecaca',
              borderRadius: 10, padding: '8px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              color: '#dc2626', fontWeight: 700, fontSize: 13,
            }}
          >
            🗑️
          </button>
        </div>

        {/* Navegador de mes/año */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card)', border: '1.5px solid var(--border)',
          borderRadius: 12, padding: '10px 8px', marginBottom: 12,
        }}>
          <button
            onClick={mesAnterior}
            style={{
              background: 'var(--primary-light)', border: 'none', borderRadius: 8,
              padding: '8px 20px', cursor: 'pointer',
              color: 'var(--primary-dark)', fontWeight: 700, fontSize: 20,
            }}
          >‹</button>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', textTransform: 'capitalize' }}>
            {labelPeriodo}
          </span>
          <button
            onClick={mesSiguiente}
            style={{
              background: 'var(--primary-light)', border: 'none', borderRadius: 8,
              padding: '8px 20px', cursor: 'pointer',
              color: 'var(--primary-dark)', fontWeight: 700, fontSize: 20,
            }}
          >›</button>
        </div>

        {/* Selector de zona */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Zona de limpieza
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {allZonas.filter(z => z.activo !== false).map(z => {
              const activo = filtroZona === z.id
              const prefix = `${histAnio}-${String(histMes + 1).padStart(2, '0')}-`
              const cantPersonas = personalSupabase.filter(p =>
                allAsigs.some(a => a.personal_id === p.id && a.zona_id === z.id && a.fecha.startsWith(prefix))
              ).length
              return (
                <button
                  key={z.id}
                  onClick={() => { setFiltroZona(activo ? null : z.id); setSelId(null); setCategoriaFiltro(null) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
                    background: activo ? 'var(--primary)' : 'var(--bg-card)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: activo ? 'rgba(255,255,255,0.2)' : 'var(--primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>🏢</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: activo ? '#fff' : 'var(--text)' }}>{z.nombre}</p>
                    <p style={{ fontSize: 12, color: activo ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>
                      {cantPersonas} persona{cantPersonas !== 1 ? 's' : ''} este mes
                    </p>
                  </div>
                  {activo && <span style={{ color: '#fff', fontSize: 16 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Chips de categoría */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[
            { key: 'cumplieron',    label: '✅ Cumplieron',    color: '#15803d', bg: '#dcfce7', border: '#86efac' },
            { key: 'noCumplieron',  label: '❌ No cumplieron', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
            { key: 'sinAsignacion', label: '➖ Sin asig.',     color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
          ].map(({ key, label, color, bg, border }) => {
            const activo = categoriaFiltro === key
            return (
              <button
                key={key}
                onClick={() => { setCategoriaFiltro(activo ? null : key); setSelId(null) }}
                style={{
                  flex: 1, padding: '9px 4px', borderRadius: 10, cursor: 'pointer',
                  fontWeight: 700, fontSize: 11, lineHeight: 1.3,
                  border: `2px solid ${activo ? border : 'var(--border)'}`,
                  background: activo ? bg : 'var(--bg-card)',
                  color: activo ? color : 'var(--text)',
                  transition: 'all 0.15s',
                }}
              >{label}</button>
            )
          })}
        </div>

        {/* Lista plana */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingPersonal && (
            <p className="text-muted text-center" style={{ padding: 20 }}>Cargando personal...</p>
          )}
          {!loadingPersonal && !categoriaFiltro && !filtroZona && (
            <p className="text-muted text-center" style={{ padding: 32, fontSize: 14 }}>
              Seleccioná una zona o filtro para ver el personal
            </p>
          )}
          {!loadingPersonal && (categoriaFiltro || filtroZona) && personalFiltrado.length === 0 && (
            <p className="text-muted text-center" style={{ padding: 20 }}>Sin resultados</p>
          )}
          {!loadingPersonal && (categoriaFiltro || filtroZona) && personalFiltrado.map(p => {
            const asigs    = asigsFiltradas(p.id)
            const cantidad = asigs.length
            const abierto  = selId === p.id
            return (
              <div key={p.id}>
                <button
                  onClick={() => setSelId(abierto ? null : p.id)}
                  style={{
                    width: '100%',
                    background: abierto ? 'var(--primary)' : 'var(--bg-card)',
                    border: `1.5px solid ${abierto ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: abierto ? '10px 10px 0 0' : 10,
                    padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    boxShadow: 'var(--shadow)', transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: abierto ? 'rgba(255,255,255,0.2)' : 'var(--primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 15,
                    color: abierto ? '#fff' : 'var(--primary-dark)',
                  }}>
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: abierto ? '#fff' : 'var(--text)' }}>
                      {p.nombre}
                    </p>
                    {p.sector && (
                      <p style={{ fontSize: 12, color: abierto ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                        {p.sector}
                      </p>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, fontSize: 20, color: abierto ? '#fff' : (cantidad > 0 ? 'var(--primary)' : 'var(--text-light)') }}>
                      {cantidad}
                    </p>
                    <p style={{ fontSize: 11, color: abierto ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                      vez{cantidad !== 1 ? 'es' : ''}
                    </p>
                  </div>

                  <span style={{ color: abierto ? '#fff' : 'var(--text-muted)', fontSize: 14 }}>
                    {abierto ? '▲' : '▼'}
                  </span>
                </button>

                {abierto && (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1.5px solid var(--primary)',
                    borderTop: 'none',
                    borderRadius: '0 0 10px 10px',
                    padding: '12px 16px',
                  }}>
                    {asigs.length === 0 ? (
                      <p className="text-muted" style={{ textAlign: 'center', padding: '12px 0' }}>
                        Sin limpieza en este período
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                          {cantidad} limpieza{cantidad !== 1 ? 's' : ''} — {labelPeriodo}
                        </p>
                        {asigs.map(a => {
                          const reg = a.registro
                          const completado  = reg?.completado
                          const enCurso     = reg && !reg.completado
                          const statusColor = completado ? '#15803d' : enCurso ? '#b45309' : '#9ca3af'
                          const statusBg    = completado ? '#dcfce7'  : enCurso ? '#fef3c7' : '#f3f4f6'
                          const statusLabel = completado ? 'Completado' : enCurso ? 'En curso' : 'Sin registro'
                          return (
                            <div key={a.id} style={{
                              background: a.turno === 'mañana' ? 'var(--manana-bg)' : 'var(--noche-bg)',
                              borderRadius: 8, padding: '8px 12px',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                                  {formatFecha(a.fecha)}
                                </p>
                                <span style={{
                                  fontSize: 11, fontWeight: 700,
                                  color: statusColor, background: statusBg,
                                  borderRadius: 6, padding: '2px 8px',
                                }}>
                                  {statusLabel}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                  🏢 {a.zona?.nombre || '—'}
                                </p>
                                <span style={{
                                  fontSize: 11, fontWeight: 700,
                                  color: a.turno === 'mañana' ? 'var(--manana-badge)' : 'var(--noche-badge)',
                                }}>
                                  {a.turno === 'mañana' ? '☀️ Mañana' : '🌙 Noche'}
                                </span>
                              </div>
                              {reg && (reg.hora_entrada || reg.hora_salida) && (
                                <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12 }}>
                                  {reg.hora_entrada && (
                                    <span style={{ color: '#15803d', fontWeight: 600 }}>
                                      ↓ {formatHora(reg.hora_entrada)}
                                    </span>
                                  )}
                                  {reg.hora_salida && (
                                    <span style={{ color: '#1d4ed8', fontWeight: 600 }}>
                                      ↑ {formatHora(reg.hora_salida)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>

    {/* Modal confirmar eliminar todo */}
    {showConfirmDelete && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(30,58,95,0.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }} onClick={() => setShowConfirmDelete(false)}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 16, padding: '28px 24px',
          width: '100%', maxWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          textAlign: 'center',
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
          <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginBottom: 8 }}>
            Eliminar todo el historial
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            Se borrarán todas las asignaciones y registros de limpieza. Esta acción no se puede deshacer.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={eliminarTodo}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 10, cursor: 'pointer',
                background: '#dc2626', border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 15,
              }}
            >
              Sí, eliminar todo
            </button>
            <button
              onClick={() => setShowConfirmDelete(false)}
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
    </>
  )
}
