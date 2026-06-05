import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'
import { useAsignaciones } from '../hooks/useAsignaciones'
import { useRegistros } from '../hooks/useRegistros'
import { getTareasZona } from '../data/store'

// ── helpers de fecha ──────────────────────────────────────────────
function hoy() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function mesActualStr() { return hoy().slice(0, 7) }
function diasEnMes(mes) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function offsetMes(mes) {
  const [y, m] = mes.split('-').map(Number)
  const dow = new Date(y, m - 1, 1).getDay()
  return dow === 0 ? 6 : dow - 1
}
function addMes(mes, delta) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function formatMesLargo(mes) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}
function formatHora(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

// ── Cronómetro ────────────────────────────────────────────────────
function Cronometro({ horaEntrada }) {
  const [seg, setSeg] = useState(0)

  useEffect(() => {
    if (!horaEntrada) return
    const inicio = new Date(horaEntrada).getTime()
    setSeg(Math.max(0, Math.floor((Date.now() - inicio) / 1000)))
    const id = setInterval(() => {
      setSeg(Math.max(0, Math.floor((Date.now() - inicio) / 1000)))
    }, 1000)
    return () => clearInterval(id)
  }, [horaEntrada])

  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const fmt = n => String(n).padStart(2, '0')

  return (
    <div style={{
      background: '#fffbeb', border: '1.5px solid #fbbf24',
      borderRadius: 12, padding: '14px 16px', textAlign: 'center',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        ⏱ Tiempo en limpieza
      </p>
      <p style={{
        fontSize: 38, fontWeight: 800, color: '#b45309',
        fontVariantNumeric: 'tabular-nums', letterSpacing: 2, lineHeight: 1,
      }}>
        {fmt(h)}:{fmt(m)}:{fmt(s)}
      </p>
      <p style={{ fontSize: 12, color: '#92400e', marginTop: 6 }}>
        Inicio: {formatHora(horaEntrada)}
      </p>
    </div>
  )
}

// ── Calendario con puntitos ───────────────────────────────────────
const DIAS_CAL = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function getAsignacionesMes(personal_id, mes) {
  try {
    return new Set(
      JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
        .filter(a => a.personal_id === personal_id && a.activo !== false && a.fecha.startsWith(mes))
        .map(a => a.fecha)
    )
  } catch { return new Set() }
}

function CalendarioPuntitos({ personal_id }) {
  const [mes, setMes] = useState(mesActualStr)
  const hoyISO     = hoy()
  const fechasAsig = getAsignacionesMes(personal_id, mes)
  const total      = diasEnMes(mes)
  const offset     = offsetMes(mes)
  const celdas     = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  while (celdas.length % 7 !== 0) celdas.push(null)
  const cantAsig = fechasAsig.size

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={() => setMes(m => addMes(m, -1))}
          style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', textTransform: 'capitalize' }}>{formatMesLargo(mes)}</p>
          <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{cantAsig} limpieza{cantAsig !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setMes(m => addMes(m, 1))}
          style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DIAS_CAL.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {celdas.map((d, i) => {
          if (!d) return <div key={i} />
          const iso       = `${mes}-${String(d).padStart(2, '0')}`
          const tieneAsig = fechasAsig.has(iso)
          const esHoy     = iso === hoyISO
          const esPasado  = iso < hoyISO
          return (
            <div key={i} style={{
              padding: '5px 2px 4px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              borderRadius: 7,
              background: esHoy ? 'var(--primary-light)' : 'transparent',
              border: `2px solid ${esHoy ? 'var(--primary)' : 'transparent'}`,
              opacity: esPasado && !esHoy ? 0.45 : 1,
            }}>
              <span style={{ fontSize: 12, fontWeight: esHoy ? 700 : 400, color: esHoy ? 'var(--primary-dark)' : 'var(--text)' }}>{d}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tieneAsig ? '#ef4444' : 'transparent' }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Día con limpieza asignada</span>
      </div>
    </div>
  )
}

// ── Checkbox estilizado ───────────────────────────────────────────
function CheckItem({ checked, onChange, label, emoji }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
      border: `2px solid ${checked ? '#15803d' : 'var(--border)'}`,
      background: checked ? '#f0fdf4' : 'var(--bg)',
      transition: 'all 0.15s',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: `2px solid ${checked ? '#15803d' : 'var(--border)'}`,
        background: checked ? '#15803d' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {checked && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{ fontSize: 14, fontWeight: checked ? 700 : 500, color: checked ? '#15803d' : 'var(--text)' }}>
        {emoji} {label}
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
    </label>
  )
}

// ── Compartir por WhatsApp (texto) ───────────────────────────────
function compartirWhatsApp({ nombre, zona, turno, fecha, horaEntrada, horaSalida, notas }) {
  const esManana = turno === 'mañana'
  const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const lines = [
    '✅ Limpieza completada',
    `👤 ${nombre}`,
    `📍 ${zona} · ${esManana ? '☀️ Turno Mañana' : '🌙 Turno Noche'}`,
    `📅 ${fechaFmt}`,
    `⏱ ${formatHora(horaEntrada)} → ${formatHora(horaSalida)}`,
  ]
  if (notas) lines.push(`📝 ${notas}`)
  const texto = lines.join('\n')
  if (navigator.share) {
    navigator.share({ text: texto }).catch(() => {
      window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank')
    })
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank')
  }
}

// ── Pantallas ─────────────────────────────────────────────────────
export default function Registro() {
  const fechaHoy = hoy()

  const [personal, setPersonal]               = useState([])
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

  const [empleadoId, setEmpleadoId]       = useState(() => localStorage.getItem('cleansys_reg_emp') || null)
  const [busqueda, setBusqueda]           = useState('')
  const [confirmando, setConfirmando]     = useState(null)
  const [checksZona, setChecksZona]       = useState({})

  function buildNotas() {
    return Object.entries(checksZona)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(' · ')
  }

  function handleConfirmarSalida(asigId) {
    marcarSalida(asigId, buildNotas())
    setConfirmando(null)
    setChecksZona({})
  }

  const empleadoSeleccionado = personal.find(p => p.id === empleadoId)
  const tareasHoy = asignaciones.filter(a => a.personal_id === empleadoId)
  const personalFiltrado = personal.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  // ── PANTALLA 1: elegir nombre ──────────────────────────────────
  if (!empleadoId) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #1e3a8a 0%, #3b82f6 45%, #7c3aed 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '40px 16px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* Header */}
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, margin: '0 auto 16px',
            }}>👤</div>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              ¿Quién sos?
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Card de búsqueda */}
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1.5px solid rgba(255,255,255,0.22)',
            backdropFilter: 'blur(12px)',
            borderRadius: 20,
            padding: '24px 20px',
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 12, textAlign: 'center' }}>
              Escribí tu nombre para buscarte
            </p>
            <input
              placeholder="Buscar nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '13px 16px', marginBottom: 14,
                borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 15, fontFamily: 'Inter, sans-serif',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
              {loadingPersonal ? (
                <p style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Cargando personal...</p>
              ) : !busqueda.trim() ? (
                <p style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Escribí al menos una letra</p>
              ) : personalFiltrado.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Sin resultados</p>
              ) : (
                personalFiltrado.map(p => {
                  const tieneHoy = asignaciones.some(a => a.personal_id === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setEmpleadoId(p.id); localStorage.setItem('cleansys_reg_emp', p.id) }}
                      style={{
                        background: tieneHoy ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
                        border: `1.5px solid ${tieneHoy ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
                        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: tieneHoy ? '#fff' : 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: tieneHoy ? 'var(--primary)' : '#fff',
                        fontWeight: 800, fontSize: 16,
                      }}>
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{p.nombre}</p>
                        {p.sector && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{p.sector}</p>}
                      </div>
                      {tieneHoy && (
                        <span style={{
                          background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)',
                          borderRadius: 20, padding: '3px 10px',
                          fontSize: 11, fontWeight: 700, color: '#fff',
                        }}>
                          Tarea hoy
                        </span>
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
          <button className="header-back" onClick={() => { setEmpleadoId(null); localStorage.removeItem('cleansys_reg_emp') }}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">{empleadoSeleccionado?.nombre}</p>
            <p className="header-sub">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>


        {/* HOY */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Hoy
          </p>

          {tareasHoy.length === 0 ? (
            <div className="card text-center" style={{ padding: 32 }}>
              <p style={{ fontSize: 32, marginBottom: 10 }}>😴</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Sin tareas hoy</p>
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
                  <div
                    key={a.id}
                    className="card"
                    style={{ borderLeft: `4px solid ${esManana ? 'var(--manana-badge)' : 'var(--noche-badge)'}` }}
                  >
                    {/* Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 26 }}>{esManana ? '☀️' : '🌙'}</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>{a.zona?.nombre}</p>
                        <span className={`badge badge-${esManana ? 'manana' : 'noche'}`}>
                          Turno {esManana ? 'Mañana' : 'Noche'}
                        </span>
                      </div>
                    </div>

                    {/* Estado */}
                    {tieneSalida ? (
                      <div>
                        <div style={{ background: 'var(--success-light)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 18 }}>✅</span>
                            <strong style={{ color: 'var(--success)', fontSize: 14 }}>¡Limpieza completada!</strong>
                          </div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                            👤 {empleadoSeleccionado?.nombre}
                          </p>
                          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Inicio: {formatHora(reg.hora_entrada)} → Fin: {formatHora(reg.hora_salida)}
                          </p>
                          {reg.notas && (
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>📝 {reg.notas}</p>
                          )}
                        </div>
                        {/* Botón compartir */}
                        <button
                          onClick={() => {
                            compartirWhatsApp({
                              nombre: empleadoSeleccionado?.nombre,
                              zona: a.zona?.nombre,
                              turno: a.turno,
                              fecha: fechaHoy,
                              horaEntrada: reg.hora_entrada,
                              horaSalida: reg.hora_salida,
                              notas: reg.notas,
                            })
                            setTimeout(() => {
                              setEmpleadoId(null)
                              localStorage.removeItem('cleansys_reg_emp')
                            }, 800)
                          }}
                          style={{
                            width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                            background: 'linear-gradient(135deg, #25d366, #128c7e)',
                            border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 18 }}>📲</span> Compartir en WhatsApp
                        </button>
                      </div>

                    ) : tieneEntrada ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Cronometro horaEntrada={reg.hora_entrada} />

                        {confirmando === a.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(() => {
                              const tareas = getTareasZona(a.zona_id)
                              if (tareas.length === 0) return null
                              return (
                                <>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>¿Qué hiciste?</p>
                                  {tareas.map((tarea, i) => (
                                    <CheckItem
                                      key={i}
                                      checked={!!checksZona[tarea]}
                                      onChange={v => setChecksZona(prev => ({ ...prev, [tarea]: v }))}
                                      label={tarea}
                                      emoji="✅"
                                    />
                                  ))}
                                </>
                              )
                            })()}

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-success"
                                style={{ flex: 1 }}
                                onClick={() => handleConfirmarSalida(a.id)}
                              >
                                ✓ Confirmar salida
                              </button>
                              <button className="btn btn-ghost" onClick={() => { setConfirmando(null); setChecksZona({}) }}>
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

        {tareasHoy.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => { setEmpleadoId(null); localStorage.removeItem('cleansys_reg_emp') }}>← Volver</button>
          </div>
        )}

      </div>
    </div>
  )
}
