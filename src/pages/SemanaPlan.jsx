import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as store from '../data/store'
import { supabase } from '../supabase/client'
import html2canvas from 'html2canvas'
import MenuDrawer from '../components/MenuDrawer'
import ZonaModal from '../components/ZonaModal'
import PersonalModal from '../components/PersonalModal'
import ModalConfirmSalida from '../components/ModalConfirmSalida'
import { useZonas } from '../hooks/useZonas'
import { usePersonal } from '../hooks/usePersonal'
import { usePersonalComidas } from '../hooks/usePersonalComidas'
import { pullFromSupabase, pushToSupabase } from '../hooks/useAsignaciones'
import { pullRegistros } from '../hooks/useRegistros'

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

const DIAS_NORM = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
function genId() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36) }
function normStr(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() }
function esDiaLibre(persona, diaIdx) {
  if (!persona.diaLibre) return false
  return normStr(persona.diaLibre) === DIAS_NORM[diaIdx]
}
function diaIdxDeISO(iso) {
  const d = new Date(iso + 'T12:00:00')
  const dow = d.getDay()
  return dow === 0 ? 6 : dow - 1
}

export default function SemanaPlan() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
  const [zonaFiltro, setZonaFiltro] = useState(() => searchParams.get('zona') || null)
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
  const [swapPersonaKey, setSwapPersonaKey] = useState(null)
  const [swapPersonalId, setSwapPersonalId] = useState('')
  const [draftPatron, setDraftPatron] = useState([])
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [guardandoPatron, setGuardandoPatron] = useState(false)
  const [errorPatron, setErrorPatron] = useState('')
  const [confirmSalida, setConfirmSalida] = useState(null) // acción pendiente o null
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

  // Sincronizar asignaciones y registros desde Supabase al abrir la app
  useEffect(() => {
    Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1))
  }, [])

  // Auto-refresh Conteo cada 30s para ver completados en tiempo real
  useEffect(() => {
    const id = setInterval(() => {
      Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1))
    }, 30000)
    return () => clearInterval(id)
  }, [])

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

  // Detectar personas inactivas con asignaciones futuras
  useEffect(() => {
    async function checkInactivos() {
      const hoyISO = fechaISO(new Date())
      const { data: todos } = await supabase.from('com_personal').select('id, nombre, activo')
      if (!todos) return
      const inactivosIds = todos.filter(p => !p.activo).map(p => p.id)
      if (inactivosIds.length === 0) return
      const { data: futuras } = await supabase
        .from('limpieza_asignaciones')
        .select('id, personal_id, fecha, turno, zona_id')
        .gte('fecha', hoyISO)
        .eq('activo', true)
        .in('personal_id', inactivosIds)
      if (!futuras || futuras.length === 0) return
      const porPersona = {}
      futuras.forEach(a => {
        if (!porPersona[a.personal_id]) {
          const p = todos.find(x => x.id === a.personal_id)
          porPersona[a.personal_id] = { nombre: p?.nombre || '?', asigs: [] }
        }
        porPersona[a.personal_id].asigs.push(a)
      })
      setAlertasInactivos(Object.values(porPersona))
    }
    checkInactivos()
  }, [])

  const { zonas, crearZona, editarZona, desactivarZona } = useZonas()
  const { personal, refetch: refetchPersonal } = usePersonal()
  const [alertasInactivos, setAlertasInactivos] = useState([])
  const { personal: personalDB } = usePersonalComidas(null)

  useEffect(() => {
    supabase.from('com_personal').select('id, nombre').eq('activo', true)
      .then(({ data, error }) => {
        if (error) { console.error('SemanaPlan personal:', error); return }
        if (data) {
          const map = {}
          data.forEach(p => { map[p.id] = p.nombre })
          setPersonalMap(map)
        }
      })
      .catch(err => console.error('SemanaPlan personal:', err))
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
  const allRegistros = (() => { void tick; try { return JSON.parse(localStorage.getItem('cleansys_registros') || '[]') } catch { return [] } })()
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
    setConfirmSalida(() => accion)
  }

  function abrirEdicion(a) {
    setEditandoId(a.id)
    setEditForm({ zona_id: a.zona_id || '', turno: a.turno || '', fecha: a.fecha || '', personal_id: a.personal_id || '' })
  }

  async function guardarEdicion(id) {
    const p = personalDB.find(x => x.id === editForm.personal_id)
    const datos = {
      zona_id:        editForm.zona_id,
      turno:          editForm.turno,
      fecha:          editForm.fecha,
      personal_id:    editForm.personal_id,
      personalNombre: p?.nombre || '',
      personalSector: p?.sector || '',
    }
    const { error } = await supabase.from('limpieza_asignaciones').update(datos).eq('id', id)
    if (error) { console.error('guardarEdicion error:', error); return }
    store.editAsignacion(id, datos)
    setEditandoId(null)
    setTick(t => t + 1)
  }

  async function swapPersona(asigs, newPersonalId) {
    const p = personalDB.find(x => x.id === newPersonalId)
    if (!p) return
    const datos = { personal_id: newPersonalId, personalNombre: p.nombre, personalSector: p.sector || '' }
    const { error } = await supabase.from('limpieza_asignaciones')
      .update(datos)
      .in('id', asigs.map(a => a.id))
    if (error) { console.error('swapPersona error:', error); return }
    asigs.forEach(a => store.editAsignacion(a.id, datos))
    setSwapPersonaKey(null)
    setSwapPersonalId('')
    setTick(t => t + 1)
  }

  async function eliminarAsig(id) {
    const { error } = await supabase.from('limpieza_asignaciones').update({ activo: false }).eq('id', id)
    if (error) { console.error('eliminarAsig error:', error); return }
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

  async function guardarPatronCompleto() {
    setErrorPatron('')
    const cached = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
    const rows = []
    draftPatron.forEach(d => {
      const p = personalDB.find(x => x.id === d.personalId)
      d.isos.forEach(iso => {
        const yaExiste = cached.find(a =>
          a.personal_id === d.personalId && a.turno === d.turno && a.fecha === iso && a.activo !== false
        )
        if (!yaExiste) {
          rows.push({
            id: genId(),
            personal_id: d.personalId,
            zona_id: d.zonaId || null,
            turno: d.turno,
            fecha: iso,
            personalNombre: p?.nombre || d.nombre || '',
            personalSector: p?.sector || '',
            activo: true,
          })
        }
      })
    })

    if (rows.length === 0) {
      setDraftPatron([])
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 3000)
      return
    }

    setGuardandoPatron(true)
    const { error } = await supabase.from('limpieza_asignaciones').upsert(rows, { onConflict: 'personal_id,fecha,turno' })
    setGuardandoPatron(false)

    if (error) {
      console.error('guardarPatron error:', error)
      setErrorPatron('Error al guardar: ' + (error.message || 'intenta de nuevo'))
      return
    }

    localStorage.setItem('cleansys_asignaciones', JSON.stringify([
      ...cached, ...rows.filter(r => !cached.some(c => c.id === r.id)),
    ]))
    setDraftPatron([])
    setTick(t => t + 1)
    setGuardadoOk(true)
    setTimeout(() => setGuardadoOk(false), 3000)
  }

  async function handleAddAsignacion() {
    if (!addPersonalId || !addingFor) return
    const p = personalDB.find(x => x.id === addPersonalId)
    const zona = addZonaId || zonaFiltro || ''
    const isos = addingFor.isos || [addingFor.iso]

    const cached = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
    const rows = []
    isos.forEach(iso => {
      const yaExiste = cached.find(a =>
        a.personal_id === addPersonalId && a.turno === addingFor.turno && a.fecha === iso && a.activo !== false
      )
      if (!yaExiste) {
        rows.push({
          id: genId(),
          personal_id: addPersonalId,
          zona_id: zona || null,
          turno: addingFor.turno,
          fecha: iso,
          personalNombre: p?.nombre || '',
          personalSector: p?.sector || '',
          activo: true,
        })
      }
    })

    if (rows.length > 0) {
      const { error } = await supabase.from('limpieza_asignaciones').upsert(rows, { onConflict: 'personal_id,fecha,turno' })
      if (error) { console.error('handleAddAsignacion error:', error); return }
      localStorage.setItem('cleansys_asignaciones', JSON.stringify([
        ...cached, ...rows.filter(r => !cached.some(c => c.id === r.id)),
      ]))
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
    <div className="page" style={vista === 'inicio' ? {
      background: 'linear-gradient(160deg, #1e3a8a 0%, #3b82f6 40%, #7c3aed 100%)',
      minHeight: '100vh',
    } : {}}>
      <div className="container">

        {/* Header */}
        <div className="header">
          <button
            onClick={() => confirmarSiHayDraft(() => setShowMenu(true))}
            style={{
              background: vista === 'inicio' ? 'rgba(255,255,255,0.15)' : 'var(--primary-light)',
              border: 'none',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ display: 'block', width: 18, height: 2, background: vista === 'inicio' ? '#fff' : 'var(--primary-dark)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: vista === 'inicio' ? '#fff' : 'var(--primary-dark)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: vista === 'inicio' ? '#fff' : 'var(--primary-dark)', borderRadius: 2 }} />
          </button>
          <div style={{ flex: 1 }}>
            <p className="header-title" style={vista === 'inicio' ? { color: '#fff' } : {}}>
              {zonaFiltro ? (zonas.find(z => z.id === zonaFiltro)?.nombre ?? 'Semana de trabajo') : 'Semana de trabajo'}
            </p>
            <p className="header-sub" style={vista === 'inicio' ? { color: 'rgba(255,255,255,0.7)' } : {}}>
              Hoy, {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* ── Vista: Inicio / Bienvenida ── */}
        {vista === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Tarjeta principal de bienvenida */}
            <div style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(12px)',
              borderRadius: 'var(--radius)',
              padding: '24px 20px',
              color: '#fff',
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
              <div style={{ marginTop: 16 }}>
                {asigHoy.length === 0 ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 14px',
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>💤 Sin asignaciones para hoy</p>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, marginBottom: 8 }}>
                      📋 {asigHoy.length} asignación{asigHoy.length !== 1 ? 'es' : ''} para hoy
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{
                        flex: 1, borderRadius: 12, padding: '12px 14px',
                        background: 'rgba(251,191,36,0.22)',
                        border: '1.5px solid rgba(251,191,36,0.45)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ fontSize: 22 }}>☀️</span>
                        <div>
                          <p style={{ fontSize: 22, fontWeight: 800, color: '#fef9c3', lineHeight: 1 }}>{asigHoyManana}</p>
                          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Mañana</p>
                        </div>
                      </div>
                      <div style={{
                        flex: 1, borderRadius: 12, padding: '12px 14px',
                        background: 'rgba(99,102,241,0.30)',
                        border: '1.5px solid rgba(129,140,248,0.45)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ fontSize: 22 }}>🌙</span>
                        <div>
                          <p style={{ fontSize: 22, fontWeight: 800, color: '#e0e7ff', lineHeight: 1 }}>{asigHoyNoche}</p>
                          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Noche</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>


            {/* Alertas de personal inactivo */}
            {alertasInactivos.map(({ nombre, asigs }) => (
              <div key={nombre} style={{
                background: '#fff7ed',
                border: '2px solid #f97316',
                borderRadius: 14, padding: '14px 16px',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>⚠️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#9a3412', marginBottom: 4 }}>
                    {nombre} ya no está disponible
                  </p>
                  <p style={{ fontSize: 13, color: '#c2410c', lineHeight: 1.5 }}>
                    Tiene <strong>{asigs.length} turno{asigs.length !== 1 ? 's' : ''}</strong> próximo{asigs.length !== 1 ? 's' : ''} sin cubrir. Reasignalo antes de esas fechas.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {asigs.slice(0, 5).map(a => (
                      <span key={a.id} style={{
                        background: '#fed7aa', borderRadius: 8,
                        padding: '3px 9px', fontSize: 11, fontWeight: 600, color: '#9a3412',
                      }}>
                        {new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} · {a.turno}
                      </span>
                    ))}
                    {asigs.length > 5 && (
                      <span style={{ fontSize: 11, color: '#c2410c', fontWeight: 600 }}>+{asigs.length - 5} más</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

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
                  const hoy = new Date()
                  const primeroDeMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
                  setInputInicio(primeroDeMes)
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
                    const inicio = new Date(inputInicio + 'T12:00:00')
                    const fin = new Date(inputFin + 'T12:00:00')
                    if (inicio > fin) return
                    setRangoPersonalizado({ inicio, fin })
                    setShowDatePicker(false)
                  }}
                  disabled={!inputInicio || !inputFin}
                  style={{
                    width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: inputInicio && inputFin ? 'var(--primary)' : '#cbd5e1',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                  }}
                >
                  Aplicar
                </button>
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
                                  ) : lista.length > 0 ? (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: abierto ? 'rgba(255,255,255,0.25)' : t.bgAct, color: '#fff' }}>{lista.length}</span>
                                  ) : (
                                    <span style={{ fontSize: 14, fontWeight: 800, padding: '1px 8px', borderRadius: 10, background: abierto ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.35)', color: abierto ? '#fff' : t.txt, border: `1.5px dashed ${t.bgAct}88` }}>+</span>
                                  )}
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
                                  {draft && (
                                    <div style={{ background: '#fef9c3', borderRadius: 7, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1.5px dashed #d97706' }}>
                                      <span style={{ fontSize: 13, fontWeight: 600, color: '#78350f' }}>{draft.nombre}</span>
                                      <button onClick={() => setDraftPatron(prev => prev.filter(d => !(d.patKey === draft.patKey && d.turno === draft.turno)))}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 13, fontWeight: 700, padding: '0 4px' }}>✕</button>
                                    </div>
                                  )}
                                  {addingFor?.patKey === 'pat-' + i && addingFor?.turno === t.key ? (
                                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px', border: `1.5px solid ${t.bgAct}66`, marginTop: lista.length > 0 ? 4 : 0 }}>
                                      <p style={{ fontSize: 11, fontWeight: 700, color: t.txt, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Elegir persona</p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                                        {personalDB.filter(p => !esDiaLibre(p, i)).map(p => (
                                          <button key={p.id} onClick={() => {
                                            setDraftPatron(prev => {
                                              const filtrado = prev.filter(d => !(d.patKey === 'pat-' + i && d.turno === addingFor.turno))
                                              return [...filtrado, { patKey: 'pat-' + i, isos: addingFor.isos, turno: addingFor.turno, personalId: p.id, nombre: p.nombre || '', zonaId: zonaFiltro || '' }]
                                            })
                                            setAddingFor(null)
                                            setAddPersonalId('')
                                            setAddZonaId('')
                                            setTurnosAbiertos(prev => ({ ...prev, ['pat-' + i]: null }))
                                          }} style={{ padding: '8px 12px', borderRadius: 8, textAlign: 'left', border: '2px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.12s' }}>
                                            {p.nombre}
                                          </button>
                                        ))}
                                      </div>
                                      <button onClick={() => { setAddingFor(null); setAddPersonalId(''); setAddZonaId('') }} style={{ marginTop: 8, width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✕ Cancelar</button>
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
                                        {personalDB.filter(p => !esDiaLibre(p, diaIdxDeISO(iso))).map(p => (
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

          {/* Botón confirmar patrón — espacio reservado para que el fijo no tape contenido */}
          {rangoPersonalizado && draftPatron.length > 0 && <div style={{ height: 80 }} />}

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
                      const swapOpen = swapPersonaKey === persona.pKey
                      return (
                        <div key={persona.pKey} style={{ marginBottom: 4 }}>
                          {/* Encabezado de la persona */}
                          <div style={{
                            background: isOpen ? tBg : '#f8fafc',
                            borderRadius: isOpen ? '8px 8px 0 0' : 8,
                            display: 'flex', alignItems: 'center',
                            border: 'none', overflow: 'hidden',
                          }}>
                            <button
                              onClick={() => { setOpenPersonKey(isOpen ? null : persona.pKey); setSwapPersonaKey(null); setSwapPersonalId('') }}
                              style={{ flex: 1, background: 'transparent', border: 'none', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                            >
                              <span style={{ fontSize: 14 }}>{persona.turno === 'mañana' ? '☀️' : '🌙'}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{persona.nombre}</span>
                            </button>
                            {/* Botón editar persona — al lado del nombre */}
                            <button
                              onClick={e => { e.stopPropagation(); setOpenPersonKey(persona.pKey); setSwapPersonaKey(swapOpen ? null : persona.pKey); setSwapPersonalId('') }}
                              title="Cambiar persona"
                              style={{ background: swapOpen ? tColor : 'transparent', border: 'none', padding: '8px 10px', cursor: 'pointer', fontSize: 13, color: swapOpen ? '#fff' : tColor, fontWeight: 700, flexShrink: 0, transition: 'all 0.15s', borderRadius: 6 }}
                            >✏️</button>
                            <button
                              onClick={() => { setOpenPersonKey(isOpen ? null : persona.pKey); setSwapPersonaKey(null); setSwapPersonalId('') }}
                              style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                              <span style={{ fontSize: 11, fontWeight: 700, color: tColor, background: tBg, padding: '2px 8px', borderRadius: 8 }}>
                                {persona.asigs.length} {persona.asigs.length === 1 ? 'día' : 'días'}
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>{isOpen ? '▲' : '▼'}</span>
                            </button>
                          </div>

                          {isOpen && (
                            <div style={{ background: tBg, borderRadius: '0 0 8px 8px', padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>

                              {/* Selector de reemplazo — solo visible cuando se abre el ✏️ */}
                              {swapOpen && (
                                <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: `2px solid ${tColor}`, marginBottom: 4 }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: tColor, marginBottom: 8 }}>Cambiar persona en todos los días</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto', marginBottom: 8 }}>
                                    {personalDB.map(p => {
                                      const sel = swapPersonalId === p.id
                                      return (
                                        <button key={p.id} onClick={() => setSwapPersonalId(p.id)}
                                          style={{ padding: '7px 10px', borderRadius: 7, textAlign: 'left', border: `2px solid ${sel ? tColor : '#e2e8f0'}`, background: sel ? tBg : '#f8fafc', color: sel ? tColor : '#475569', fontWeight: sel ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.12s' }}>
                                          {sel ? '✓ ' : ''}{p.nombre}
                                        </button>
                                      )
                                    })}
                                  </div>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => swapPersona(persona.asigs, swapPersonalId)} disabled={!swapPersonalId}
                                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: swapPersonalId ? 'pointer' : 'not-allowed', background: swapPersonalId ? tColor : '#cbd5e1', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                                      ✓ Guardar cambio
                                    </button>
                                    <button onClick={() => { setSwapPersonaKey(null); setSwapPersonalId('') }}
                                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✕</button>
                                  </div>
                                </div>
                              )}

                              {[...persona.asigs].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(a => {
                                const dF2 = new Date(a.fecha + 'T12:00:00')
                                const dJ2 = dF2.getDay()
                                const dI2 = dJ2 === 0 ? 6 : dJ2 - 1
                                const dLabel = `${DIAS_CORTO[dI2]} ${dF2.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
                                return (
                                  <div key={a.id}>
                                    <div style={{ background: '#fff', borderRadius: 7, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{dLabel}</span>
                                      {a.zona?.nombre && <span style={{ fontSize: 11, color: '#64748b' }}>· {a.zona.nombre}</span>}
                                    </div>
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


              {/* Cards por turno — siempre 7 días */}
              {turnosConfig.map(turno => (
                <div key={turno.key} style={{ background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                  <div style={{ background: turno.headerBg, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{turno.emoji}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{turno.label}</span>
                  </div>
                  {isosConteo.map((iso, idx) => {
                    const dF2 = addDays(semanaConteo, idx)
                    const dJ2 = dF2.getDay()
                    const dI2 = dJ2 === 0 ? 6 : dJ2 - 1
                    const dLabel = `${DIAS_CORTO[dI2]} ${dF2.getDate()}`
                    const esHoy = iso === hoyISO
                    const asigsDia = asigsConteo.filter(a => a.fecha === iso && a.turno === turno.key)

                    if (asigsDia.length === 0) {
                      return (
                        <div key={iso} style={{
                          display: 'flex', alignItems: 'center',
                          padding: '11px 16px', borderBottom: `1px solid ${turno.rowBg}`,
                          background: esHoy ? '#f0f9ff' : '#fafafa',
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: esHoy ? '#3b82f6' : '#94a3b8', width: 50, flexShrink: 0 }}>{dLabel}</span>
                          <span style={{ flex: 1, fontSize: 12, color: '#cbd5e1', paddingLeft: 8, fontStyle: 'italic' }}>Sin asignar</span>
                          <span style={{ width: 22, height: 22, borderRadius: 6, border: '1.5px dashed #e2e8f0', flexShrink: 0 }} />
                        </div>
                      )
                    }

                    const a = asigsDia[0]
                    const nombre = a.personalNombre || personalMap[a.personal_id] || '—'
                    const reg = allRegistros.find(r => r.asignacion_id === a.id)
                    const completado = reg?.completado === true
                    const empezado = reg?.hora_entrada && !reg?.completado
                    const estadoBg = completado ? '#f0fdf4' : empezado ? '#fff5f5' : esHoy ? '#f0f9ff' : '#fff'
                    return (
                      <div key={iso + '-' + turno.key} style={{
                        display: 'flex', alignItems: 'center',
                        padding: '11px 16px', borderBottom: `1px solid ${turno.rowBg}`,
                        background: estadoBg,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: esHoy ? '#3b82f6' : '#64748b', width: 50, flexShrink: 0 }}>{dLabel}</span>
                        <span style={{ flex: 1, fontSize: 13, color: completado ? '#15803d' : empezado ? '#dc2626' : '#1e293b', fontWeight: completado || empezado ? 700 : 500, paddingLeft: 8 }}>
                          {nombre.split(' ')[0]}
                        </span>
                        {completado ? (
                          <span style={{ width: 24, height: 24, borderRadius: 6, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 800, flexShrink: 0 }}>✓</span>
                        ) : empezado ? (
                          <span style={{ width: 24, height: 24, borderRadius: 6, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#dc2626', fontWeight: 800, flexShrink: 0 }}>✗</span>
                        ) : esHoy ? (
                          <span style={{ width: 24, height: 24, borderRadius: 6, border: '2px solid #cbd5e1', background: '#f8fafc', flexShrink: 0 }} />
                        ) : (
                          <span style={{ fontSize: 14, color: '#cbd5e1', flexShrink: 0, width: 24, textAlign: 'center' }}>—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })()}

      </div>

      {/* Botón guardar patrón — fijo al fondo, siempre visible cuando hay borrador */}
      {vista === 'semana' && rangoPersonalizado && draftPatron.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 16px 20px',
          background: 'linear-gradient(to top, #0f172a 60%, transparent)',
          zIndex: 500,
        }}>
          {errorPatron && (
            <div style={{
              maxWidth: 480, margin: '0 auto 8px', background: '#fee2e2', color: '#dc2626',
              borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}>
              ⚠ {errorPatron}
            </div>
          )}
          <button
            onClick={guardarPatronCompleto}
            disabled={guardandoPatron}
            style={{
              width: '100%', maxWidth: 480, margin: '0 auto', display: 'block',
              padding: '15px 0', borderRadius: 14, border: 'none',
              cursor: guardandoPatron ? 'not-allowed' : 'pointer',
              background: guardandoPatron
                ? 'linear-gradient(135deg, #86efac, #4ade80)'
                : 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff', fontWeight: 800, fontSize: 15,
              boxShadow: '0 4px 20px rgba(34,197,94,0.5)',
              opacity: guardandoPatron ? 0.8 : 1,
            }}
          >
            {guardandoPatron
              ? '⏳ Guardando...'
              : `✓ Guardar ${draftPatron.reduce((s, d) => s + d.isos.length, 0)} asignaciones`}
          </button>
        </div>
      )}

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
          onIr={path => { setShowMenu(false); confirmarSiHayDraft(() => navigate(path)) }}
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


      {confirmSalida && (
        <ModalConfirmSalida
          onConfirmar={() => { setDraftPatron([]); confirmSalida(); setConfirmSalida(null) }}
          onCancelar={() => setConfirmSalida(null)}
        />
      )}
    </div>
  )
}
