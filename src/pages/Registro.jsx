import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'
import { useAsignaciones } from '../hooks/useAsignaciones'
import { useRegistros } from '../hooks/useRegistros'
import { pullRegistros } from '../hooks/useRegistros'
import { useInstallPWA } from '../hooks/useInstallPWA'
import { usePersonal, normalizarNombre } from '../hooks/usePersonal'
import Avatar from '../components/Avatar'

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

// ── Cronómetro (anillo: una vuelta por hora) ─────────────────────
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
  const R = 84
  const largo = 2 * Math.PI * R
  const avance = (seg % 3600) / 3600

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: 200, height: 200 }}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="anillo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5AA0F7" />
              <stop offset="100%" stopColor="#1F6FEB" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--primary-light)" strokeWidth="12" />
          <circle cx="100" cy="100" r={R} fill="none" stroke="url(#anillo)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={largo} strokeDashoffset={largo * (1 - Math.max(avance, 0.01))}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 34, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', lineHeight: 1 }}>
            {fmt(h)}:{fmt(m)}:{fmt(s)}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Tiempo transcurrido</p>
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'stretch',
        background: 'var(--primary-xlight)', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 14px',
      }}>
        <span style={{ fontSize: 22 }}>🕙</span>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Inicio</p>
          <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{formatHora(horaEntrada)}</p>
        </div>
      </div>
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
function CheckItem({ checked, onChange, label }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px', borderRadius: 14, cursor: 'pointer',
      border: '1px solid var(--border)',
      background: checked ? 'var(--primary-xlight)' : 'var(--bg-card)',
      transition: 'background 0.15s',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 7, flexShrink: 0,
        border: `2px solid ${checked ? 'var(--primary)' : '#C9D5E6'}`,
        background: checked ? 'var(--primary)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {checked && <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>✓</span>}
      </div>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
      {checked && (
        <span style={{
          width: 24, height: 24, borderRadius: '50%', background: 'var(--success)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
        }}>✓</span>
      )}
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
    </label>
  )
}

