import { useState, useRef, useEffect } from 'react'
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

// ── Dropdown con colores ──────────────────────────────────────────
function SelectColor({ placeholder, opciones, valor, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const seleccionado = opciones.find(o => o.value === valor)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '10px 14px',
          border: `2px solid ${seleccionado ? seleccionado.color : 'var(--border)'}`,
          borderRadius: 10, cursor: 'pointer',
          background: seleccionado ? seleccionado.bg : 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: seleccionado ? seleccionado.color : 'var(--text-muted)' }}>
          {seleccionado ? seleccionado.label : placeholder}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 100, overflow: 'hidden',
        }}>
          {opciones.map(o => (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              onClick={() => { if (!o.disabled) { onChange(o.value); setOpen(false) } }}
              style={{
                width: '100%', padding: '10px 14px',
                border: 'none', cursor: o.disabled ? 'not-allowed' : 'pointer',
                background: o.disabled ? '#fef2f2' : valor === o.value ? o.bg : 'transparent',
                display: 'flex', alignItems: 'center', gap: 10,
                textAlign: 'left', transition: 'background 0.1s',
                opacity: o.disabled ? 0.8 : 1,
              }}
              onMouseEnter={e => { if (!o.disabled) e.currentTarget.style.background = o.bg }}
              onMouseLeave={e => { if (!o.disabled) e.currentTarget.style.background = valor === o.value ? o.bg : 'transparent' }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: o.disabled ? '#ef4444' : o.color, flexShrink: 0,
              }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: o.disabled ? '#ef4444' : o.color }}>
                {o.label}
              </span>
              {o.disabled && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#ef4444', background: '#fee2e2', borderRadius: 5, padding: '1px 6px' }}>Ocupado</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const PALETA = [
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#dcfce7', color: '#15803d' },
  { bg: '#fce7f3', color: '#be185d' },
  { bg: '#fef9c3', color: '#a16207' },
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#ffedd5', color: '#c2410c' },
  { bg: '#cffafe', color: '#0e7490' },
  { bg: '#f0fdf4', color: '#166534' },
]

const COLORES_DIAS = {
  1: { bg: '#dbeafe', color: '#1d4ed8' },
  2: { bg: '#dcfce7', color: '#15803d' },
  3: { bg: '#fce7f3', color: '#be185d' },
  4: { bg: '#fef9c3', color: '#a16207' },
  5: { bg: '#ede9fe', color: '#6d28d9' },
  6: { bg: '#ffedd5', color: '#c2410c' },
  0: { bg: '#cffafe', color: '#0e7490' },
}

// ── Calendario con rango ──────────────────────────────────────────
function CalendarioMes({ mes, inicio, fin, onClick, diasBloqueados = new Set() }) {
  const total   = diasEnMes(mes)
  const offset  = offsetMes(mes)
  const hoyISO  = hoy()

  // días con al menos una asignación
  const conAsig = (() => {
    try {
      const all = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
      return new Set(all.filter(a => a.fecha.startsWith(mes) && a.activo !== false).map(a => a.fecha))
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
            const bloqueado = diasBloqueados.has(iso)
            const esInicio  = d === desde && inicio !== null
            const esFin     = d === hasta && fin !== null
            const enRango   = inicio !== null && fin !== null && d > desde && d < hasta
            const esHoy     = iso === hoyISO
            const tieneA    = conAsig.has(iso)
            const soloPend  = inicio !== null && fin === null && d === inicio

            let bg = 'transparent'
            let borderColor = 'transparent'
            let textColor = 'var(--text)'

            if (bloqueado) {
              bg = '#fee2e2'
              borderColor = '#fca5a5'
              textColor = '#ef4444'
            } else if (esInicio || esFin) {
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
                onClick={() => !bloqueado && onClick(d)}
                disabled={bloqueado}
                style={{
                  border: `2px solid ${borderColor}`,
                  borderRadius: esInicio ? '8px 0 0 8px' : esFin ? '0 8px 8px 0' : enRango ? 0 : 8,
                  background: bg,
                  cursor: bloqueado ? 'not-allowed' : 'pointer',
                  padding: '5px 2px 7px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  transition: 'background 0.1s',
                  opacity: bloqueado ? 0.7 : 1,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: (esInicio || esFin) ? 700 : 400, color: textColor }}>
                  {bloqueado ? '✕' : d}
                </span>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: tieneA && !bloqueado
                    ? ((esInicio || esFin) ? 'rgba(255,255,255,0.8)' : 'var(--primary)')
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
  const [showPostGuardado, setShowPostGuardado] = useState(false)
  const [foto, setFoto] = useState(null)

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

  // Para el form: personas ya asignadas en algún día del rango en este turno
  const yaAsignadosIds = [...new Set(asignacionesRango.map(a => a.personal_id).filter(Boolean))]

  // Días bloqueados: fechas donde la persona seleccionada ya tiene asignación en este turno
  const diasBloqueados = (() => {
    if (!selPersonal) return new Set()
    try {
      const all = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
      return new Set(
        all.filter(a => a.personal_id === selPersonal && a.turno === selTurnoForm && a.activo !== false)
           .map(a => a.fecha)
      )
    } catch { return new Set() }
  })()

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

  function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setFoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleCrearAsignacion() {
    if (!selPersonal || !selZona) { setErrForm('Seleccioná persona y zona'); return }
    if (selDiaSemana !== null && fechasParaAsignar.length === 0) {
      setErrForm('El día elegido no existe en el rango seleccionado')
      return
    }
    setGuardando(true)
    let errores = 0
    const pSelec = personalTurno.find(p => p.id === selPersonal)
    for (const f of fechasParaAsignar) {
      const { error } = store.addAsignacion(selPersonal, selZona, selTurnoForm, f, pSelec?.nombre || '', pSelec?.sector || '', foto)
      if (error) errores++
    }
    forceRefetch()
    if (errores === fechasRango.length) {
      setErrForm('La persona ya está asignada en todos los días del rango')
    } else {
      setHayCambios(false)
      setSelPersonal('')
      setSelZona('')
      setSelDiaSemana(null)
      setFoto(null)
      setShowPostGuardado(true)
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

        {/* Tarjetas de turno */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { t: 'mañana', emoji: '☀️', label: 'Mañana', hora: '7am – 4pm', color: 'var(--manana-badge)', bg: 'var(--manana-bg)' },
            { t: 'noche',  emoji: '🌙', label: 'Noche',  hora: '2pm – 11pm', color: 'var(--noche-badge)',  bg: 'var(--noche-bg)'  },
          ].map(({ t, emoji, label, hora, color, bg }) => {
            const sel = selTurnoForm === t
            return (
              <button
                key={t}
                onClick={() => { setSelTurnoForm(t); setSelPersonal('') }}
                style={{
                  flex: 1, padding: '14px 10px',
                  border: `2px solid ${sel ? color : 'var(--border)'}`,
                  borderRadius: 12, cursor: 'pointer',
                  background: sel ? bg : 'var(--bg-card)',
                  textAlign: 'center',
                  boxShadow: sel ? `0 2px 8px ${color}33` : 'var(--shadow)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>{emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: sel ? color : 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: 11, color: sel ? color : 'var(--text-muted)', marginTop: 2 }}>{hora}</div>
              </button>
            )
          })}
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

          <CalendarioMes mes={mes} inicio={inicio} fin={fin} onClick={handleDiaClick} diasBloqueados={diasBloqueados} />
          {selPersonal && diasBloqueados.size > 0 && (
            <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6, textAlign: 'center' }}>
              ✕ Los días en rojo ya tienen asignación para esta persona
            </p>
          )}

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


        {/* Formulario nueva asignación */}
        {showForm && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'var(--text)' }}>Nueva asignación</p>
            <p style={{ fontSize: 12, color: 'var(--primary-dark)', marginBottom: 16 }}>📅 {textoRango}</p>

            {/* 1. Personal — lo más importante */}
            <div className="input-group">
              <label className="input-label" style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-dark)' }}>👤 Persona</label>
              {loadingPersonal ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Cargando personal...</p>
              ) : personalTurno.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--warning)', padding: '8px 0' }}>⚠️ No hay personal con ese turno</p>
              ) : (
                <SelectColor
                  placeholder="Seleccionar persona"
                  valor={selPersonal}
                  onChange={v => { setSelPersonal(v); setSelDiaSemana(null); setErrForm('') }}
                  opciones={personalTurno.map((p, i) => ({
                    value: p.id,
                    label: p.nombre + (p.sector ? ` · ${p.sector}` : ''),
                    ...PALETA[i % PALETA.length],
                  }))}
                />
              )}

            </div>

            {/* Sector de la persona seleccionada */}
            {selPersonal && (() => {
              const pSel = personalTurno.find(p => p.id === selPersonal)
              if (!pSel?.sector) return null
              return (
                <div style={{
                  marginTop: -4, marginBottom: 12, padding: '10px 14px',
                  background: 'var(--primary-light)', borderRadius: 10,
                  border: '1.5px solid var(--primary)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>🏷️</span>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary-dark)', margin: 0, letterSpacing: 1, textTransform: 'uppercase' }}>Sector</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary-dark)', margin: 0 }}>{pSel.sector}</p>
                  </div>
                </div>
              )
            })()}

            {/* Foto */}
            <div className="input-group">
              <label className="input-label" style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-dark)' }}>📷 Foto del área (opcional)</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: foto ? 10 : 0 }}>
                <label style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '11px 8px', border: '2px dashed var(--border)', borderRadius: 10,
                  cursor: 'pointer', background: 'var(--bg-card)', fontSize: 13, fontWeight: 700,
                  color: 'var(--primary-dark)',
                }}>
                  📷 Tomar foto
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={handleFotoChange} />
                </label>
                <label style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '11px 8px', border: '2px dashed var(--border)', borderRadius: 10,
                  cursor: 'pointer', background: 'var(--bg-card)', fontSize: 13, fontWeight: 700,
                  color: 'var(--primary-dark)',
                }}>
                  🖼️ Galería
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={handleFotoChange} />
                </label>
              </div>
              {foto && (
                <div style={{ position: 'relative' }}>
                  <img src={foto} alt="preview" style={{
                    width: '100%', maxHeight: 200, objectFit: 'cover',
                    borderRadius: 10, border: '2px solid var(--border)', display: 'block',
                  }} />
                  <button
                    type="button"
                    onClick={() => setFoto(null)}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.55)', color: '#fff',
                      border: 'none', borderRadius: '50%', width: 28, height: 28,
                      cursor: 'pointer', fontSize: 15, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                    }}
                  >✕</button>
                </div>
              )}
            </div>

            {/* 2. Día disponible */}
            <div className="input-group">
              <label className="input-label" style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-dark)' }}>📆 Día que limpiará</label>
              <SelectColor
                placeholder={selPersonal ? 'Elegir día disponible' : 'Primero seleccioná la persona'}
                valor={selDiaSemana === null ? '' : String(selDiaSemana)}
                onChange={v => { setSelDiaSemana(v === '' ? null : Number(v)); setErrForm('') }}
                opciones={[
                  { value: '', label: 'Todos los días disponibles', ...PALETA[0] },
                  ...DIAS_SEMANA
                    .filter(({ jsDay }) => fechasRango.some(f => new Date(f + 'T12:00:00').getDay() === jsDay))
                    .map(({ label, jsDay }) => {
                      const ocupado = selPersonal && fechasRango
                        .filter(f => new Date(f + 'T12:00:00').getDay() === jsDay)
                        .every(f => diasBloqueados.has(f))
                      return {
                        value: String(jsDay),
                        label,
                        ...COLORES_DIAS[jsDay],
                        disabled: ocupado,
                      }
                    })
                ]}
              />
              {/* Días ocupados en el rango */}
              {selPersonal && (() => {
                const diasOcupados = DIAS_SEMANA.filter(({ jsDay }) =>
                  fechasRango.some(f => new Date(f + 'T12:00:00').getDay() === jsDay && diasBloqueados.has(f))
                )
                if (diasOcupados.length === 0) return null
                return (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>Ocupado:</span>
                    {diasOcupados.map(({ label, jsDay }) => (
                      <span key={jsDay} style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#ef4444', borderRadius: 6, padding: '2px 8px' }}>
                        {label}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* 3. Zona */}
            <div className="input-group">
              <label className="input-label" style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-dark)' }}>🏢 Zona de limpieza</label>
              <SelectColor
                placeholder="Seleccionar zona"
                valor={selZona}
                onChange={v => { setSelZona(v); setErrForm('') }}
                opciones={zonas.map((z, i) => ({
                  value: z.id,
                  label: z.nombre,
                  ...PALETA[(i + 2) % PALETA.length],
                }))}
              />
            </div>

            {errForm && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{errForm}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCrearAsignacion} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setErrForm('') }}>Cancelar</button>
            </div>
          </div>
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

      {showPostGuardado && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(30,58,95,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 500, padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 16, padding: '28px 24px',
            width: '100%', maxWidth: 320,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>
              ¡Asignación guardada!
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              ¿Qué querés hacer ahora?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary btn-block"
                onClick={() => setShowPostGuardado(false)}
              >
                ➕ Seguir agregando
              </button>
              <button
                className="btn btn-ghost btn-block"
                onClick={() => { setShowPostGuardado(false); navigate('/semana') }}
              >
                📅 Ver semana
              </button>
            </div>
          </div>
        </div>
      )}

      {showZonas && (
        <ZonaModal zonas={zonas} onCrear={crearZona} onEditar={editarZona} onEliminar={desactivarZona} onClose={() => setShowZonas(false)} />
      )}
      {showPersonal && (
        <PersonalModal personal={personal} onAgregar={agregarPersonal} onEditar={editarPersonal} onEliminar={eliminarPersonal} onClose={() => { setShowPersonal(false); refetchPersonal() }} />
      )}
    </div>
  )
}
