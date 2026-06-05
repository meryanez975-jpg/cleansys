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
        {/* Selector de zona como dropdown */}
        <select
          value={filtroZona || ''}
          onChange={e => { setFiltroZona(e.target.value || null); setSelId(null); setCategoriaFiltro(null) }}
          style={{
            width: '100%', padding: '12px 14px', marginBottom: 12,
            borderRadius: 10, border: '1.5px solid var(--border)',
            background: 'var(--bg-card)', color: 'var(--text)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            appearance: 'none', WebkitAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
          }}
        >
          <option value=''>🏢 Filtrar por zona...</option>
          {allZonas.filter(z => z.activo !== false).map(z => (
            <option key={z.id} value={z.id}>🏢 {z.nombre}</option>
          ))}
        </select>

        {/* Chips de categoría — solo visibles si hay zona seleccionada */}
        {filtroZona && <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
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
        </div>}

        {/* Lista plana */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingPersonal && (
            <p className="text-muted text-center" style={{ padding: 20 }}>Cargando personal...</p>
          )}
          {!loadingPersonal && !filtroZona && (
            <div style={{
              textAlign: 'center', padding: '40px 24px',
              background: 'var(--bg-card)', borderRadius: 16,
              border: '1.5px dashed var(--border)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, margin: '0 auto 16px',
              }}>📋</div>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
                Elegí una zona
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Seleccioná una zona arriba para ver quién limpió.<br />Después podés filtrar por ✅ ❌ ➖
              </p>
            </div>
          )}
          {!loadingPersonal && filtroZona && personalFiltrado.length === 0 && (
            <p className="text-muted text-center" style={{ padding: 20 }}>Sin resultados</p>
          )}
          {!loadingPersonal && filtroZona && personalFiltrado.map(p => {
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
                    ) : (() => {
                      const DIAS_SEMANA = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
                      const asigsFiltradas2 = asigs.filter(a => {
                        if (!categoriaFiltro) return true
                        const completado = a.registro?.completado
                        if (categoriaFiltro === 'cumplieron')   return completado
                        if (categoriaFiltro === 'noCumplieron') return !completado
                        return true
                      })
                      const porDia = DIAS_SEMANA.map((nombre, i) => ({
                        nombre,
                        asigs: asigsFiltradas2.filter(a => {
                          const d = new Date(a.fecha + 'T12:00:00').getDay()
                          return (d === 0 ? 6 : d - 1) === i
                        }).sort((a, b) => a.fecha.localeCompare(b.fecha))
                      })).filter(d => d.asigs.length > 0)

                      const totalNoCumplieron = asigs.filter(a => !a.registro?.completado).length
                      const totalCumplieron   = asigs.filter(a =>  a.registro?.completado).length

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {/* Resumen */}
                          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                            <div style={{ flex: 1, background: '#dcfce7', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                              <p style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>{totalCumplieron}</p>
                              <p style={{ fontSize: 10, fontWeight: 700, color: '#15803d' }}>✅ Cumplidos</p>
                            </div>
                            <div style={{ flex: 1, background: '#fee2e2', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                              <p style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{totalNoCumplieron}</p>
                              <p style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>❌ Sin registro</p>
                            </div>
                          </div>

                          {/* Por día de semana */}
                          {porDia.map(dia => (
                            <div key={dia.nombre}>
                              <p style={{
                                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                marginBottom: 6,
                              }}>{dia.nombre}</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {dia.asigs.map(a => {
                                  const reg = a.registro
                                  const completado = reg?.completado
                                  const noCumplió  = !completado
                                  return (
                                    <div key={a.id} style={{
                                      display: 'flex', alignItems: 'center', gap: 10,
                                      background: noCumplió ? '#fff1f2' : '#f0fdf4',
                                      border: `1.5px solid ${noCumplió ? '#fecdd3' : '#bbf7d0'}`,
                                      borderRadius: 8, padding: '8px 12px',
                                    }}>
                                      <span style={{ fontSize: 16 }}>{noCumplió ? '❌' : '✅'}</span>
                                      <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                                          {new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                        </p>
                                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                          {a.turno === 'mañana' ? '☀️ Mañana' : '🌙 Noche'} · 🏢 {a.zona?.nombre || '—'}
                                        </p>
                                      </div>
                                      {reg?.hora_entrada && (
                                        <p style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>
                                          {formatHora(reg.hora_entrada)} → {formatHora(reg.hora_salida)}
                                        </p>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
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
