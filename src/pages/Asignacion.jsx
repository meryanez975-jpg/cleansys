import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePersonal } from '../hooks/usePersonal'
import { usePersonalComidas } from '../hooks/usePersonalComidas'
import { useZonas } from '../hooks/useZonas'
import { useAsignaciones } from '../hooks/useAsignaciones'
import { useRegistros } from '../hooks/useRegistros'
import ZonaModal from '../components/ZonaModal'
import PersonalModal from '../components/PersonalModal'
import MenuDrawer from '../components/MenuDrawer'
import * as store from '../data/store'
import { useGuardiaNavegacion } from '../hooks/useGuardiaNavegacion'
import ModalConfirmSalida from '../components/ModalConfirmSalida'

const CABECERA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const DIAS_SEMANA = [
  { label: 'Lun', jsDay: 1 },
  { label: 'Mar', jsDay: 2 },
  { label: 'Mié', jsDay: 3 },
  { label: 'Jue', jsDay: 4 },
  { label: 'Vie', jsDay: 5 },
  { label: 'Sáb', jsDay: 6 },
  { label: 'Dom', jsDay: 0 },
]

function hoy() {
  return new Date().toISOString().split('T')[0]
}
function mesActualStr() { return hoy().slice(0, 7) }

function diasEnMes(mes) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function formatMesLargo(mes) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}
function addMes(mes, delta) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function offsetMes(mes) {
  const [y, m] = mes.split('-').map(Number)
  const dow = new Date(y, m - 1, 1).getDay()
  return dow === 0 ? 6 : dow - 1
}
function isoDelDia(mes, d) {
  return `${mes}-${String(d).padStart(2, '0')}`
}
function fechasEnRango(mes, inicio, fin) {
  const desde = Math.min(inicio, fin)
  const hasta = Math.max(inicio, fin)
  const fechas = []
  for (let d = desde; d <= hasta; d++) fechas.push(isoDelDia(mes, d))
  return fechas
}
function formatFechaCorta(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}
function formatHora(isoStr) {
  if (!isoStr) return null
  return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

// ── Calendario con rango ──────────────────────────────────────────
function CalendarioMes({ mes, inicio, fin, onClick }) {
  const total   = diasEnMes(mes)
  const offset  = offsetMes(mes)
  const hoyISO  = hoy()

  // días con al menos una asignación
  const conAsig = (() => {
    try {
      const all = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
      return new Set(all.filter(a => a.fecha.startsWith(mes)).map(a => a.fecha))
    } catch { return new Set() }
  })()

  const desde = inicio && fin ? Math.min(inicio, fin) : inicio
  const hasta  = inicio && fin ? Math.max(inicio, fin) : inicio

  const celdas = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  while (celdas.length % 7 !== 0) celdas.push(null)
  const semanas = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
        {CABECERA.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>
        ))}
      </div>

      {semanas.map((semana, si) => (
        <div key={si} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: 2 }}>
          {semana.map((d, ci) => {
            if (!d) return <div key={ci} />
            const iso       = isoDelDia(mes, d)
            const esInicio  = d === desde && inicio !== null
            const esFin     = d === hasta && fin !== null
            const enRango   = inicio !== null && fin !== null && d > desde && d < hasta
            const esHoy     = iso === hoyISO
            const tieneA    = conAsig.has(iso)
            const soloPend  = inicio !== null && fin === null && d === inicio // esperando 2do clic

            let bg = 'transparent'
            let borderColor = 'transparent'
            let textColor = 'var(--text)'

            if (esInicio || esFin) {
              bg = 'var(--primary)'
              textColor = '#fff'
            } else if (enRango) {
              bg = 'var(--primary-light)'
              textColor = 'var(--primary-dark)'
            } else if (soloPend) {
              borderColor = 'var(--primary)'
            } else if (esHoy) {
              borderColor = 'var(--primary)'
              textColor = 'var(--primary-dark)'
            }

            return (
              <button
                key={d}
                onClick={() => onClick(d)}
                style={{
                  border: `2px solid ${borderColor}`,
                  borderRadius: esInicio ? '8px 0 0 8px' : esFin ? '0 8px 8px 0' : enRango ? 0 : 8,
                  background: bg,
                  cursor: 'pointer',
                  padding: '5px 2px 7px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: (esInicio || esFin) ? 700 : 400, color: textColor }}>
                  {d}
                </span>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: tieneA
                    ? ((esInicio || esFin) ? 'rgba(255,255,255,0.8)' : enRango ? 'var(--primary)' : 'var(--primary)')
                    : 'transparent',
                  display: 'block',
                }} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function Asignacion() {
  const navigate = useNavigate()
  const { supervisor } = useAuth()

  const [mes, setMes]         = useState(mesActualStr)
  const [inicio, setInicio]   = useState(null)   // día 1..31 o null
  const [fin, setFin]         = useState(null)

  const [turno, setTurno]         = useState('mañana')
  const [showCal, setShowCal]     = useState(false)
  const [showMenu, setShowMenu]   = useState(false)
  const [showZonas, setShowZonas]     = useState(false)
  const [showPersonal, setShowPersonal] = useState(false)
  const [showForm, setShowForm]         = useState(true)
  const [selPersonal, setSelPersonal]   = useState('')
  const [selZona, setSelZona]           = useState('')
  const [selTurnoForm, setSelTurnoForm] = useState('mañana')
  const [selDiaSemana, setSelDiaSemana] = useState(null) // null = todos, 0-6 = jsDay
  const [errForm, setErrForm]           = useState('')
  const [guardando, setGuardando]       = useState(false)
  const [guardadoOk, setGuardadoOk]     = useState(false)
  const [hayCambios, setHayCambios]     = useState(false)
  const [refetchKey, setRefetchKey]     = useState(0)

  const { navegarConGuardia, showConfirm, confirmar, cancelar } = useGuardiaNavegacion(hayCambios)

  // fecha activa = fin si hay rango, sino inicio, sino hoy
  const diaActivo = fin ?? inicio ?? parseInt(hoy().slice(8, 10))
  const fecha     = isoDelDia(mes, diaActivo)

  const { personal, agregar: agregarPersonal, editar: editarPersonal, eliminar: eliminarPersonal, refetch: refetchPersonal } = usePersonal()
  const { personal: personalTurno, loading: loadingPersonal } = usePersonalComidas(selTurnoForm)
  const { zonas, crearZona, editarZona, desactivarZona } = useZonas()
  const { asignaciones, eliminarAsignacion, refetch: refetchAsig } = useAsignaciones(fecha)
  const { getRegistroPorAsignacion, refetch: refetchReg } = useRegistros(fecha)

  // asignaciones del rango completo para el turno seleccionado
  const fechasRango = inicio && fin
    ? fechasEnRango(mes, inicio, fin)
    : [fecha]
  const asignacionesRango = store.getAsignacionesPorFechas(fechasRango)
    .filter(a => a.turno === turno)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // refetchKey fuerza re-lectura
    // eslint-disable-next-line no-unused-expressions
    || (refetchKey, [])

  // Para el form: personas ya asignadas en TODOS los días del rango en este turno
  const yaAsignadosIds = [...new Set(asignacionesRango.map(a => a.personal?.id).filter(Boolean))]

  function forceRefetch() {
    setRefetchKey(k => k + 1)
    refetchAsig()
    refetchReg()
  }

  function marcarCambio() {
    setHayCambios(true)
    setGuardadoOk(false)
  }

  // Lógica de clic en día del calendario
  function handleDiaClick(d) {
    if (inicio === null) {
      // primer clic: inicio
      setInicio(d)
      setFin(null)
    } else if (fin === null) {
      if (d === inicio) {
        setInicio(null)
      } else {
        setFin(d)
        setShowCal(false) // cierra el calendario al completar el rango
      }
    } else {
      // rango ya completo → reiniciar
      setInicio(d)
      setFin(null)
    }
    forceRefetch()
  }

  function handleMesChange(nuevoMes) {
    setMes(nuevoMes)
    setInicio(null)
    setFin(null)
    forceRefetch()
  }

  // Fechas del rango filtradas por día de semana elegido
  const fechasParaAsignar = selDiaSemana === null
    ? fechasRango
    : fechasRango.filter(f => new Date(f + 'T12:00:00').getDay() === selDiaSemana)

  function handleCrearAsignacion() {
    if (!selPersonal || !selZona) { setErrForm('Seleccioná persona y zona'); return }
    if (selDiaSemana !== null && fechasParaAsignar.length === 0) {
      setErrForm('El día elegido no existe en el rango seleccionado')
      return
    }
    setGuardando(true)
    let errores = 0
    for (const f of fechasParaAsignar) {
      const { error } = store.addAsignacion(selPersonal, selZona, selTurnoForm, f)
      if (error) errores++
    }
    forceRefetch()
    if (errores === fechasRango.length) {
      setErrForm('La persona ya está asignada en todos los días del rango')
    } else {
      setHayCambios(false)
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 3000)
      setShowForm(false)
      setSelPersonal('')
      setSelZona('')
      setSelDiaSemana(null)
      setSelTurnoForm('mañana')
    }
    setGuardando(false)
  }

  function handleGuardar() {
    setGuardadoOk(true)
    setHayCambios(false)
    setTimeout(() => setGuardadoOk(false), 3000)
  }

  function handleEliminar(id) {
    if (!window.confirm('¿Eliminar esta asignación?')) return
    eliminarAsignacion(id)
    forceRefetch()
    marcarCambio()
  }

  // texto descriptivo del rango/día seleccionado
  const textoRango = (() => {
    if (inicio === null) return 'Tocá un día para seleccionar'
    if (fin === null) return `Desde el ${formatFechaCorta(isoDelDia(mes, inicio))} — tocá otro día para definir el hasta`
    const desde = Math.min(inicio, fin)
    const hasta  = Math.max(inicio, fin)
    return `${formatFechaCorta(isoDelDia(mes, desde))} → ${formatFechaCorta(isoDelDia(mes, hasta))} (${fechasRango.length} día${fechasRango.length > 1 ? 's' : ''})`
  })()

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button
            onClick={() => setShowMenu(true)}
            style={{
              background: 'var(--primary-light)', border: 'none',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ display: 'block', width: 18, height: 2, background: 'var(--primary-dark)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: 'var(--primary-dark)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: 'var(--primary-dark)', borderRadius: 2 }} />
          </button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Asignación de Limpieza</p>
          </div>
        </div>

        {/* Calendario */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', marginBottom: 16, boxShadow: 'var(--shadow)',
          overflow: 'hidden',
        }}>
          {/* Botón para mostrar/ocultar */}
          <button
            onClick={() => setShowCal(v => !v)}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--primary-dark)' }}>
              📅{' '}
              {inicio === null
                ? 'Seleccionar días'
                : textoRango}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{showCal ? '▲' : '▼'}</span>
          </button>

          {/* Contenido colapsable */}
          {showCal && (
          <div style={{ padding: '0 14px 12px' }}>
          {/* Nav mes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              onClick={() => handleMesChange(addMes(mes, -1))}
              style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}
            >‹</button>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', textTransform: 'capitalize' }}>
              {formatMesLargo(mes)}
            </span>
            <button
              onClick={() => handleMesChange(addMes(mes, 1))}
              style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}
            >›</button>
          </div>

          <CalendarioMes mes={mes} inicio={inicio} fin={fin} onClick={handleDiaClick} />

          {/* Indicador de rango */}
          <div style={{
            marginTop: 10, padding: '7px 12px',
            background: inicio ? 'var(--primary-light)' : 'var(--bg)',
            borderRadius: 8, fontSize: 12,
            color: inicio ? 'var(--primary-dark)' : 'var(--text-muted)',
            textAlign: 'center', fontWeight: inicio ? 600 : 400,
          }}>
            {textoRango}
          </div>

          {/* Botón limpiar rango */}
          {inicio !== null && (
            <button
              onClick={() => { setInicio(null); setFin(null); forceRefetch() }}
              style={{ marginTop: 8, width: '100%', background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Limpiar selección
            </button>
          )}
          </div>
          )}
        </div>

        {/* Botones de acción */}
        <div style={{ marginBottom: 6 }}>
          {inicio === null && (
            <p style={{
              textAlign: 'center', fontSize: 12, color: 'var(--text-muted)',
              marginTop: 8, marginBottom: 8,
            }}>
              ☝️ Abrí el calendario y tocá un día o seleccioná un rango de fechas para empezar
            </p>
          )}
        </div>

        {/* Aviso sin personal */}
        {personal.length === 0 && (
          <div style={{
            background: 'var(--warning-light)', border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚠️</span>
            <span>No hay personal cargado. Presioná 👥 para agregar personas.</span>
          </div>
        )}

        {/* Formulario nueva asignación */}
        {showForm && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Nueva asignación</p>
            <p style={{ fontSize: 12, color: 'var(--primary-dark)', marginBottom: 16 }}>
              📅 {textoRango}
            </p>

            {/* Turno */}
            <div className="input-group">
              <label className="input-label">Turno</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['mañana', 'noche'].map(t => (
                  <button
                    key={t}
                    onClick={() => { setSelTurnoForm(t); setSelPersonal('') }}
                    style={{
                      flex: 1, padding: '10px', border: '2px solid',
                      borderColor: selTurnoForm === t ? (t === 'mañana' ? 'var(--manana-badge)' : 'var(--noche-badge)') : 'var(--border)',
                      borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      background: selTurnoForm === t ? (t === 'mañana' ? 'var(--manana-bg)' : 'var(--noche-bg)') : 'var(--bg)',
                      color: selTurnoForm === t ? (t === 'mañana' ? 'var(--manana-badge)' : 'var(--noche-badge)') : 'var(--text-muted)',
                    }}
                  >
                    {t === 'mañana' ? '☀️ Mañana' : '🌙 Noche'}
                  </button>
                ))}
              </div>
            </div>

            {/* Día de la semana */}
            <div className="input-group">
              <label className="input-label">¿Qué día de la semana limpia?</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {DIAS_SEMANA.map(({ label, jsDay }) => {
                  const sel = selDiaSemana === jsDay
                  // contar cuántas fechas del rango caen en este día
                  const count = fechasRango.filter(f => new Date(f + 'T12:00:00').getDay() === jsDay).length
                  return (
                    <button
                      key={jsDay}
                      onClick={() => { setSelDiaSemana(sel ? null : jsDay); setErrForm('') }}
                      style={{
                        padding: '8px 2px',
                        border: '2px solid',
                        borderColor: sel ? 'var(--primary)' : 'var(--border)',
                        borderRadius: 8, cursor: 'pointer',
                        background: sel ? 'var(--primary)' : count > 0 ? 'var(--primary-xlight)' : 'var(--bg)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: sel ? '#fff' : 'var(--text)' }}>{label}</span>
                      {count > 0 && (
                        <span style={{ fontSize: 10, color: sel ? 'rgba(255,255,255,0.8)' : 'var(--primary)', fontWeight: 600 }}>
                          ×{count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {selDiaSemana === null
                  ? `Todos los días del período (${fechasRango.length} días)`
                  : fechasParaAsignar.length === 0
                    ? 'Ese día no existe en el rango seleccionado'
                    : `Se asignarán ${fechasParaAsignar.length} ${DIAS_SEMANA.find(d => d.jsDay === selDiaSemana)?.label}: ${fechasParaAsignar.slice(0, 4).map(f => new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })).join(', ')}${fechasParaAsignar.length > 4 ? '…' : ''}`
                }
              </p>
            </div>

            {/* Persona */}
            <div className="input-group">
              <label className="input-label">Persona</label>
              {loadingPersonal ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Cargando personal...</p>
              ) : personalTurno.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--warning)', padding: '8px 0' }}>
                  ⚠️ No hay personal con turno {selTurnoForm === 'mañana' ? 'diurno' : 'nocturno'} en el sistema
                </p>
              ) : (
                <select className="input" value={selPersonal} onChange={e => { setSelPersonal(e.target.value); setErrForm('') }}>
                  <option value="">— Seleccionar —</option>
                  {personalTurno.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}{p.sector ? ` (${p.sector})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Zona */}
            <div className="input-group">
              <label className="input-label">Zona de limpieza</label>
              <select className="input" value={selZona} onChange={e => { setSelZona(e.target.value); setErrForm('') }}>
                <option value="">— Seleccionar zona —</option>
                {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </div>

            {errForm && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{errForm}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCrearAsignacion} disabled={guardando}>
                {guardando ? 'Guardando...' : `Guardar (${fechasParaAsignar.length} día${fechasParaAsignar.length !== 1 ? 's' : ''})`}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setErrForm('') }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Lista de asignaciones */}
        {inicio !== null && asignacionesRango.length === 0 ? (
          <div className="card text-center" style={{ padding: 36 }}>
            <p style={{ fontSize: 32, marginBottom: 10 }}>📋</p>
            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Sin asignaciones</p>
            <p className="text-muted">Presioná "+ Asignar persona" para comenzar</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {asignacionesRango.map(a => {
              const reg    = getRegistroPorAsignacion(a.id)
              const entrada = formatHora(reg?.hora_entrada)
              const salida  = formatHora(reg?.hora_salida)

              return (
                <div key={a.id} className="card" style={{
                  borderLeft: `4px solid ${turno === 'mañana' ? 'var(--manana-badge)' : 'var(--noche-badge)'}`,
                  padding: '14px 16px',
                }}>
                  <div className="flex-between">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                          {a.personal?.nombre || 'Sin nombre'}
                        </span>
                        {reg?.completado ? (
                          <span className="badge badge-ok">✓ Completado</span>
                        ) : entrada ? (
                          <span className="badge badge-pendiente">En proceso</span>
                        ) : null}
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        🏢 {a.zona?.nombre || '—'}
                        {a.personal?.sector && ` · ${a.personal.sector}`}
                      </p>
                      {fechasRango.length > 1 && (
                        <p style={{ fontSize: 12, color: 'var(--primary-dark)', marginTop: 2 }}>
                          📅 {formatFechaCorta(a.fecha)}
                        </p>
                      )}
                      {(entrada || salida) && (
                        <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                          {entrada && `Entrada: ${entrada}`}{salida && ` → Salida: ${salida}`}
                        </p>
                      )}
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(a.id)} style={{ marginLeft: 12, flexShrink: 0 }}>🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Resumen */}
        {asignacionesRango.length > 0 && (
          <div style={{
            marginTop: 20, background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)',
            padding: '10px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 13,
          }}>
            <span style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>
              {asignacionesRango.length} asignación{asignacionesRango.length !== 1 ? 'es' : ''}
            </span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              ✓ {asignacionesRango.filter(a => getRegistroPorAsignacion(a.id)?.completado).length} completada{asignacionesRango.filter(a => getRegistroPorAsignacion(a.id)?.completado).length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Botón Guardar */}
        {asignacionesRango.length > 0 && (
          <button
            className="btn btn-success btn-block btn-lg"
            style={{ marginTop: 16 }}
            onClick={handleGuardar}
          >
            Guardar asignaciones
          </button>
        )}

      </div>

      {/* Toast éxito */}
      {guardadoOk && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--success)', color: '#fff',
          borderRadius: 12, padding: '14px 28px',
          boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 15, fontWeight: 600, zIndex: 999,
          animation: 'fadeIn 0.2s ease',
        }}>
          <span style={{ fontSize: 20 }}>✅</span>
          ¡Guardado con éxito!
        </div>
      )}

      {showMenu && (
        <MenuDrawer
          onClose={() => setShowMenu(false)}
          onIr={path => { setShowMenu(false); navegarConGuardia(() => navigate(path)) }}
          onAbrirPersonal={() => setShowPersonal(true)}
          onAbrirZonas={() => setShowZonas(true)}
        />
      )}

      {showConfirm && <ModalConfirmSalida onConfirmar={confirmar} onCancelar={cancelar} />}

      {showZonas && (
        <ZonaModal zonas={zonas} onCrear={crearZona} onEditar={editarZona} onEliminar={desactivarZona} onClose={() => setShowZonas(false)} />
      )}
      {showPersonal && (
        <PersonalModal personal={personal} onAgregar={agregarPersonal} onEditar={editarPersonal} onEliminar={eliminarPersonal} onClose={() => { setShowPersonal(false); refetchPersonal() }} />
      )}
    </div>
  )
}