// ── Compartir por WhatsApp (texto) ───────────────────────────────
function duracionFmt(entrada, salida) {
  if (!entrada || !salida) return null
  const seg = Math.floor((new Date(salida) - new Date(entrada)) / 1000)
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const p = n => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

function compartirWhatsApp({ nombre, zona, turno, fecha, horaEntrada, horaSalida, notas }) {
  const esManana = turno === 'mañana'
  const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dur = duracionFmt(horaEntrada, horaSalida)
  const lines = [
    '✅ Limpieza completada',
    `👤 ${nombre}`,
    `📍 ${zona} · ${esManana ? '☀️ Turno Mañana' : '🌙 Turno Noche'}`,
    `📅 ${fechaFmt}`,
    `⏰ Inicio: *${formatHora(horaEntrada)}*`,
    `🏁 Fin: *${formatHora(horaSalida)}*`,
  ]
  if (dur) lines.push(`⏱️ Duración: *${dur}*`)
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

// ── Horario habilitado por turno ──────────────────────────────────
function esHoraTurno(turno) {
  const h = new Date().getHours()
  if (turno === 'mañana') return h >= 8
  if (turno === 'noche')  return h >= 18
  return true
}
function horaDisponible(turno) {
  if (turno === 'mañana') return '8:00 AM'
  if (turno === 'noche')  return '6:00 PM'
  return null
}

// ── Pantallas ─────────────────────────────────────────────────────
export default function Registro() {
  const fechaHoy = hoy()
  const { puedeInstalar, instalar } = useInstallPWA()

  const { personal, loading: loadingPersonal, error: errorPersonal } = usePersonal()

  const { asignaciones, loading: syncingAsigs, sincronizar } = useAsignaciones(fechaHoy)
  const { marcarEntrada, marcarSalida, getRegistroPorAsignacion, getAllRegistrosPorAsignacion, regError, refetch: refetchReg } = useRegistros(fechaHoy)

  // Recargar automáticamente a medianoche para mostrar datos del nuevo día
  useEffect(() => {
    const ahora = new Date()
    const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 5)
    const timer = setTimeout(() => window.location.reload(), manana - ahora)
    return () => clearTimeout(timer)
  }, [])

  // Auto-refresh cada 15s para mantener datos sincronizados entre dispositivos
  useEffect(() => {
    const id = setInterval(() => {
      sincronizar()
      pullRegistros().then(ok => { if (ok) refetchReg() })
    }, 15000)
    return () => clearInterval(id)
  }, [sincronizar, refetchReg])

  // Refrescar cuando el usuario vuelve a la app
  useEffect(() => {
    function handleVisibilidad() {
      if (!document.hidden) {
        sincronizar()
        pullRegistros().then(ok => { if (ok) refetchReg() })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilidad)
    return () => document.removeEventListener('visibilitychange', handleVisibilidad)
  }, [sincronizar, refetchReg])

  // Supabase Realtime — sincronización instantánea entre dispositivos
  useEffect(() => {
    const channel = supabase
      .channel('registro-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'limpieza_asignaciones' },
        () => { sincronizar() }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'limpieza_registros' },
        () => { pullRegistros().then(ok => { if (ok) refetchReg() }) }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sincronizar, refetchReg])

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
    normalizarNombre(p.nombre).includes(normalizarNombre(busqueda))
  )
  const todasCompletas = !syncingAsigs && tareasHoy.length > 0 && tareasHoy.every(a => !!getRegistroPorAsignacion(a.id)?.hora_salida)

  // Re-render cada minuto para actualizar el estado de los botones de turno
  const [, setTickMinuto] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTickMinuto(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // ── PANTALLA 1: elegir nombre ──────────────────────────────────
  if (!empleadoId) {
    const fechaCorta = new Date().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
    return (
      <div className="page" style={{ paddingTop: 20 }}>
        <div className="container">

          {/* Barra superior */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="icon-btn" style={{ fontSize: 20 }}>🧼</span>
              <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>CleaSys</span>
            </div>
            <span className="chip chip-azul" style={{ textTransform: 'capitalize' }}>📅 {fechaCorta}</span>
          </div>

          {/* Saludo */}
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            Hola <span style={{ color: 'var(--primary)', fontSize: 26, verticalAlign: 'top' }}>✦</span>
          </h1>
          <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3, marginTop: 8, marginBottom: 22 }}>
            ¿Quién sos? Buscá tu nombre<br />para ver tu limpieza de hoy
          </p>

          {/* Buscador */}
          <label className="buscador">
            <span style={{ fontSize: 18, color: 'var(--primary)' }}>🔍</span>
            <input
              placeholder="Buscar mi nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              autoFocus
            />
          </label>
          {errorPersonal && (
            <p className="chip chip-naranja" style={{ marginTop: 10, whiteSpace: 'normal' }}>
              {personal.length > 0
                ? '⚠️ Sin conexión — mostrando la última lista guardada'
                : '⚠️ Sin conexión — reintentando cargar el personal…'}
            </p>
          )}

          <div className="seccion">
            <p className="seccion-titulo">Personal</p>
            {busqueda.trim() && !loadingPersonal && (
              <span className="seccion-accion">{personalFiltrado.length} encontrado{personalFiltrado.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {loadingPersonal ? (
            <div className="lista">
              {[1, 2, 3].map(i => (
                <div key={i} className="fila" style={{ cursor: 'default' }}>
                  <span className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: '35%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : !busqueda.trim() ? (
            <div className="card text-center" style={{ padding: '28px 20px' }}>
              <p style={{ fontSize: 34, marginBottom: 8 }}>🧽</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Escribí al menos una letra</p>
              <p className="text-muted">Tu nombre aparece acá abajo para elegirlo</p>
            </div>
          ) : personalFiltrado.length === 0 ? (
            <div className="card text-center" style={{ padding: '28px 20px' }}>
              <p style={{ fontSize: 34, marginBottom: 8 }}>🔎</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Sin resultados</p>
            </div>
          ) : (
            <div className="lista" style={{ maxHeight: 440, overflowY: 'auto' }}>
              {personalFiltrado.map(p => {
                const tareasDelDia = asignaciones.filter(a => a.personal_id === p.id)
                const tieneHoy    = tareasDelDia.length > 0
                const yaTermino   = tieneHoy && tareasDelDia.every(a => !!getRegistroPorAsignacion(a.id)?.hora_salida)
                const enProceso   = tareasDelDia.some(a => {
                  const r = getRegistroPorAsignacion(a.id)
                  return r?.hora_entrada && !r?.hora_salida
                })
                const turnoHoy    = tieneHoy ? tareasDelDia[0].turno : null
                const puedeEntrar = tieneHoy && esHoraTurno(turnoHoy)
                return (
                  <button
                    key={p.id}
                    className="fila"
                    onClick={() => { setEmpleadoId(p.id); localStorage.setItem('cleansys_reg_emp', p.id) }}
                  >
                    <Avatar nombre={p.nombre}>{yaTermino ? '✓' : undefined}</Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="fila-nombre">{p.nombre}</p>
                      {p.sector && <p className="fila-sub" style={{ textTransform: 'capitalize' }}>{p.sector}</p>}
                    </div>
                    {yaTermino ? (
                      <span className="chip chip-verde">Completado</span>
                    ) : enProceso ? (
                      <span className="chip chip-azul">En proceso</span>
                    ) : tieneHoy ? (
                      puedeEntrar
                        ? <span className="chip chip-azul">Limpia hoy</span>
                        : <span className="chip chip-naranja">🔒 {horaDisponible(turnoHoy)}</span>
                    ) : null}
                    <span className="fila-flecha">›</span>
                  </button>
                )
              })}
            </div>
          )}

          {puedeInstalar && (
            <button className="btn btn-ghost btn-block" style={{ marginTop: 16, padding: '13px 0' }} onClick={instalar}>
              <span style={{ fontSize: 18 }}>📲</span> Instalar app
            </button>
          )}

        </div>
      </div>
    )
  }

  // ── PANTALLA 2: mis tareas ─────────────────────────────────────
  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header" style={{ marginBottom: 18 }}>
          <button className="header-back" onClick={() => { setEmpleadoId(null); localStorage.removeItem('cleansys_reg_emp') }}>‹</button>
          <div style={{ flex: 1, textAlign: 'center', marginRight: 42 }}>
            <p className="header-title" style={{ fontSize: 18 }}>Mi limpieza</p>
            <p className="header-sub" style={{ textTransform: 'capitalize' }}>
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* Perfil */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <Avatar nombre={empleadoSeleccionado?.nombre || ''} size={62} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{empleadoSeleccionado?.nombre}</p>
            {empleadoSeleccionado?.sector && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>{empleadoSeleccionado.sector}</p>
            )}
            <div style={{ marginTop: 8 }}>
              {tareasHoy.length === 0 ? <span className="chip chip-gris">Sin limpieza hoy</span>
                : todasCompletas ? <span className="chip chip-verde">Completado</span>
                : tareasHoy.some(a => getRegistroPorAsignacion(a.id)?.hora_entrada && !getRegistroPorAsignacion(a.id)?.hora_salida)
                  ? <span className="chip chip-azul">En proceso</span>
                  : <span className="chip chip-naranja">Pendiente</span>}
            </div>
          </div>
        </div>


        {regError && (
          <div style={{
            background: '#fee2e2', color: '#dc2626', borderRadius: 10,
            padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16,
          }}>
            ⚠ {regError}
          </div>
        )}

        {/* HOY */}
        <div style={{ marginBottom: 24 }}>
          <div className="seccion" style={{ marginTop: 0 }}>
            <p className="seccion-titulo">Hoy</p>
            {tareasHoy.length > 0 && (
              <span className="seccion-accion" style={{ color: 'var(--text-muted)' }}>
                {tareasHoy.filter(a => getRegistroPorAsignacion(a.id)?.hora_salida).length} de {tareasHoy.length}
              </span>
            )}
          </div>

          {syncingAsigs ? (
            <div className="card text-center" style={{ padding: 32 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-muted)' }}>Cargando tareas...</p>
            </div>
          ) : todasCompletas ? (
            <div style={{
              background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
              border: '2px solid #6ee7b7',
              borderRadius: 20,
              padding: '32px 24px',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#065f46', marginBottom: 6 }}>
                ¡Excelente, {empleadoSeleccionado?.nombre}!
              </p>
              <p style={{ fontSize: 15, color: '#047857', fontWeight: 600, marginBottom: 4 }}>
                Ya completaste toda tu limpieza de hoy
              </p>
              <p style={{ fontSize: 13, color: '#059669', marginBottom: 20 }}>
                Podés descansar, el trabajo está hecho ✨
              </p>
              {/* Resumen de tareas con última sesión */}
              <div style={{
                background: '#fff', borderRadius: 12, padding: '14px 16px',
                border: '1px solid #a7f3d0', marginBottom: 16,
              }}>
                {tareasHoy.map(a => {
                  const reg = getRegistroPorAsignacion(a.id)
                  const dur = duracionFmt(reg?.hora_entrada, reg?.hora_salida)
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #ecfdf5' }}>
                      <span style={{ fontSize: 18 }}>{a.turno === 'mañana' ? '☀️' : '🌙'}</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: '#065f46' }}>{a.zona?.nombre || '—'}</p>
                        <p style={{ fontSize: 12, color: '#059669' }}>
                          ⏰ {formatHora(reg?.hora_entrada)} → {formatHora(reg?.hora_salida)}
                        </p>
                        {dur && <p style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>⏱️ Duración: {dur}</p>}
                      </div>
                      <span style={{ fontSize: 18 }}>✅</span>
                    </div>
                  )
                })}
              </div>
              {/* Compartir + Iniciar de nuevo + Salir */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => {
                    const lastA   = tareasHoy[tareasHoy.length - 1]
                    const lastReg = getRegistroPorAsignacion(lastA?.id)
                    compartirWhatsApp({
                      nombre:      empleadoSeleccionado?.nombre,
                      zona:        lastA?.zona?.nombre,
                      turno:       lastA?.turno,
                      fecha:       fechaHoy,
                      horaEntrada: lastReg?.hora_entrada,
                      horaSalida:  lastReg?.hora_salida,
                      notas:       lastReg?.notas,
                    })
                    setTimeout(() => {
                      setEmpleadoId(null)
                      localStorage.removeItem('cleansys_reg_emp')
                    }, 800)
                  }}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, #25d366, #128c7e)',
                    color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 18 }}>📲</span> Compartir en WhatsApp
                </button>
                {tareasHoy.map(a => esHoraTurno(a.turno) ? (
                  <button
                    key={a.id}
                    onClick={() => marcarEntrada(a.id)}
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: 12,
                      background: '#fff', border: '2px solid #6ee7b7',
                      color: '#065f46', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    🔄 {tareasHoy.length > 1 ? `Iniciar ${a.zona?.nombre || 'limpieza'}` : 'Iniciar de nuevo'}
                  </button>
                ) : null)}
                <button
                  onClick={() => { setEmpleadoId(null); localStorage.removeItem('cleansys_reg_emp') }}
                  style={{
                    width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                  }}
                >
                  👋 Listo, salir
                </button>
              </div>
            </div>
          ) : null}
          {tareasHoy.length === 0 ? (
            <div className="card text-center" style={{ padding: 32 }}>
              <p style={{ fontSize: 32, marginBottom: 10 }}>😴</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Sin tareas hoy</p>
              <p className="text-muted" style={{ marginBottom: 16 }}>No tenés limpieza asignada para hoy</p>
              <button
                onClick={sincronizar}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13,
                }}
              >
                🔄 Actualizar
              </button>
            </div>
          ) : todasCompletas ? null : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tareasHoy.map(a => {
                const reg          = getRegistroPorAsignacion(a.id)
                const tieneEntrada = !!reg?.hora_entrada
                const tieneSalida  = !!reg?.hora_salida
                const esManana     = a.turno === 'mañana'

                return (
                  <div key={a.id} className="card" style={{ padding: 20 }}>
                    {/* Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                      <span style={{
                        width: 48, height: 48, borderRadius: 14, flexShrink: 0, fontSize: 24,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: esManana ? 'var(--manana-bg)' : 'var(--noche-bg)',
                      }}>{esManana ? '☀️' : '🌙'}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{a.zona?.nombre}</p>
                        <span className={`badge badge-${esManana ? 'manana' : 'noche'}`} style={{ marginTop: 4 }}>
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
                            ⏰ {formatHora(reg.hora_entrada)} → {formatHora(reg.hora_salida)}
                          </p>
                          {duracionFmt(reg.hora_entrada, reg.hora_salida) && (
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                              ⏱️ Duración: {duracionFmt(reg.hora_entrada, reg.hora_salida)}
                            </p>
                          )}
                          {reg.notas && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>📝 {reg.notas}</p>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                          {esHoraTurno(a.turno) && (
                            <button className="btn btn-outline btn-block" onClick={() => marcarEntrada(a.id)}>
                              🔄 Iniciar de nuevo
                            </button>
                          )}
                        </div>
                      </div>

                    ) : tieneEntrada ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Cronometro horaEntrada={reg.hora_entrada} />

                        {confirmando === a.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(() => {
                              const tareas = a.zona?.tareas || []
                              if (tareas.length === 0) return null
                              return (
                                <>
                                  <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>Lista de tareas</p>
                                  {tareas.map((tarea, i) => (
                                    <CheckItem
                                      key={i}
                                      checked={!!checksZona[tarea]}
                                      onChange={v => setChecksZona(prev => ({ ...prev, [tarea]: v }))}
                                      label={tarea}
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
                            ✓ Finalizar limpieza
                          </button>
                        )}
                      </div>

                    ) : esHoraTurno(a.turno) ? (
                      <button className="btn btn-primary btn-block btn-lg" onClick={() => marcarEntrada(a.id)}>
                        ▶ Iniciar limpieza
                      </button>
                    ) : (
                      <div style={{
                        textAlign: 'center', padding: '22px 16px',
                        background: 'var(--warning-light)', borderRadius: 14,
                      }}>
                        <p style={{ fontSize: 30, marginBottom: 8 }}>⏰</p>
                        <p style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 4 }}>
                          Todavía no es la hora
                        </p>
                        <p style={{ fontSize: 13, color: '#b45309' }}>
                          El botón de entrada estará disponible desde las{' '}
                          <strong>{horaDisponible(a.turno)}</strong>
                        </p>
                      </div>
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
