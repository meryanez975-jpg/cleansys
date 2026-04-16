import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase/client'

// ── helpers ───────────────────────────────────────────────────────
function hoy() { return new Date().toISOString().split('T')[0] }
function ayer() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
function formatHora(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
function duracion(entrada, salida) {
  if (!entrada || !salida) return null
  const seg = Math.floor((new Date(salida) - new Date(entrada)) / 1000)
  const h   = Math.floor(seg / 3600)
  const m   = Math.floor((seg % 3600) / 60)
  const s   = seg % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
function formatFecha(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// Lee todo lo que necesitamos de localStorage
function getDatosDelDia(fecha, turno) {
  try {
    const asigs  = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
    const regs   = JSON.parse(localStorage.getItem('cleansys_registros')    || '[]')
    const zonas  = JSON.parse(localStorage.getItem('cleansys_zonas')        || '[]')

    return asigs
      .filter(a => a.fecha === fecha && a.turno === turno && a.activo !== false)
      .map(a => {
        const reg  = regs.find(r => r.asignacion_id === a.id) || null
        const zona = zonas.find(z => z.id === a.zona_id) || null
        return { ...a, registro: reg, zona }
      })
  } catch { return [] }
}

export default function ControlCronometros() {
  const navigate = useNavigate()

  const [turno,  setTurno]  = useState('mañana')  // 'mañana' | 'noche'
  const [diaKey, setDiaKey] = useState('hoy')     // 'hoy' | 'ayer'
  const [personalMap, setPersonalMap] = useState({})
  const [tick, setTick] = useState(0)

  const fecha = diaKey === 'hoy' ? hoy() : ayer()

  // Carga personal desde Supabase
  useEffect(() => {
    supabase.from('com_personal').select('id, nombre, sector').eq('activo', true)
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(p => { map[p.id] = p })
          setPersonalMap(map)
        }
      })
  }, [])

  // Refresca cada 30s para que los "en curso" no queden obsoletos
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  void tick
  const filas = getDatosDelDia(fecha, turno)

  // Separar por estado
  const completadas  = filas.filter(f => f.registro?.completado)
  const enCurso      = filas.filter(f => f.registro && !f.registro.completado)
  const sinRegistro  = filas.filter(f => !f.registro)

  function getNombre(f) {
    return personalMap[f.personal_id]?.nombre || f.personalNombre || '—'
  }
  function getSector(f) {
    return personalMap[f.personal_id]?.sector || f.personalSector || ''
  }

  // ── contadores para los botones de turno
  const totalManana = getDatosDelDia(fecha, 'mañana').length
  const totalNoche  = getDatosDelDia(fecha, 'noche').length

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Control de limpiezas</p>
            <p className="header-sub" style={{ textTransform: 'capitalize' }}>{formatFecha(fecha)}</p>
          </div>
        </div>

        {/* Filtro Hoy / Ayer */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            { key: 'hoy',  label: '📅 Hoy'  },
            { key: 'ayer', label: '🕐 Ayer' },
          ].map(({ key, label }) => {
            const activo = diaKey === key
            return (
              <button
                key={key}
                onClick={() => setDiaKey(key)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                  fontWeight: 700, fontSize: 14,
                  border: `2px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
                  background: activo ? 'var(--primary)' : 'var(--bg-card)',
                  color: activo ? '#fff' : 'var(--text)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Filtro turno Mañana / Noche */}
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

        {filas.length === 0 ? (
          <div className="card text-center" style={{ padding: 32 }}>
            <p style={{ fontSize: 32, marginBottom: 10 }}>📭</p>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              Sin asignaciones para este turno
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Sin registro → No hizo la limpieza ── */}
            {sinRegistro.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0,
                  }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    No hizo la limpieza ({sinRegistro.length})
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sinRegistro.map(f => (
                    <div key={f.id} style={{
                      background: '#fef2f2', border: '1.5px solid #fecaca',
                      borderLeft: '4px solid #ef4444',
                      borderRadius: 10, padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 15, color: '#dc2626',
                      }}>
                        {getNombre(f).charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{getNombre(f)}</p>
                        {getSector(f) && <p style={{ fontSize: 12, color: '#64748b' }}>{getSector(f)}</p>}
                        <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>🏢 {f.zona?.nombre || '—'}</p>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#dc2626',
                        background: '#fee2e2', borderRadius: 6, padding: '3px 10px',
                        flexShrink: 0,
                      }}>
                        ❌ No registró
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── En curso ── */}
            {enCurso.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0,
                  }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    En curso ({enCurso.length})
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {enCurso.map(f => (
                    <div key={f.id} style={{
                      background: '#fffbeb', border: '1.5px solid #fde68a',
                      borderLeft: '4px solid #f59e0b',
                      borderRadius: 10, padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 15, color: '#b45309',
                      }}>
                        {getNombre(f).charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{getNombre(f)}</p>
                        {getSector(f) && <p style={{ fontSize: 12, color: '#64748b' }}>{getSector(f)}</p>}
                        <p style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
                          ⏱ Inicio: {formatHora(f.registro.hora_entrada)} · 🏢 {f.zona?.nombre || '—'}
                        </p>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#b45309',
                        background: '#fef3c7', borderRadius: 6, padding: '3px 10px',
                        flexShrink: 0,
                      }}>
                        🟡 En curso
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Completadas ── */}
            {completadas.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
                  }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Completadas ({completadas.length})
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {completadas.map(f => {
                    const dur = duracion(f.registro.hora_entrada, f.registro.hora_salida)
                    return (
                      <div key={f.id} style={{
                        background: '#f0fdf4', border: '1.5px solid #bbf7d0',
                        borderLeft: '4px solid #22c55e',
                        borderRadius: 10, padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                          background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 15, color: '#15803d',
                        }}>
                          {getNombre(f).charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{getNombre(f)}</p>
                          {getSector(f) && <p style={{ fontSize: 12, color: '#64748b' }}>{getSector(f)}</p>}
                          <p style={{ fontSize: 12, color: '#15803d', marginTop: 2 }}>
                            {formatHora(f.registro.hora_entrada)} → {formatHora(f.registro.hora_salida)}
                            {dur && <span style={{ fontWeight: 700, marginLeft: 6 }}>({dur})</span>}
                          </p>
                          <p style={{ fontSize: 12, color: '#64748b' }}>🏢 {f.zona?.nombre || '—'}</p>
                          {f.registro.notas && (
                            <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📝 {f.registro.notas}</p>
                          )}
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: '#15803d',
                          background: '#dcfce7', borderRadius: 6, padding: '3px 10px',
                          flexShrink: 0,
                        }}>
                          ✅ Listo
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
