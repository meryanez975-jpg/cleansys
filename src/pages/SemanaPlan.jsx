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

function fechaISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
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
  const [rangoPersonalizado, setRangoPersonalizado] = useState(() => {
    try {
      const s = localStorage.getItem('cleansys_semana_rango')
      if (!s) return null
      const { inicio, fin } = JSON.parse(s)
      return { inicio: new Date(inicio), fin: new Date(fin) }
    } catch { return null }
  })
  const [addingFor, setAddingFor] = useState(null) // { iso, turno }
  const [addPersonalId, setAddPersonalId] = useState('')
  const [addZonaId, setAddZonaId] = useState('')
  const [openPersonKey, setOpenPersonKey] = useState(null)
  const [draftPatron, setDraftPatron] = useState([])
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [semanaConteo, setSemanaConteo] = useState(() => {
    const hoy = new Date()
    const d = hoy.getDay()
    const diff = d === 0 ? -6 : 1 - d
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diff)
    lunes.setHours(0, 0, 0, 0)
    return lunes
  })

  useEffect(() => { setTick(t => t + 1) }, [])

  useEffect(() => {
    if (vista === 'sinTarea') {
      const hoy = new Date()
      const d = hoy.getDay()
      const diff = d === 0 ? -6 : 1 - d
      const lunes = new Date(hoy)
      lunes.setDate(hoy.getDate() + diff)
      lunes.setHours(0, 0, 0, 0)
      setSemanaConteo(lunes)
    }
  }, [vista])

  useEffect(() => {
    if (rangoPersonalizado) {
      localStorage.setItem('cleansys_semana_rango', JSON.stringify({ inicio: rangoPersonalizado.inicio.toISOString(), fin: rangoPersonalizado.fin.toISOString() }))
    } else {
      localStorage.removeItem('cleansys_semana_rango')
    }
  }, [rangoPersonalizado])

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
  const allRegistros = (() => { try { return JSON.parse(localStorage.getItem('cleansys_registros') || '[]') } catch { return [] } })()
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

  // Modo patrón: agrupa las fechas del rango por día de semana
  const patronSemanal = rangoPersonalizado
    ? DIAS_FULL.map((nombre, i) => {
        const fechasDelDia = fechasSemana.filter(f => {
          const d = f.getDay()
          const idx = d === 0 ? 6 : d - 1
          return idx === i
        })
        const isosDelDia = fechasDelDia.map(fechaISO)
        const asigsDia = asigs.filter(a => isosDelDia.includes(a.fecha))
        return { nombre, isos: isosDelDia, asigs: asigsDia, count: isosDelDia.length }
      })
    : null

  function confirmarSiHayDraft(accion) {
    if (draftPatron.length === 0) { accion(); return }
    if (window.confirm('Tenés cambios sin guardar en el patrón.\n¿Querés salir de todos modos?')) {
      setDraftPatron([])
      accion()
    }
  }

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

  function agregarAlDraft() {
    if (!addPersonalId || !addingFor) return
    const p = personalDB.find(x => x.id === addPersonalId)
    const zona = addZonaId || zonaFiltro || ''
    setDraftPatron(prev => {
      const filtrado = prev.filter(d => !(d.patKey === addingFor.patKey && d.turno === addingFor.turno))
      return [...filtrado, { patKey: addingFor.patKey, isos: addingFor.isos, turno: addingFor.turno, personalId: addPersonalId, nombre: p?.nombre || '', zonaId: zona }]
    })
    setAddingFor(null)
    setAddPersonalId('')
    setAddZonaId('')
  }

  function guardarPatronCompleto() {
    draftPatron.forEach(d => {
      const p = personalDB.find(x => x.id === d.personalId)
      d.isos.forEach(iso => {
        store.addAsignacion(d.personalId, d.zonaId, d.turno, iso, p?.nombre || d.nombre, p?.sector || '')
      })
    })
    setDraftPatron([])
    setTick(t => t + 1)
    setGuardadoOk(true)
    setTimeout(() => setGuardadoOk(false), 3000)
  }

  function handleAddAsignacion() {
    if (!addPersonalId || !addingFor) return
    const p = personalDB.find(x => x.id === addPersonalId)
    const zona = addZonaId || zonaFiltro || ''
    if (addingFor.isos) {
      addingFor.isos.forEach(iso => {
        store.addAsignacion(addPersonalId, zona, addingFor.turno, iso, p?.nombre || '', p?.sector || '')
      })
    } else {
      store.addAsignacion(addPersonalId, zona, addingFor.turno, addingFor.iso, p?.nombre || '', p?.sector || '')
    }
    setTick(t => t + 1)
    setAddingFor(null)
    setAddPersonalId('')
    setAddZonaId('')
  }

  const btnBase = { flex: 1, borderRadius: 12, padding: '14px 10px', textAlign: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }
  const semanaRef = useRef(null)
  const zonasRefs = useRef({})

  const rangoTexto = `${fechasSemana[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} — ${fechasSemana[fechasSemana.length - 1].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`

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
            <button onClick={() => confirmarSiHayDraft(() => setVista('inicio'))} style={{
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
              <p style={{ fontSize: 12, fontWeight: 700, color: vista === 'semana' ? '#fff' : '#1d4ed8' }}>📅 Semana</p>
            </button>
            <button onClick={() => setVista('limpieza')} style={{
              ...btnBase,
              background: vista === 'limpieza' ? '#15803d' : '#dcfce7',
              boxShadow: vista === 'limpieza' ? '0 3px 10px rgba(21,128,61,0.35)' : 'none',
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: vista === 'limpieza' ? '#fff' : '#15803d' }}>🧹 Limpieza</p>
            </button>
            <button onClick={() => setVista('sinTarea')} style={{
              ...btnBase,
              background: vista === 'sinTarea' ? '#475569' : '#f1f5f9',
              boxShadow: vista === 'sinTarea' ? '0 3px 10px rgba(71,85,105,0.35)' : 'none',
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: vista === 'sinTarea' ? '#fff' : '#64748b' }}>🧮 Conteo</p>
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
                  onClick={() => confirmarSiHayDraft(() => { setRangoPersonalizado(null); setShowDatePicker(false) })}
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
                      onChange={e => {
                        const val = e.target.value
                        setInputInicio(val)
                        if (val && inputFin) {
                          setRangoPersonalizado({ inicio: new Date(val + 'T12:00:00'), fin: new Date(inputFin + 'T12:00:00') })
                          setShowDatePicker(false)
                        }
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Hasta</p>
                    <input
                      type="date"
                      value={inputFin}
                      onChange={e => {
                        const val = e.target.value
                        setInputFin(val)
                        if (inputInicio && val) {
                          setRangoPersonalizado({ inicio: new Date(inputInicio + 'T12:00:00'), fin: new Date(val + 'T12:00:00') })
                          setShowDatePicker(false)
                        }
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {rangoPersonalizado ? 'Patrón del mes' : 'Semana'}
            </p>
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
          <div ref={semanaRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, background: '#fff', borderRadius: 12, padding: 4 }}>
            {rangoPersonalizado
              ? patronSemanal.map((dia, i) => {
                  if (dia.count === 0) return null
                  const turnoOpenPat = turnosAbiertos['pat-' + i] ?? null
                  const turnos = [
                    { key: 'mañana', emoji: '☀️', label: 'Mañana', bg: '#fef3c7', bgAct: '#d97706', txt: '#92400e', txtAct: '#fff' },
                    { key: 'noche',  emoji: '🌙', label: 'Noche',  bg: '#ede9fe', bgAct: '#6d28d9', txt: '#4c1d95', txtAct: '#fff' },
                  ].filter(t => !filtroTurno || t.key === filtroTurno)
                  return (
                    <div key={'pat-' + i} className="card" style={{ borderLeft: '4px solid var(--border)', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{dia.nombre}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {turnos.filter(t => turnoOpenPat === null || turnoOpenPat === t.key).map(t => {
                          const listaRaw = dia.asigs.filter(a => a.turno === t.key)
                          const lista = [...new Map(listaRaw.map(a => [a.personal_id, a])).values()]
                          const abierto = turnoOpenPat === t.key
                          const draft = draftPatron.find(d => d.patKey === 'pat-' + i && d.turno === t.key)
                          const badgeNombre = draft ? draft.nombre : (lista.length === 1 ? getNombre(lista[0]) : null)
                          return (
                            <div key={t.key}>
                              <button
                                onClick={() => toggleTurno('pat-' + i, t.key)}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '8px 12px', borderRadius: abierto ? '8px 8px 0 0' : 8,
                                  border: 'none', cursor: 'pointer', background: abierto ? t.bgAct : t.bg, transition: 'all 0.15s',
                                }}
                              >
                                <span style={{ fontWeight: 700, fontSize: 13, color: abierto ? t.txtAct : t.txt }}>{t.emoji} {t.label}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {badgeNombre ? (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: abierto ? 'rgba(255,255,255,0.25)' : t.bgAct, color: '#fff', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{badgeNombre}</span>
                                  ) : (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: abierto ? 'rgba(255,255,255,0.25)' : t.bgAct, color: '#fff' }}>{lista.length}</span>
                                  )}
                                  {(!badgeNombre || abierto) && <span style={{ fontSize: 11, color: abierto ? t.txtAct : t.txt }}>{abierto ? '▲' : '▼'}</span>}
                                </div>
                              </button>
                              {abierto && (
                                <div style={{ background: t.bg, border: `1px solid ${t.bgAct}44`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  {lista.map(a => (
                                    <div key={a.personal_id} style={{ background: '#fff', borderRadius: 7, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{getNombre(a)}</span>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: t.txt, background: t.bg, borderRadius: 6, padding: '2px 8px' }}>{a.zona?.nombre || '—'}</span>
                                    </div>
                                  ))}
                                  {/* Borrador pendiente */}
                                  {draft ? (
                                    <div style={{ background: '#fef9c3', borderRadius: 7, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1.5px dashed #d97706' }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#78350f' }}>⏳ {draft.nombre}</span>
                                      <button onClick={() => setDraftPatron(prev => prev.filter(d => !(d.patKey === draft.patKey && d.turno === draft.turno)))}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 13, fontWeight: 700, padding: '0 4px' }}>✕</button>
                                    </div>
                                  ) : null}
                                  {addingFor?.patKey === 'pat-' + i && addingFor?.turno === t.key ? (
                                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px', border: `1.5px solid ${t.bgAct}66`, marginTop: lista.length > 0 ? 4 : 0 }}>
                                      <p style={{ fontSize: 11, fontWeight: 700, color: t.txt, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Persona</p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
                                        {personalDB.map(p => (
                                          <button key={p.id} onClick={() => setAddPersonalId(p.id)} style={{ padding: '8px 12px', borderRadius: 8, textAlign: 'left', border: `2px solid ${addPersonalId === p.id ? t.bgAct : '#e2e8f0'}`, background: addPersonalId === p.id ? t.bg : '#f8fafc', color: addPersonalId === p.id ? t.bgAct : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.12s' }}>
                                            {addPersonalId === p.id ? '✓ ' : ''}{p.nombre}
                                          </button>
                                        ))}
                                      </div>
                                      <p style={{ fontSize: 11, fontWeight: 700, color: t.txt, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zona</p>
                                      <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 6, marginBottom: 10, paddingBottom: 4, scrollbarWidth: 'thin' }}>
                                        {zonas.map(z => (
                                          <button key={z.id} onClick={() => setAddZonaId(z.id)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 16, border: `2px solid ${addZonaId === z.id ? t.bgAct : '#e2e8f0'}`, background: addZonaId === z.id ? t.bg : '#f8fafc', color: addZonaId === z.id ? t.bgAct : '#475569', fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>{z.nombre}</button>
                                        ))}
                                      </div>
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={agregarAlDraft} disabled={!addPersonalId} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: addPersonalId ? t.bgAct : '#cbd5e1', color: '#fff', fontWeight: 700, fontSize: 13, cursor: addPersonalId ? 'pointer' : 'not-allowed' }}>
                                          ➕ Agregar al plan
                                        </button>
                                        <button onClick={() => { setAddingFor(null); setAddPersonalId(''); setAddZonaId('') }} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✕</button>
                                      </div>
                                    </div>
                                  ) : (lista.length === 0 && !draft) && (
                                    <button
                                      onClick={() => { setAddingFor({ isos: dia.isos, patKey: 'pat-' + i, turno: t.key }); setAddPersonalId(''); setAddZonaId(zonaFiltro || '') }}
                                      style={{ width: '100%', padding: '6px 0', borderRadius: 7, border: `1.5px dashed ${t.bgAct}88`, background: 'transparent', color: t.bgAct, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
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
                })
              : fechasSemana.map((fecha, i) => {
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: esHoy ? 'var(--primary-dark)' : 'var(--text)' }}>{DIAS_FULL[i]}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                        {esHoy && <span className="badge badge-blue">Hoy</span>}
                        {totalDia === 0 && <span style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 'auto' }}>Sin asignaciones</span>}
                      </div>
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
                                  {addingFor?.iso === iso && addingFor?.turno === t.key ? (
                                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px', border: `1.5px solid ${t.bgAct}66`, marginTop: t.lista.length > 0 ? 4 : 0 }}>
                                      <p style={{ fontSize: 11, fontWeight: 700, color: t.txt, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Persona</p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
                                        {personalDB.map(p => (
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
                                  ) : t.lista.length === 0 && (
                                    <button
                                      onClick={() => { setAddingFor({ iso, turno: t.key }); setAddPersonalId(''); setAddZonaId(zonaFiltro || '') }}
                                      style={{
                                        width: '100%', padding: '6px 0', borderRadius: 7,
                                        border: `1.5px dashed ${t.bgAct}88`,
                                        background: 'transparent', color: t.bgAct,
                                        fontWeight: 700, fontSize: 12, cursor: 'pointer',
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
                })
            }

            {filtroTurno && (
              <div style={{ marginTop: 4, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: filtroTurno === 'mañana' ? '#d97706' : '#6d28d9' }}>
                  {filtroTurno === 'mañana' ? '☀️ Mañana' : '🌙 Noche'}
                </span>
              </div>
            )}
          </div>

          {/* Botón confirmar patrón — solo visible cuando hay borradores */}
          {rangoPersonalizado && draftPatron.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #4c1d95)', borderRadius: 14, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 2 }}>
                  📋 {draftPatron.length} día{draftPatron.length !== 1 ? 's' : ''} de semana planificado{draftPatron.length !== 1 ? 's' : ''}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  {draftPatron.reduce((sum, d) => sum + d.isos.length, 0)} asignaciones en total
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={guardarPatronCompleto} style={{
                  flex: 1, padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: '#22c55e', color: '#fff', fontWeight: 800, fontSize: 14,
                  boxShadow: '0 4px 14px rgba(34,197,94,0.4)',
                }}>
                  ✓ Guardar todo el patrón
                </button>
                <button onClick={() => setDraftPatron([])} style={{
                  padding: '13px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13,
                }}>✕</button>
              </div>
            </div>
          )}

        </>}

        {/* ── Vista: En limpieza ── */}
        {vista === 'limpieza' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {asigs.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No hay personal asignado esta semana</p>
            ) : (() => {
              // Agrupar por día de semana
              const diasMap = {}
              asigs.forEach(a => {
                const dF = new Date(a.fecha + 'T12:00:00')
                const dJ = dF.getDay()
                const dI = dJ === 0 ? 6 : dJ - 1
                if (!diasMap[dI]) diasMap[dI] = { nombre: DIAS_FULL[dI], idx: dI, asigs: [] }
                diasMap[dI].asigs.push(a)
              })
              return Object.values(diasMap).sort((a, b) => a.idx - b.idx).map(dia => {
                // Agrupar por turno+persona dentro del día
                const personasMap = {}
                dia.asigs.forEach(a => {
                  const pKey = `${dia.idx}-${a.turno}-${a.personal_id}`
                  if (!personasMap[pKey]) personasMap[pKey] = { pKey, turno: a.turno, nombre: getNombre(a), asigs: [] }
                  personasMap[pKey].asigs.push(a)
                })
                const personas = Object.values(personasMap).sort((a, b) =>
                  (a.turno === 'mañana' ? 0 : 1) - (b.turno === 'mañana' ? 0 : 1) || a.nombre.localeCompare(b.nombre)
                )
                return (
                  <div key={dia.idx} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>{dia.nombre}</p>
                    {personas.map(persona => {
                      const isOpen = openPersonKey === persona.pKey
                      const tColor = persona.turno === 'mañana' ? '#d97706' : '#6d28d9'
                      const tBg    = persona.turno === 'mañana' ? '#fef3c7' : '#ede9fe'
                      return (
                        <div key={persona.pKey} style={{ marginBottom: 4 }}>
                          <button
                            onClick={() => setOpenPersonKey(isOpen ? null : persona.pKey)}
                            style={{
                              width: '100%', background: isOpen ? tBg : '#f8fafc',
                              borderRadius: isOpen ? '8px 8px 0 0' : 8,
                              padding: '8px 10px', border: 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 14 }}>{persona.turno === 'mañana' ? '☀️' : '🌙'}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{persona.nombre}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: tColor, background: tBg, padding: '2px 8px', borderRadius: 8 }}>
                                {persona.asigs.length} {persona.asigs.length === 1 ? 'día' : 'días'}
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>{isOpen ? '▲' : '▼'}</span>
                            </div>
                          </button>
                          {isOpen && (
                            <div style={{ background: tBg, borderRadius: '0 0 8px 8px', padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {[...persona.asigs].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(a => {
                                const dF2 = new Date(a.fecha + 'T12:00:00')
                                const dJ2 = dF2.getDay()
                                const dI2 = dJ2 === 0 ? 6 : dJ2 - 1
                                const dLabel = `${DIAS_CORTO[dI2]} ${dF2.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
                                return (
                                  <div key={a.id}>
                                    {editandoId === a.id ? (
                                      <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '2px solid #86efac', marginBottom: 2 }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>Editar asignación</p>
                                        <div style={{ marginBottom: 10 }}>
                                          <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Día</p>
                                          <input type="date" value={editForm.fecha} onChange={e => setEditForm(f => ({ ...f, fecha: e.target.value }))}
                                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #86efac', fontSize: 13, boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }} />
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
                                      <div style={{ background: '#fff', borderRadius: 7, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{dLabel}</span>
                                          {a.zona?.nombre && <span style={{ fontSize: 11, color: '#64748b' }}>· {a.zona.nombre}</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                          <button onClick={() => abrirEdicion(a)} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#15803d', fontWeight: 600 }}>✏️</button>
                                          <button onClick={() => eliminarAsig(a.id)} style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>✕</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            })()}
          </div>
        )}

        {/* ── Vista: Conteo semanal ── */}
        {vista === 'sinTarea' && (() => {
          const isosConteo = Array.from({ length: 7 }, (_, i) => fechaISO(addDays(semanaConteo, i)))
          const asigsConteo = store.getAsignacionesPorFechas(isosConteo)
          const domConteo = addDays(semanaConteo, 6)
          const turnosConfig = [
            { key: 'mañana', emoji: '☀️', label: 'Mañana', headerBg: '#d97706', rowBg: '#fef3c7' },
            { key: 'noche',  emoji: '🌙', label: 'Noche',  headerBg: '#6d28d9', rowBg: '#ede9fe' },
          ]
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>🧮 Conteo semanal</p>

              {/* Navegador de semana */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setSemanaConteo(d => addDays(d, -7))}
                  style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}>‹</button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {semanaConteo.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} — {domConteo.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <button onClick={() => setSemanaConteo(d => addDays(d, 7))}
                  style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}>›</button>
              </div>


              {/* Cards por turno */}
              {turnosConfig.map(turno => {
                const lista = [...asigsConteo.filter(a => a.turno === turno.key)]
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                if (lista.length === 0) return null
                return (
                  <div key={turno.key} style={{ background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                    <div style={{ background: turno.headerBg, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{turno.emoji}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{turno.label}</span>
                    </div>
                    {lista.reduce((groups, a) => {
                      const last = groups[groups.length - 1]
                      if (last && last.fecha === a.fecha) { last.asigs.push(a) }
                      else { groups.push({ fecha: a.fecha, asigs: [a] }) }
                      return groups
                    }, []).map(group => {
                      const dF = new Date(group.fecha + 'T12:00:00')
                      const dJ = dF.getDay()
                      const dI = dJ === 0 ? 6 : dJ - 1
                      const dLabel = `${DIAS_CORTO[dI]} ${dF.getDate()}`
                      return (
                        <div key={group.fecha}>
                          <div style={{ padding: '7px 16px', background: turno.rowBg, borderBottom: `1px solid ${turno.headerBg}33` }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{dLabel}</span>
                          </div>
                          {group.asigs.map(a => {
                            const nombre = personalMap[a.personal_id] || a.personalNombre || '—'
                            const completado = allRegistros.some(r => r.asignacion_id === a.id && r.completado === true)
                            return (
                              <div key={a.id} style={{
                                display: 'flex', alignItems: 'center',
                                padding: '10px 16px 10px 20px', borderBottom: `1px solid ${turno.rowBg}`,
                                background: completado ? '#f0fdf4' : '#fff',
                              }}>
                                <span style={{ flex: 1, fontSize: 13, color: completado ? '#15803d' : '#1e293b', fontWeight: completado ? 700 : 500 }}>
                                  {nombre.split(' ')[0]}
                                </span>
                                <span style={{
                                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                  border: completado ? 'none' : '2px solid #cbd5e1',
                                  background: completado ? '#22c55e' : '#f8fafc',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 13, color: '#fff', fontWeight: 800,
                                }}>{completado ? '✓' : ''}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {asigsConteo.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>Sin asignaciones esta semana</p>
              )}
            </div>
          )
        })()}

      </div>

      {/* Toast de éxito */}
      {guardadoOk && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 9999, background: '#22c55e', color: '#fff', borderRadius: 12,
          padding: '12px 24px', fontWeight: 700, fontSize: 14,
          boxShadow: '0 8px 24px rgba(34,197,94,0.5)',
          display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
        }}>
          ✓ Se guardó exitosamente
        </div>
      )}

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
