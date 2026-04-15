import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase/client'

// ── helpers de fecha ──────────────────────────────────────────────
function hoy() { return new Date().toISOString().split('T')[0] }
function mesActualStr() { return hoy().slice(0, 7) }

function diasEnMes(mes) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function formatMesLargo(mes) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}
function fechasDeSemanaActual() {
  const d = new Date()
  const dow = d.getDay()
  const lunes = new Date(d)
  lunes.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(lunes)
    x.setDate(lunes.getDate() + i)
    return x.toISOString().split('T')[0]
  })
}
function fechasDeRangoISO(desde, hasta) {
  if (!desde || !hasta || desde > hasta) return []
  const fechas = []
  const d = new Date(desde + 'T12:00:00')
  const h = new Date(hasta + 'T12:00:00')
  while (d <= h) { fechas.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }
  return fechas
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

// ── componente principal ──────────────────────────────────────────
export default function HistorialPersonal() {
  const navigate = useNavigate()

  const [histFiltro, setHistFiltro] = useState('mes')
  const [histDesde, setHistDesde]   = useState(hoy())
  const [histHasta, setHistHasta]   = useState(hoy())
  const [histAnio, setHistAnio]     = useState(new Date().getFullYear())
  const [selId, setSelId]           = useState(null)
  const [busqueda, setBusqueda]     = useState('')
  const [showFiltros, setShowFiltros] = useState(false)
  const [personalSupabase, setPersonalSupabase] = useState([])
  const [loadingPersonal, setLoadingPersonal]   = useState(true)

  useEffect(() => {
    supabase.from('com_personal').select('id, nombre, sector, turno').eq('activo', true).order('nombre')
      .then(({ data }) => {
        if (data) setPersonalSupabase(data)
        setLoadingPersonal(false)
      })
  }, [])

  // Conjunto de fechas según filtro activo
  const fechasFiltro = useMemo(() => {
    if (histFiltro === 'hoy')   return new Set([hoy()])
    if (histFiltro === 'semana') return new Set(fechasDeSemanaActual())
    if (histFiltro === 'mes') {
      const mes   = mesActualStr()
      const total = diasEnMes(mes)
      const [y, m] = mes.split('-')
      const arr = Array.from({ length: total }, (_, i) =>
        `${y}-${m}-${String(i + 1).padStart(2, '0')}`
      )
      return new Set(arr)
    }
    if (histFiltro === 'rango') return new Set(fechasDeRangoISO(histDesde, histHasta))
    if (histFiltro === 'anio')  return null  // null = comparar con startsWith
    return new Set()
  }, [histFiltro, histDesde, histHasta, histAnio])

  // Todas las asignaciones y registros
  const { allAsigs, allRegs, allZonas } = useMemo(() => {
    try {
      return {
        allAsigs: JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]').filter(a => a.activo !== false),
        allRegs:  JSON.parse(localStorage.getItem('cleansys_registros') || '[]'),
        allZonas: JSON.parse(localStorage.getItem('cleansys_zonas') || '[]'),
      }
    } catch { return { allAsigs: [], allRegs: [], allZonas: [] } }
  }, [histFiltro, histDesde, histHasta, histAnio])

  function asigsFiltradas(personal_id) {
    return allAsigs.filter(a => {
      if (a.personal_id !== personal_id) return false
      if (histFiltro === 'anio') return a.fecha.startsWith(String(histAnio))
      return fechasFiltro.has(a.fecha)
    }).map(a => ({
      ...a,
      zona: allZonas.find(z => z.id === a.zona_id) || null,
      registro: allRegs.find(r => r.asignacion_id === a.id) || null,
    })).sort((a, b) => b.fecha.localeCompare(a.fecha))
  }

  // Personal que coincide con la búsqueda (viene de Supabase com_personal)
  const personalFiltrado = personalSupabase.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Etiqueta del período activo
  const labelPeriodo = (() => {
    if (histFiltro === 'hoy')    return 'Hoy'
    if (histFiltro === 'semana') return 'Esta semana'
    if (histFiltro === 'mes')    return formatMesLargo(mesActualStr())
    if (histFiltro === 'rango' && histDesde && histHasta)
      return `${histDesde} → ${histHasta}`
    if (histFiltro === 'anio')   return String(histAnio)
    return ''
  })()

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Historial del personal</p>
            <p className="header-sub" style={{ textTransform: 'capitalize' }}>{labelPeriodo}</p>
          </div>
        </div>

        {/* Buscador + botón filtro */}
        <div style={{ display: 'flex', gap: 8, marginBottom: showFiltros ? 0 : 12 }}>
          <input
            className="input"
            placeholder="Buscar persona..."
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setSelId(null) }}
            style={{ flex: 1, margin: 0 }}
          />
          <button
            onClick={() => setShowFiltros(v => !v)}
            style={{
              padding: '0 14px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${showFiltros ? 'var(--primary)' : 'var(--border)'}`,
              background: showFiltros ? 'var(--primary)' : 'var(--bg-card)',
              color: showFiltros ? '#fff' : 'var(--text)',
              fontWeight: 700, fontSize: 15, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
          >
            🔍
            <span style={{ fontSize: 12 }}>{labelPeriodo}</span>
          </button>
        </div>

        {/* Panel de filtros desplegable */}
        {showFiltros && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '0 0 12px 12px', padding: '14px 14px 16px',
            marginBottom: 12, boxShadow: 'var(--shadow)',
          }}>
            {/* Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { key: 'hoy',    label: 'Hoy' },
                { key: 'semana', label: 'Semana' },
                { key: 'mes',    label: 'Este mes' },
                { key: 'rango',  label: 'Rango de fechas' },
                { key: 'anio',   label: 'Año' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setHistFiltro(key); setSelId(null) }}
                  style={{
                    padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
                    fontWeight: 700, fontSize: 13,
                    border: `2px solid ${histFiltro === key ? 'var(--primary)' : 'var(--border)'}`,
                    background: histFiltro === key ? 'var(--primary)' : 'transparent',
                    color: histFiltro === key ? '#fff' : 'var(--text)',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Inputs de rango */}
            {histFiltro === 'rango' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="date" value={histDesde}
                  onChange={e => { setHistDesde(e.target.value); setSelId(null) }}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8,
                    border: '2px solid var(--border)', fontSize: 13,
                    background: 'var(--bg)', color: 'var(--text)',
                  }}
                />
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>→</span>
                <input
                  type="date" value={histHasta}
                  onChange={e => { setHistHasta(e.target.value); setSelId(null) }}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8,
                    border: '2px solid var(--border)', fontSize: 13,
                    background: 'var(--bg)', color: 'var(--text)',
                  }}
                />
              </div>
            )}

            {/* Selector de año */}
            {histFiltro === 'anio' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
                <button
                  onClick={() => { setHistAnio(y => y - 1); setSelId(null) }}
                  style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}
                >‹</button>
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)', minWidth: 60, textAlign: 'center' }}>
                  {histAnio}
                </span>
                <button
                  onClick={() => { setHistAnio(y => y + 1); setSelId(null) }}
                  style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}
                >›</button>
              </div>
            )}
          </div>
        )}

        {/* Lista de personal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingPersonal && (
            <p className="text-muted text-center" style={{ padding: 20 }}>Cargando personal...</p>
          )}
          {!loadingPersonal && personalFiltrado.length === 0 && (
            <p className="text-muted text-center" style={{ padding: 20 }}>Sin resultados</p>
          )}

          {personalFiltrado.map(p => {
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
                  {/* Avatar */}
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

                {/* Detalle expandido */}
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
                          const completado = reg?.completado
                          const enCurso   = reg && !reg.completado
                          const statusColor = completado ? '#15803d' : enCurso ? '#b45309' : '#9ca3af'
                          const statusBg    = completado ? '#dcfce7'  : enCurso ? '#fef3c7' : '#f3f4f6'
                          const statusLabel = completado ? 'Completado' : enCurso ? 'En curso' : 'Sin registro'

                          return (
                            <div key={a.id} style={{
                              background: a.turno === 'mañana' ? 'var(--manana-bg)' : 'var(--noche-bg)',
                              borderRadius: 8, padding: '8px 12px',
                            }}>
                              {/* fecha + estado */}
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

                              {/* zona + turno */}
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

                              {/* horarios */}
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
  )
}
