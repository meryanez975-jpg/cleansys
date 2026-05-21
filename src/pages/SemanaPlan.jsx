import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as store from '../data/store'
import { supabase } from '../supabase/client'
import html2canvas from 'html2canvas'
import MenuDrawer from '../components/MenuDrawer'
import ZonaModal from '../components/ZonaModal'
import PersonalModal from '../components/PersonalModal'
import { useZonas } from '../hooks/useZonas'
import { usePersonal } from '../hooks/usePersonal'
import { usePersonalComidas } from '../hooks/usePersonalComidas'

const DIAS_FULL  = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getLunesDeHoy() {
  const hoy = new Date()
  const dia = hoy.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() + diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

function fechaISO(date) { return date.toISOString().split('T')[0] }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function formatMes(date) { return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) }
function turnoDePersona(turnoSupabase) {
  if (!turnoSupabase) return null
  const t = turnoSupabase.toLowerCase().normalize('NFC').trim()
  if (t === 'mañana' || t === 'manana' || t === 'diurno') return 'mañana'
  if (t === 'tarde' || t === 'noche') return 'noche'
  return null
}

export default function SemanaPlan() {
  const navigate = useNavigate()
  const [lunesBase, setLunesBase] = useState(getLunesDeHoy)
  const [tick, setTick] = useState(0)
  const [personalMap, setPersonalMap] = useState({})
  const [filtroTurno, setFiltroTurno] = useState(null)
  const [vista, setVista] = useState('inicio') // 'inicio' | 'semana' | 'limpieza' | 'sinTarea'
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState({ zona_id: '', turno: '' })
  const [zonasAbiertas, setZonasAbiertas] = useState({})
  const [turnosAbiertos, setTurnosAbiertos] = useState({})
  const [elegirTurnoCaptura, setElegirTurnoCaptura] = useState(null) // 'semana' | zonaId
  const [showMenu, setShowMenu] = useState(false)
  const [showZonas, setShowZonas] = useState(false)
  const [showPersonal, setShowPersonal] = useState(false)
  const [zonaFiltro, setZonaFiltro] = useState(null) // null = todas, o zona ID
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [inputInicio, setInputInicio] = useState('')
  const [inputFin, setInputFin] = useState('')
  const [rangoPersonalizado, setRangoPersonalizado] = useState(null) // { inicio: Date, fin: Date }
  const [addingFor, setAddingFor] = useState(null) // { iso, turno }
  const [addPersonalId, setAddPersonalId] = useState('')
  const [addZonaId, setAddZonaId] = useState('')

  useEffect(() => { setTick(t => t + 1) }, [])

  const { zonas, crearZona, editarZona, desactivarZona } = useZonas()
  const { personal, agregar: agregarPersonal, editar: editarPersonal, eliminar: eliminarPersonal, refetch: refetchPersonal } = usePersonal()
  const { personal: personalDB } = usePersonalComidas(null)

  useEffect(() => {
    supabase.from('com_personal').select('id, nombre').eq('activo', true)
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(p => { map[p.id] = p.nombre })
          setPersonalMap(map)
        }
      })
  }, [])

  const fechasSemana = (() => {
    if (rangoPersonalizado) {
      const dias = []
      let cur = new Date(rangoPersonalizado.inicio)
      const fin = new Date(rangoPersonalizado.fin)
      while (cur <= fin) { dias.push(new Date(cur)); cur = addDays(cur, 1) }
      return dias
    }
    return Array.from({ length: 7 }, (_, i) => addDays(lunesBase, i))
  })()
  const fechasISO    = fechasSemana.map(fechaISO)
  const asigsTodas   = store.getAsignacionesPorFechas(fechasISO) || (tick, [])
  const asigs        = zonaFiltro ? asigsTodas.filter(a => a.zona_id === zonaFiltro) : asigsTodas
  const hoyISO       = fechaISO(new Date())
  const asigHoy      = asigs.filter(a => a.fecha === hoyISO)
  const asigHoyManana = asigHoy.filter(a => a.turno === 'mañana').length
  const asigHoyNoche  = asigHoy.filter(a => a.turno === 'noche').length

  function getNombre(a) {
    return personalMap[a.personal_id] || a.personalNombre || a.personal?.nombre || '—'
  }

  const totalAsigs  = asigs.length
  const totalManana = asigs.filter(a => a.turno === 'mañana').length
  const totalNoche  = asigs.filter(a => a.turno === 'noche').length

  const personalConTarea = (() => {
    const mapa = {}
    asigs.forEach(a => {
      const id = a.personal_id
      if (!id) return
      const nombre = personalMap[id] || a.personalNombre || a.personal?.nombre || '—'
      const diaIdx = fechasISO.indexOf(a.fecha)
      const diaCorto = diaIdx >= 0 ? DIAS_CORTO[diaIdx] : '?'
      if (!mapa[id]) mapa[id] = { nombre, dias: [], asignaciones: [] }
      if (!mapa[id].dias.includes(diaCorto)) mapa[id].dias.push(diaCorto)
      mapa[id].asignaciones.push(a)
    })
    return Object.values(mapa).sort((a, b) => b.dias.length - a.dias.length)
  })()

  const idsConTarea = [...new Set(asigs.map(a => a.personal_id).filter(Boolean))]
  const sinTarea = Object.entries(personalMap)
    .filter(([id]) => !idsConTarea.includes(id))
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  function abrirEdicion(a) {
    setEditandoId(a.id)
    setEditForm({ zona_id: a.zona_id || '', turno: a.turno || '', fecha: a.fecha || '' })
  }

  function guardarEdicion(id) {
    store.editAsignacion(id, { zona_id: editForm.zona_id, turno: editForm.turno, fecha: editForm.fecha })
    setEditandoId(null)
    setTick(t => t + 1)
  }

  function eliminarAsig(id) {
    store.removeAsignacion(id)
    setTick(t => t + 1)
  }

  function toggleTurno(iso, turno) {
    setTurnosAbiertos(prev => {
      const actual = prev[iso]
      return { ...prev, [iso]: actual === turno ? null : turno }
    })
    setAddingFor(null)
    setAddPersonalId('')
    setAddZonaId('')
  }

  function handleAddAsignacion() {
    if (!addPersonalId || !addingFor) return
    const p = personalDB.find(x => x.id === addPersonalId)
    store.addAsignacion(addPersonalId, addZonaId || '', addingFor.turno, addingFor.iso, p?.nombre || '', p?.sector || '')
    setTick(t => t + 1)
    setAddingFor(null)
    setAddPersonalId('')
    setAddZonaId('')
  }

  const btnBase = { flex: 1, borderRadius: 12, padding: '14px 10px', textAlign: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }
  const semanaRef = useRef(null)
  const zonasRefs = useRef({})

  const rangoTexto = `${fechasSemana[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} — ${fechasSemana[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`

  async function compartirCaptura(ref, titulo, info) {
    if (!ref) return
    const canvas = await html2canvas(ref, { backgroundColor: '#fff', scale: 2 })
    canvas.toBlob(async blob => {
      const nombreArchivo = `${titulo.replace(/\s+/g, '-')}-${fechasISO[0]}.png`
      const file = new File([blob], nombreArchivo, { type: 'image/png' })
      const texto = `📅 ${rangoTexto}\n${info}`
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: titulo, text: texto }) } catch {}
      } else {
        const link = document.createElement('a')
        link.download = nombreArchivo
        link.href = URL.createObjectURL(blob)
        link.click()
      }
    }, 'image/png')
  }

  function capturarSemana() {
    if (!filtroTurno) { setElegirTurnoCaptura('semana'); return }
    const turnoTexto = filtroTurno === 'mañana' ? '☀️ Turno Mañana' : '🌙 Turno Noche'
    compartirCaptura(semanaRef.current, 'Semana de trabajo', turnoTexto)
  }

  function capturarZona(zonaId, zonaNombre) {
    if (!filtroTurno) { setElegirTurnoCaptura(zonaId); return }
    const turnoTexto = filtroTurno === 'mañana' ? '☀️ Turno Mañana' : '🌙 Turno Noche'
    compartirCaptura(zonasRefs.current[zonaId], `Zona ${zonaNombre}`, `🏢 ${zonaNombre} · ${turnoTexto}\n📅 ${rangoTexto}`)
  }

  function ejecutarCapturaConTurno(turno) {
    const t = turno === 'mañana' ? '☀️ Turno Mañana' : '🌙 Turno Noche'
    if (elegirTurnoCaptura === 'semana') {
      // Capturar con filtro temporal
      setFiltroTurno(turno)
      setTimeout(() => {
        compartirCaptura(semanaRef.current, 'Semana de trabajo', t)
        setElegirTurnoCaptura(null)
      }, 100)
    } else {
      const zona = zonas.find(z => z.id === elegirTurnoCaptura)
      setTimeout(() => {
        compartirCaptura(zonasRefs.current[elegirTurnoCaptura], `Zona ${zona?.nombre}`, `🏢 ${zona?.nombre} · ${t}\n📅 ${rangoTexto}`)
        setElegirTurnoCaptura(null)
      }, 100)
    }
  }

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
            <p className="header-title">
              {zonaFiltro ? (zonas.find(z => z.id === zonaFiltro)?.nombre ?? 'Semana de trabajo') : 'Semana de trabajo'}
            </p>
            <p className="header-sub">{formatMes(lunesBase)}</p>
          </div>
        </div>

        {/* ── Vista: Inicio / Bienvenida ── */}
        {vista === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Tarjeta principal de bienvenida */}
            <div style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%)',
              borderRadius: 'var(--radius)',
              padding: '24px 20px',
              color: '#fff',
              boxShadow: '0 6px 24px rgba(29,78,216,0.3)',
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, opacity: 0.75, textTransform: 'capitalize' }}>
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                {(() => {
                  const h = new Date().getHours()
                  if (h >= 5  && h < 12) return 'Buenos días 👋'
                  if (h >= 12 && h < 19) return 'Buenas tardes 👋'
                  return 'Buenas noches 👋'
                })()}
              </p>
              <p style={{ fontSize: 14, opacity: 0.85, marginTop: 6 }}>
                ¿Qué planeas hacer hoy?
              </p>

              {/* Resumen hoy */}
              <div style={{
                marginTop: 16,
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '12px 14px',
              }}>
                {asigHoy.length === 0 ? (
                  <p style={{ fontSize: 13, fontWeight: 600 }}>💤 Sin asignaciones para hoy</p>
                ) : (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>
                      📋 {asigHoy.length} asignación{asigHoy.length !== 1 ? 'es' : ''} para hoy
                    </p>
                    <p style={{ fontSize: 12, opacity: 0.85, marginTop: 4, display: 'flex', gap: 12 }}>
                      {asigHoyManana > 0 && <span>☀️ {asigHoyManana} mañana</span>}
                      {asigHoyNoche  > 0 && <span>🌙 {asigHoyNoche} noche</span>}
                    </p>
                  </>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Barra de navegación (visible en todas las vistas excepto inicio) */}
        {vista !== 'inicio' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setVista('inicio')} style={{
              ...btnBase, flex: 'none', padding: '10px 14px',
              background: 'var(--primary-light)', color: 'var(--primary-dark)',
              fontWeight: 700, fontSize: 18,
            }}>
              ←
            </button>
            <button onClick={() => setVista('semana')} style={{
              ...btnBase,
              background: vista === 'semana' ? '#1d4ed8' : '#dbeafe',
              boxShadow: vista === 'semana' ? '0 3px 10px rgba(29,78,216,0.35)' : 'none',
            }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: vista === 'semana' ? '#fff' : '#1d4ed8' }}>{totalAsigs}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: vista === 'semana' ? '#fff' : '#1d4ed8' }}>📅 Semana</p>
            </button>
            <button onClick={() => setVista('limpieza')} style={{
              ...btnBase,
              background: vista === 'limpieza' ? '#15803d' : '#dcfce7',
              boxShadow: vista === 'limpieza' ? '0 3px 10px rgba(21,128,61,0.35)' : 'none',
            }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: vista === 'limpieza' ? '#fff' : '#15803d' }}>{personalConTarea.length}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: vista === 'limpieza' ? '#fff' : '#15803d' }}>🧹 En limpieza</p>
            </button>
            <button onClick={() => setVista('sinTarea')} style={{
              ...btnBase,
              background: vista === 'sinTarea' ? '#475569' : '#f1f5f9',
              boxShadow: vista === 'sinTarea' ? '0 3px 10px rgba(71,85,105,0.35)' : 'none',
            }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: vista === 'sinTarea' ? '#fff' : '#64748b' }}>{sinTarea.length}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: vista === 'sinTarea' ? '#fff' : '#64748b' }}>💤 Sin tareas</p>
            </button>
          </div>
        )}

        {/* ── Vista: Semana ── */}
        {vista === 'semana' && <>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 12,
            boxShadow: 'var(--shadow)',
          }}>
            {/* Navegador de semana */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showDatePicker ? 12 : 0 }}>
              {!rangoPersonalizado ? (
                <button onClick={() => setLunesBase(d => addDays(d, -7))}
                  style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}>‹</button>
              ) : <div style={{ width: 40 }} />}

              <div style={{ textAlign: 'center', flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  {fechasSemana[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  {' — '}
                  {fechasSemana[fechasSemana.length - 1].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {totalAsigs} asignación{totalAsigs !== 1 ? 'es' : ''} · {personalConTarea.length} persona{personalConTarea.length !== 1 ? 's' : ''}
                </p>
              </div>

              {!rangoPersonalizado ? (
                <button onClick={() => setLunesBase(d => addDays(d, 7))}
                  style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}>›</button>
              ) : <div style={{ width: 40 }} />}
            </div>

            {/* Botón seleccionar fechas */}
            <div style={{ display: 'flex', gap: 6, marginTop: showDatePicker || rangoPersonalizado ? 10 : 8 }}>
              <button
                onClick={() => {
                  setShowDatePicker(v => !v)
                  setInputInicio(rangoPersonalizado ? fechaISO(rangoPersonalizado.inicio) : '')
                  setInputFin(rangoPersonalizado ? fechaISO(rangoPersonalizado.fin) : '')
                }}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: rangoPersonalizado ? 'var(--primary)' : 'var(--primary-light)',
                  color: rangoPersonalizado ? '#fff' : 'var(--primary-dark)',
                  fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                📅 {rangoPersonalizado ? 'Cambiar fechas' : 'Seleccionar fechas'}
              </button>
              {rangoPersonalizado && (
                <button
                  onClick={() => { setRangoPersonalizado(null); setShowDatePicker(false) }}
                  style={{ padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 12 }}
                >
                  ✕ Ver semana
                </button>
              )}
            </div>

            {/* Formulario de rango */}
            {showDatePicker && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Desde</p>
                    <input
                      type="date"
                      value={inputInicio}
                      onChange={e => setInputInicio(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Hasta</p>
                    <input
                      type="date"
                      value={inputFin}
                      onChange={e => setInputFin(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!inputInicio || !inputFin) return
                    setRangoPersonalizado({ inicio: new Date(inputInicio + 'T12:00:00'), fin: new Date(inputFin + 'T12:00:00') })
                    setShowDatePicker(false)
                  }}
                  disabled={!inputInicio || !inputFin}
                  style={{
                    padding: '9px 0', borderRadius: 8, border: 'none', cursor: inputInicio && inputFin ? 'pointer' : 'not-allowed',
                    background: inputInicio && inputFin ? 'var(--primary)' : '#cbd5e1',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                  }}
                >
                  ✓ Aplicar rango
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Semana</p>
          </div>
          <div ref={semanaRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, background: '#fff', borderRadius: 12, padding: 4 }}>
            {fechasSemana.map((fecha, i) => {
              const iso        = fechasISO[i]
              const esHoy      = iso === hoyISO
              const asigsDia   = asigs.filter(a => a.fecha === iso)
              const asigManana = asigsDia.filter(a => a.turno === 'mañana')
              const asigNoche  = asigsDia.filter(a => a.turno === 'noche')
              const turnoOpen  = turnosAbiertos[iso] ?? null
              const totalDia   = asigsDia.length

              const turnos = [
                { key: 'mañana', emoji: '☀️', label: 'Mañana', lista: asigManana, bg: '#fef3c7', bgAct: '#d97706', txt: '#92400e', txtAct: '#fff' },
                { key: 'noche',  emoji: '🌙', label: 'Noche',  lista: asigNoche,  bg: '#ede9fe', bgAct: '#6d28d9', txt: '#4c1d95', txtAct: '#fff' },
              ].filter(t => !filtroTurno || t.key === filtroTurno)

              return (
                <div key={iso} className="card" style={{
                  borderLeft: `4px solid ${esHoy ? 'var(--primary)' : 'var(--border)'}`,
                  padding: '12px 14px',
                  opacity: totalDia === 0 ? 0.55 : 1,
                }}>
                  {/* Cabecera del día */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: esHoy ? 'var(--primary-dark)' : 'var(--text)' }}>{DIAS_FULL[i]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                    {esHoy && <span className="badge badge-blue">Hoy</span>}
                    {totalDia === 0 && <span style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 'auto' }}>Sin asignaciones</span>}
                  </div>

                  {/* Botones de turno — solo muestra el abierto, o ambos si ninguno está abierto */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {turnos.filter(t => turnoOpen === null || turnoOpen === t.key).map(t => {
                      const abierto = turnoOpen === t.key
                      return (
                        <div key={t.key}>
                          <button
                            onClick={() => toggleTurno(iso, t.key)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: abierto ? '8px 8px 0 0' : 8,
                              border: 'none', cursor: 'pointer',
                              background: abierto ? t.bgAct : t.bg,
                              transition: 'all 0.15s',
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: 13, color: abierto ? t.txtAct : t.txt }}>
                              {t.emoji} {t.label}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                background: abierto ? 'rgba(255,255,255,0.25)' : t.bgAct,
                                color: '#fff',
                              }}>{t.lista.length}</span>
                              <span style={{ fontSize: 11, color: abierto ? t.txtAct : t.txt }}>{abierto ? '▲' : '▼'}</span>
                            </div>
                          </button>

                          {abierto && (
                            <div style={{
                              background: t.bg, border: `1px solid ${t.bgAct}44`, borderTop: 'none',
                              borderRadius: '0 0 8px 8px', padding: '8px 10px',
                              display: 'flex', flexDirection: 'column', gap: 5,
                            }}>
                              {/* Personas asignadas */}
                              {t.lista.map(a => (
                                <div key={a.id} style={{
                                  background: '#fff', borderRadius: 7, padding: '6px 10px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{getNombre(a)}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: t.txt, background: t.bg, borderRadius: 6, padding: '2px 8px' }}>
                                    {a.zona?.nombre || '—'}
                                  </span>
                                </div>
                              ))}

                              {/* Formulario agregar */}
                              {addingFor?.iso === iso && addingFor?.turno === t.key ? (
                                <div style={{ background: '#fff', borderRadius: 8, padding: '10px', border: `1.5px solid ${t.bgAct}66`, marginTop: t.lista.length > 0 ? 4 : 0 }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: t.txt, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Persona</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
                                    {personalDB
                                      .filter(p => turnoDePersona(p.turno) === t.key)
                                      .map(p => (
                                        <button
                                          key={p.id}
                                          onClick={() => setAddPersonalId(p.id)}
                                          style={{
                                            padding: '8px 12px', borderRadius: 8, textAlign: 'left',
                                            border: `2px solid ${addPersonalId === p.id ? t.bgAct : '#e2e8f0'}`,
                                            background: addPersonalId === p.id ? t.bg : '#f8fafc',
                                            color: addPersonalId === p.id ? t.bgAct : '#475569',
                                            fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                            transition: 'all 0.12s',
                                          }}
                                        >
                                          {addPersonalId === p.id ? '✓ ' : ''}{p.nombre}
                                        </button>
                                      ))}
                                  </div>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: t.txt, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zona</p>
                                  <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 6, marginBottom: 10, paddingBottom: 4, scrollbarWidth: 'thin' }}>
                                    {zonas.map(z => (
                                      <button
                                        key={z.id}
                                        onClick={() => setAddZonaId(z.id)}
                                        style={{
                                          flexShrink: 0, padding: '6px 12px', borderRadius: 16,
                                          border: `2px solid ${addZonaId === z.id ? t.bgAct : '#e2e8f0'}`,
                                          background: addZonaId === z.id ? t.bg : '#f8fafc',
                                          color: addZonaId === z.id ? t.bgAct : '#475569',
                                          fontWeight: 600, fontSize: 12, cursor: 'pointer',
                                          transition: 'all 0.12s', whiteSpace: 'nowrap',
                                        }}
                                      >{z.nombre}</button>
                                    ))}
                                  </div>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      onClick={handleAddAsignacion}
                                      disabled={!addPersonalId}
                                      style={{
                                        flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                                        background: addPersonalId ? t.bgAct : '#cbd5e1',
                                        color: '#fff', fontWeight: 700, fontSize: 13,
                                        cursor: addPersonalId ? 'pointer' : 'not-allowed',
                                      }}
                                    >✓ Guardar</button>
                                    <button
                                      onClick={() => { setAddingFor(null); setAddPersonalId(''); setAddZonaId('') }}
                                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                                    >✕</button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setAddingFor({ iso, turno: t.key }); setAddPersonalId(''); setAddZonaId('') }}
                                  style={{
                                    width: '100%', padding: '6px 0', borderRadius: 7,
                                    border: `1.5px dashed ${t.bgAct}88`,
                                    background: 'transparent', color: t.bgAct,
                                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                                    marginTop: t.lista.length > 0 ? 4 : 0,
                                  }}
                                >➕ Agregar persona</button>
                              )}

                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Footer info para captura — solo cuando hay rango personalizado */}
            {(rangoPersonalizado || filtroTurno) && (
              <div style={{ marginTop: 4, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {rangoPersonalizado && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>📅 {rangoTexto}</span>
                )}
                {filtroTurno && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: filtroTurno === 'mañana' ? '#d97706' : '#6d28d9' }}>
                    {filtroTurno === 'mañana' ? '☀️ Mañana' : '🌙 Noche'}
                  </span>
                )}
              </div>
            )}
          </div>

        </>}

        {/* ── Vista: En limpieza ── */}
        {vista === 'limpieza' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <button onClick={capturarSemana} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'linear-gradient(135deg, #0ea5e9, #6d28d9)',
                border: 'none', borderRadius: 8, padding: '5px 10px',
                cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700,
                boxShadow: '0 2px 8px rgba(14,165,233,0.35)',
              }}>
                📸 Capturar
              </button>
            </div>
            {asigs.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No hay personal asignado esta semana</p>
            ) : fechasSemana.map((fecha, i) => {
              const iso = fechasISO[i]
              const manana = asigs.filter(a => a.fecha === iso && a.turno === 'mañana')
              const noche  = asigs.filter(a => a.fecha === iso && a.turno === 'noche')
              if (manana.length === 0 && noche.length === 0) return null

              const renderFila = (a) => (
                <div key={a.id}>
                  {editandoId === a.id ? (
                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '2px solid #86efac', marginBottom: 4 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>Editar asignación</p>
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Día</p>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {fechasSemana.map((f2, i2) => {
                            const iso2 = fechasISO[i2]
                            const activo = editForm.fecha === iso2
                            return (
                              <button key={iso2} onClick={() => setEditForm(f => ({ ...f, fecha: iso2 }))}
                                style={{ flex: 1, minWidth: 36, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, background: activo ? '#0ea5e9' : '#e0f2fe', color: activo ? '#fff' : '#0369a1', transition: 'all 0.15s' }}
                              >{DIAS_CORTO[i2]}</button>
                            )
                          })}
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Turno</p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditForm(f => ({ ...f, turno: 'mañana' }))} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: editForm.turno === 'mañana' ? '#d97706' : '#fef3c7', color: editForm.turno === 'mañana' ? '#fff' : '#92400e', transition: 'all 0.15s' }}>☀️ Mañana</button>
                          <button onClick={() => setEditForm(f => ({ ...f, turno: 'noche' }))} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: editForm.turno === 'noche' ? '#6d28d9' : '#ede9fe', color: editForm.turno === 'noche' ? '#fff' : '#4c1d95', transition: 'all 0.15s' }}>🌙 Noche</button>
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zona</p>
                        <select value={editForm.zona_id} onChange={e => setEditForm(f => ({ ...f, zona_id: e.target.value }))}
                          style={{ width: '100%', fontSize: 13, padding: '9px 12px', borderRadius: 10, border: '2px solid #a78bfa', background: 'linear-gradient(135deg, #ede9fe, #fdf4ff)', color: '#5b21b6', fontWeight: 700, cursor: 'pointer' }}>
                          <option value="">— Sin zona —</option>
                          {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => guardarEdicion(a.id)} style={{ flex: 1, background: '#15803d', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Guardar</button>
                        <button onClick={() => setEditandoId(null)} style={{ flex: 1, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#fff', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{getNombre(a)}</span>
                        {a.zona?.nombre && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>· {a.zona.nombre}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => abrirEdicion(a)} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#15803d', fontWeight: 600 }}>✏️</button>
                        <button onClick={() => eliminarAsig(a.id)} style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              )

              return (
                <div key={iso} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>
                    {DIAS_FULL[i]} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                  </p>
                  {manana.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>☀️ Mañana</p>
                      {manana.map(renderFila)}
                    </div>
                  )}
                  {noche.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', marginBottom: 4 }}>🌙 Noche</p>
                      {noche.map(renderFila)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Vista: Sin tareas ── */}
        {vista === 'sinTarea' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sinTarea.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Todo el personal tiene tareas asignadas</p>
            ) : sinTarea.map((p, i) => (
              <div key={i} className="card" style={{ padding: '12px 14px' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>💤 {p.nombre}</span>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── Modal: elegir turno para captura ── */}
      {elegirTurnoCaptura !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }} onClick={() => setElegirTurnoCaptura(null)}>
          <div style={{
            background: '#fff', borderRadius: 18, padding: '28px 24px',
            width: '100%', maxWidth: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 22, marginBottom: 4 }}>📸</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
              ¿Qué turno querés compartir?
            </p>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
              La imagen se enviará con el turno seleccionado
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button onClick={() => ejecutarCapturaConTurno('mañana')} style={{
                flex: 1, padding: '14px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff', fontWeight: 800, fontSize: 14,
                boxShadow: '0 4px 14px rgba(217,119,6,0.4)',
              }}>
                <span style={{ display: 'block', fontSize: 20 }}>☀️</span>
                Mañana
              </button>
              <button onClick={() => ejecutarCapturaConTurno('noche')} style={{
                flex: 1, padding: '14px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff', fontWeight: 800, fontSize: 14,
                boxShadow: '0 4px 14px rgba(109,40,217,0.4)',
              }}>
                <span style={{ display: 'block', fontSize: 20 }}>🌙</span>
                Noche
              </button>
            </div>
            <button onClick={() => setElegirTurnoCaptura(null)} style={{
              width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px solid #e2e8f0',
              background: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showMenu && (
        <MenuDrawer
          onClose={() => setShowMenu(false)}
          onIr={path => { setShowMenu(false); navigate(path) }}
          onAbrirPersonal={() => { setShowMenu(false); setShowPersonal(true) }}
          onAbrirZonas={() => { setShowMenu(false); setShowZonas(true) }}
          zonas={zonas}
          onSeleccionarZona={id => { setZonaFiltro(id); setShowMenu(false); setVista('semana') }}
        />
      )}

      {showZonas && (
        <ZonaModal
          zonas={zonas}
          onCrear={crearZona}
          onEditar={editarZona}
          onEliminar={desactivarZona}
          onClose={() => setShowZonas(false)}
        />
      )}

      {showPersonal && (
        <PersonalModal
          personal={personal}
          onAgregar={agregarPersonal}
          onEditar={editarPersonal}
          onEliminar={eliminarPersonal}
          onClose={() => { setShowPersonal(false); refetchPersonal() }}
        />
      )}
    </div>
  )
}
