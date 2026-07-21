import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase/client'
import { pullFromSupabase } from '../hooks/useAsignaciones'
import { pullRegistros } from '../hooks/useRegistros'

// ── helpers de fecha ──────────────────────────────────────────────
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function hoy() { return localISO(new Date()) }
function ayer() {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return localISO(d)
}
function fechasSemanaActual() {
  const d = new Date()
  const dow = d.getDay()
  const lunes = new Date(d)
  lunes.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(lunes); x.setDate(lunes.getDate() + i)
    return localISO(x)
  })
}
function fechasSemanaAnterior() {
  const d = new Date(); d.setDate(d.getDate() - 7)
  const dow = d.getDay()
  const lunes = new Date(d)
  lunes.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(lunes); x.setDate(lunes.getDate() + i)
    return localISO(x)
  })
}
function formatHora(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
function duracion(entrada, salida) {
  if (!entrada || !salida) return null
  const seg = Math.floor((new Date(salida) - new Date(entrada)) / 1000)
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
function formatFechaCorta(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}
function formatFechaLarga(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ── datos desde localStorage ──────────────────────────────────────
function getDatosDelDia(fecha, turno) {
  try {
    const asigs = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
    const regs  = JSON.parse(localStorage.getItem('cleansys_registros')    || '[]')
    const zonas = JSON.parse(localStorage.getItem('cleansys_zonas')        || '[]')
    return asigs
      .filter(a => a.fecha === fecha && a.turno === turno && a.activo !== false)
      .map(a => {
        // Sesión más reciente (puede haber varias por asignacion)
        const sesiones = regs.filter(r => r.asignacion_id === a.id)
        const ultimaSession = sesiones.length
          ? sesiones.reduce((lat, r) => ((r.hora_entrada || '') > (lat.hora_entrada || '') ? r : lat))
          : null
        return {
          ...a,
          registro: ultimaSession,
          zona:     zonas.find(z => z.id === a.zona_id) || null,
        }
      })
  } catch { return [] }
}

function eliminarRegistro(asignacion_id) {
  try {
    const regs = JSON.parse(localStorage.getItem('cleansys_registros') || '[]')
    localStorage.setItem('cleansys_registros', JSON.stringify(
      regs.filter(r => r.asignacion_id !== asignacion_id)
    ))
  } catch {}
}

// ── tarjeta de empleado ───────────────────────────────────────────
function TarjetaEmpleado({ f, nombre, sector, onEliminar, mostrarEliminar }) {
  const reg = f.registro
  const completado  = reg?.completado
  const enCurso     = reg && !reg.completado
  const sinRegistro = !reg

  const esCompletado  = completado
  const esEnCurso     = enCurso
  const esSinRegistro = sinRegistro

  const colorBorde  = esCompletado ? '#22c55e' : esEnCurso ? '#f59e0b' : '#ef4444'
  const bgCard      = esCompletado ? '#f0fdf4' : esEnCurso ? '#fffbeb' : '#fef2f2'
  const bgBorde     = esCompletado ? '#bbf7d0' : esEnCurso ? '#fde68a' : '#fecaca'
  const bgAvatar    = esCompletado ? '#dcfce7' : esEnCurso ? '#fef3c7' : '#fee2e2'
  const colorAvatar = esCompletado ? '#15803d' : esEnCurso ? '#b45309' : '#dc2626'
  const badgeBg     = esCompletado ? '#dcfce7' : esEnCurso ? '#fef3c7' : '#fee2e2'
  const badgeColor  = esCompletado ? '#15803d' : esEnCurso ? '#b45309' : '#dc2626'
  const badgeLabel  = esCompletado ? '✅ Listo' : esEnCurso ? '🟡 En curso' : '❌ No registró'

  return (
    <div style={{
      background: bgCard,
      border: `1.5px solid ${bgBorde}`,
      borderLeft: `4px solid ${colorBorde}`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: bgAvatar,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 15, color: colorAvatar,
      }}>
        {nombre.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{nombre}</p>
        {sector && <p style={{ fontSize: 12, color: '#64748b' }}>{sector}</p>}
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>🏢 {f.zona?.nombre || '—'}</p>
        {esCompletado && (
          <p style={{ fontSize: 12, color: '#15803d', marginTop: 2 }}>
            {formatHora(reg.hora_entrada)} → {formatHora(reg.hora_salida)}
            {duracion(reg.hora_entrada, reg.hora_salida) && (
              <strong style={{ marginLeft: 6 }}>({duracion(reg.hora_entrada, reg.hora_salida)})</strong>
            )}
          </p>
        )}
        {esEnCurso && (
          <p style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
            ⏱ Inicio: {formatHora(reg.hora_entrada)}
          </p>
        )}
        {reg?.notas && (
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📝 {reg.notas}</p>
        )}
      </div>

      {/* Derecha: badge + botón ✕ */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: badgeColor,
          background: badgeBg, borderRadius: 6, padding: '3px 10px',
        }}>
          {badgeLabel}
        </span>
        {mostrarEliminar && reg && (
          <button
            onClick={() => onEliminar(f.id)}
            title="Reiniciar limpieza"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#fee2e2', border: '1.5px solid #fca5a5',
              color: '#dc2626', fontWeight: 800, fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// ── eliminar datos del localStorage ──────────────────────────────
function eliminarPorFechas(fechasArr) {
  try {
    const asigs = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
    const regs  = JSON.parse(localStorage.getItem('cleansys_registros')    || '[]')
    const fechasSet = new Set(fechasArr)
    const idsEliminados = new Set(asigs.filter(a => fechasSet.has(a.fecha)).map(a => a.id))
    localStorage.setItem('cleansys_asignaciones', JSON.stringify(asigs.filter(a => !fechasSet.has(a.fecha))))
    localStorage.setItem('cleansys_registros',    JSON.stringify(regs.filter(r => !idsEliminados.has(r.asignacion_id))))
  } catch {}
}

function eliminarTodoElHistorial() {
  localStorage.removeItem('cleansys_asignaciones')
  localStorage.removeItem('cleansys_registros')
}

// ── página principal ──────────────────────────────────────────────
const OPCIONES_FECHA = [
  { key: 'hoy',          label: 'Hoy' },
  { key: 'ayer',         label: 'Ayer' },
  { key: 'semana',       label: 'Esta semana' },
  { key: 'semana_ant',   label: 'Semana pasada' },
]

export default function ControlCronometros() {
  const navigate = useNavigate()

  const [turno,     setTurno]     = useState('mañana')
  const [diaKey,    setDiaKey]    = useState('hoy')
  const [showFiltro, setShowFiltro] = useState(false)
  const [personalMap, setPersonalMap] = useState({})
  const [tick, setTick] = useState(0)
  const [confirmandoZona, setConfirmandoZona] = useState(null) // zonaId a eliminar

  useEffect(() => {
    supabase.from('com_personal').select('id, nombre, sector').eq('activo', true)
      .then(({ data, error }) => {
        if (error) { console.error('ControlCronometros personal:', error); return }
        if (data) {
          const map = {}
          data.forEach(p => { map[p.id] = p })
          setPersonalMap(map)
        }
      })
      .catch(err => console.error('ControlCronometros personal:', err))
  }, [])

  useEffect(() => {
    Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1))
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1))
    }, 15_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function handleVisibilidad() {
      if (!document.hidden) {
        Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilidad)
    return () => document.removeEventListener('visibilitychange', handleVisibilidad)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('controlcronometros-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'limpieza_asignaciones' },
        () => { Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1)) }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'limpieza_registros' },
        () => { Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1)) }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  void tick

  // Fechas a mostrar según filtro
  const fechas = (() => {
    if (diaKey === 'hoy')        return [hoy()]
    if (diaKey === 'ayer')       return [ayer()]
    if (diaKey === 'semana')     return fechasSemanaActual()
    if (diaKey === 'semana_ant') return fechasSemanaAnterior()
    return [hoy()]
  })()

  const esMultiDia = fechas.length > 1
  const labelFiltro = OPCIONES_FECHA.find(o => o.key === diaKey)?.label || 'Hoy'

  const labelRangoFecha = (() => {
    if (fechas.length === 1) return fechas[0]
    const fmt = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    return `${fmt(fechas[0])} — ${fmt(fechas[fechas.length - 1])}`
  })()

  function getNombre(f) {
    return personalMap[f.personal_id]?.nombre || f.personalNombre || '—'
  }
  function getSector(f) {
    return personalMap[f.personal_id]?.sector || f.personalSector || ''
  }

  async function handleEliminar(asignacion_id) {
    await supabase.from('limpieza_registros').delete().eq('asignacion_id', asignacion_id)
    eliminarRegistro(asignacion_id)
    setTick(t => t + 1)
  }

  async function handleEliminarZona(zonaId) {
    try {
      const asigs = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
      const zonaAsigIds = asigs
        .filter(a => a.zona_id === zonaId && fechas.includes(a.fecha) && a.turno === turno)
        .map(a => a.id)

      if (zonaAsigIds.length > 0) {
        await supabase.from('limpieza_registros').delete().in('asignacion_id', zonaAsigIds)
        await supabase.from('limpieza_asignaciones').update({ activo: false }).in('id', zonaAsigIds)

        const newAsigs = asigs.map(a => zonaAsigIds.includes(a.id) ? { ...a, activo: false } : a)
        const regs = JSON.parse(localStorage.getItem('cleansys_registros') || '[]')
        localStorage.setItem('cleansys_asignaciones', JSON.stringify(newAsigs))
        localStorage.setItem('cleansys_registros', JSON.stringify(regs.filter(r => !zonaAsigIds.includes(r.asignacion_id))))
      }
    } catch (e) { console.error('handleEliminarZona:', e) }
    setConfirmandoZona(null)
    setTick(t => t + 1)
  }

  // Contadores para botones de turno (solo fecha activa / suma de semana)
  const totalManana = fechas.reduce((s, f) => s + getDatosDelDia(f, 'mañana').length, 0)
  const totalNoche  = fechas.reduce((s, f) => s + getDatosDelDia(f, 'noche').length,  0)

  // Datos agrupados por fecha
  const diasConDatos = fechas
    .map(fecha => ({ fecha, filas: getDatosDelDia(fecha, turno) }))
    .filter(d => d.filas.length > 0)

  const todasLasFilas = diasConDatos.flatMap(d => d.filas)
  const completadas   = todasLasFilas.filter(f => f.registro?.completado)
  const enCurso       = todasLasFilas.filter(f => f.registro && !f.registro.completado)
  const sinRegistro   = todasLasFilas.filter(f => !f.registro)

  // ── render ────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Control de limpiezas</p>
            <p className="header-sub" style={{ textTransform: 'capitalize' }}>{labelFiltro}</p>
          </div>
        </div>

        {/* Filtro de fechas — desplegable */}
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => setShowFiltro(v => !v)}
            style={{
              width: '100%', padding: '11px 16px',
              background: showFiltro ? 'var(--primary)' : 'var(--bg-card)',
              border: `1.5px solid ${showFiltro ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: showFiltro ? '10px 10px 0 0' : 10,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: 'var(--shadow)', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: showFiltro ? '#fff' : 'var(--text)' }}>
              📅 {labelFiltro}
            </span>
            <span style={{ color: showFiltro ? '#fff' : 'var(--text-muted)', fontSize: 13 }}>
              {showFiltro ? '▲' : '▼'}
            </span>
          </button>

          {showFiltro && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--primary)', borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '8px 10px 10px',
              boxShadow: 'var(--shadow)',
            }}>
              {OPCIONES_FECHA.map(({ key, label }) => {
                const activo = diaKey === key
                return (
                  <button
                    key={key}
                    onClick={() => { setDiaKey(key); setShowFiltro(false) }}
                    style={{
                      width: '100%', padding: '10px 14px',
                      borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
                      background: activo ? 'var(--primary)' : 'transparent',
                      color: activo ? '#fff' : 'var(--text)',
                      fontWeight: 700, fontSize: 14, textAlign: 'left',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                    {activo && <span style={{ fontSize: 12 }}>✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Turno Mañana / Noche */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'mañana', label: '☀️ Mañana', count: totalManana, color: 'var(--manana-badge)', bg: 'var(--manana-bg)' },
            { key: 'noche',  label: '🌙 Noche',  count: totalNoche,  color: 'var(--noche-badge)',  bg: 'var(--noche-bg)'  },
          ].map(({ key, label, count, color, bg }) => {
            const activo = turno === key
            return (
              <button
                key={key}
                onClick={() => setTurno(key)}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${activo ? color : 'var(--border)'}`,
                  background: activo ? bg : 'var(--bg-card)',
                  textAlign: 'center', transition: 'all 0.15s',
                  boxShadow: activo ? `0 2px 8px ${color}33` : 'var(--shadow)',
                }}
              >
                <p style={{ fontSize: 20, fontWeight: 800, color: activo ? color : 'var(--text)' }}>{count}</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: activo ? color : 'var(--text-muted)' }}>{label}</p>
              </button>
            )
          })}
        </div>

        {/* Sin datos */}
        {todasLasFilas.length === 0 ? (
          <div className="card text-center" style={{ padding: 32 }}>
            <p style={{ fontSize: 32, marginBottom: 10 }}>📭</p>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              Sin asignaciones para este período
            </p>
          </div>
        ) : (() => {
          // Agrupar por zona
          const gruposMap = {}
          todasLasFilas.forEach(f => {
            const zonaId = f.zona_id || '__sin_zona__'
            const zonaNombre = f.zona?.nombre || 'Sin zona'
            if (!gruposMap[zonaId]) gruposMap[zonaId] = { zonaId, zonaNombre, filas: [] }
            gruposMap[zonaId].filas.push(f)
          })
          const grupos = Object.values(gruposMap).sort((a, b) => a.zonaNombre.localeCompare(b.zonaNombre))

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {grupos.map(grupo => {
                const sinReg = grupo.filas.filter(f => !f.registro)
                const enCur  = grupo.filas.filter(f => f.registro && !f.registro.completado)
                const compl  = grupo.filas.filter(f => f.registro?.completado)
                return (
                  <div key={grupo.zonaId} style={{
                    background: 'var(--bg-card)', borderRadius: 14,
                    border: '1px solid var(--border)', overflow: 'hidden',
                    boxShadow: 'var(--shadow)',
                  }}>
                    {/* Encabezado de zona */}
                    <div style={{ background: 'var(--primary)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>🏢</span>
                      <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>{grupo.zonaNombre}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                        {grupo.filas.length} {grupo.filas.length === 1 ? 'persona' : 'personas'}
                      </span>
                    </div>

                    {/* Contenido de la zona */}
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {sinReg.length > 0 && (
                        <Seccion
                          color="#ef4444" label={`No registró (${sinReg.length})`}
                          filas={sinReg} esMultiDia={esMultiDia}
                          getNombre={getNombre} getSector={getSector}
                          onEliminar={handleEliminar} mostrarEliminar={false}
                        />
                      )}
                      {enCur.length > 0 && (
                        <Seccion
                          color="#f59e0b" label={`En curso (${enCur.length})`}
                          filas={enCur} esMultiDia={esMultiDia}
                          getNombre={getNombre} getSector={getSector}
                          onEliminar={handleEliminar} mostrarEliminar={true}
                        />
                      )}
                      {compl.length > 0 && (
                        <Seccion
                          color="#22c55e" label={`Completadas (${compl.length})`}
                          filas={compl} esMultiDia={esMultiDia}
                          getNombre={getNombre} getSector={getSector}
                          onEliminar={handleEliminar} mostrarEliminar={true}
                        />
                      )}

                      {/* Botón eliminar solo esta zona */}
                      <button
                        onClick={() => setConfirmandoZona(grupo.zonaId)}
                        style={{
                          marginTop: 4, width: '100%', padding: '9px 0',
                          borderRadius: 8, border: '1.5px solid #fecaca',
                          background: '#fff1f2', color: '#dc2626',
                          fontWeight: 700, fontSize: 12, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        🗑️ Eliminar datos de {grupo.zonaNombre}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* ── Modal confirmar eliminar zona ── */}
        {confirmandoZona && (() => {
          const asigs = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
          const zonas = JSON.parse(localStorage.getItem('cleansys_zonas') || '[]')
          const zona = zonas.find(z => z.id === confirmandoZona)
          return (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 999,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }} onClick={() => setConfirmandoZona(null)}>
              <div style={{
                background: '#fff', borderRadius: 16, padding: '28px 22px',
                width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                textAlign: 'center',
              }} onClick={e => e.stopPropagation()}>
                <p style={{ fontSize: 36, marginBottom: 10 }}>🗑️</p>
                <p style={{ fontWeight: 800, fontSize: 17, color: '#1e293b', marginBottom: 8 }}>
                  Eliminar datos de {zona?.nombre || 'esta zona'}
                </p>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 22, lineHeight: 1.5 }}>
                  Se borrarán las asignaciones y registros de <strong>{zona?.nombre}</strong> para el período seleccionado.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => handleEliminarZona(confirmandoZona)}
                    style={{ padding: '13px', borderRadius: 10, cursor: 'pointer', background: '#dc2626', border: 'none', fontWeight: 700, fontSize: 15, color: '#fff' }}
                  >
                    Sí, eliminar {zona?.nombre}
                  </button>
                  <button
                    onClick={() => setConfirmandoZona(null)}
                    style={{ padding: '13px', borderRadius: 10, cursor: 'pointer', background: 'var(--bg)', border: '1.5px solid var(--border)', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}

// ── Sección con título y lista de tarjetas ────────────────────────
function Seccion({ color, label, filas, esMultiDia, getNombre, getSector, onEliminar, mostrarEliminar }) {
  // En modo multi-día, agrupar por fecha
  const porFecha = filas.reduce((acc, f) => {
    if (!acc[f.fecha]) acc[f.fecha] = []
    acc[f.fecha].push(f)
    return acc
  }, {})

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: esMultiDia ? 12 : 8 }}>
        {esMultiDia
          ? Object.entries(porFecha)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([fecha, rows]) => (
                <div key={fecha}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'capitalize' }}>
                    {formatFechaCorta(fecha)}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rows.map(f => (
                      <TarjetaEmpleado
                        key={f.id} f={f}
                        nombre={getNombre(f)} sector={getSector(f)}
                        onEliminar={onEliminar} mostrarEliminar={mostrarEliminar}
                      />
                    ))}
                  </div>
                </div>
              ))
          : filas.map(f => (
              <TarjetaEmpleado
                key={f.id} f={f}
                nombre={getNombre(f)} sector={getSector(f)}
                onEliminar={onEliminar} mostrarEliminar={mostrarEliminar}
              />
            ))
        }
      </div>
    </div>
  )
}
