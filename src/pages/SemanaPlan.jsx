import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as store from '../data/store'
import { supabase } from '../supabase/client'

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

export default function SemanaPlan() {
  const navigate = useNavigate()
  const [lunesBase, setLunesBase] = useState(getLunesDeHoy)
  const [tick, setTick] = useState(0)
  const [personalMap, setPersonalMap] = useState({})
  const [filtroTurno, setFiltroTurno] = useState(null)
  const [mostrarLimpieza, setMostrarLimpieza] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState({ zona_id: '', turno: '' })
  const [zonas, setZonas] = useState([])

  useEffect(() => { setTick(t => t + 1) }, [])

  useEffect(() => {
    supabase.from('com_personal').select('id, nombre').eq('activo', true)
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(p => { map[p.id] = p.nombre })
          setPersonalMap(map)
        }
      })
    setZonas(store.getZonas())
  }, [])

  const fechasSemana = Array.from({ length: 7 }, (_, i) => addDays(lunesBase, i))
  const fechasISO    = fechasSemana.map(fechaISO)
  const asigs        = store.getAsignacionesPorFechas(fechasISO) || (tick, [])
  const hoyISO       = fechaISO(new Date())

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

  const todoElPersonal = (() => {
    try { return JSON.parse(localStorage.getItem('cleansys_personal') || '[]') } catch { return [] }
  })()
  const idsConTarea = [...new Set(asigs.map(a => a.personal?.id).filter(Boolean))]
  const sinTarea = todoElPersonal.filter(p => !idsConTarea.includes(p.id))

  function abrirEdicion(a) {
    setEditandoId(a.id)
    setEditForm({ zona_id: a.zona_id || '', turno: a.turno || '' })
  }

  function guardarEdicion(id) {
    store.editAsignacion(id, { zona_id: editForm.zona_id, turno: editForm.turno })
    setEditandoId(null)
    setTick(t => t + 1)
  }

  function eliminarAsig(id) {
    store.removeAsignacion(id)
    setTick(t => t + 1)
  }

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Semana de trabajo</p>
            <p className="header-sub">{formatMes(lunesBase)}</p>
          </div>
        </div>

        {/* Resumen Semana / En limpieza / Sin tareas */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#dbeafe', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8' }}>{totalAsigs}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>📅 Semana</p>
          </div>
          <button
            onClick={() => setMostrarLimpieza(v => !v)}
            style={{
              flex: 1, borderRadius: 12, padding: '14px 10px', textAlign: 'center', border: 'none', cursor: 'pointer',
              background: mostrarLimpieza ? '#15803d' : '#dcfce7',
              boxShadow: mostrarLimpieza ? '0 3px 10px rgba(21,128,61,0.35)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <p style={{ fontSize: 22, fontWeight: 800, color: mostrarLimpieza ? '#fff' : '#15803d' }}>{personalConTarea.length}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: mostrarLimpieza ? '#fff' : '#15803d' }}>🧹 En limpieza</p>
          </button>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#64748b' }}>{sinTarea.length}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>💤 Sin tareas</p>
          </div>
        </div>

        {/* Lista desplegable En limpieza */}
        {mostrarLimpieza && (
          <div style={{ marginBottom: 16 }}>
            {personalConTarea.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                No hay personal asignado esta semana
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {personalConTarea.map((p, pi) => (
                  <div key={pi} style={{ background: '#f0fdf4', borderRadius: 12, padding: '10px 12px', border: '1px solid #bbf7d0' }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#14532d', marginBottom: 6 }}>🧹 {p.nombre}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {p.asignaciones.map(a => (
                        <div key={a.id}>
                          {editandoId === a.id ? (
                            <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', border: '1px solid #86efac' }}>
                              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                <select
                                  value={editForm.turno}
                                  onChange={e => setEditForm(f => ({ ...f, turno: e.target.value }))}
                                  style={{ flex: 1, fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db' }}
                                >
                                  <option value="mañana">Mañana</option>
                                  <option value="noche">Noche</option>
                                </select>
                                <select
                                  value={editForm.zona_id}
                                  onChange={e => setEditForm(f => ({ ...f, zona_id: e.target.value }))}
                                  style={{ flex: 1, fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db' }}
                                >
                                  <option value="">Sin zona</option>
                                  {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                                </select>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => guardarEdicion(a.id)} style={{ flex: 1, background: '#15803d', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
                                <button onClick={() => setEditandoId(null)} style={{ flex: 1, background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ background: '#dcfce7', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>
                                  {DIAS_FULL[fechasISO.indexOf(a.fecha)] || a.fecha}
                                </span>
                                <span style={{ fontSize: 11, color: '#15803d', marginLeft: 8 }}>
                                  {a.zona?.nombre || '—'} · {a.turno}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => abrirEdicion(a)} style={{ background: '#fff', border: '1px solid #86efac', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#15803d', fontWeight: 600 }}>✏️</button>
                                <button onClick={() => eliminarAsig(a.id)} style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>✕</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nav semana + filtros + días — se ocultan cuando está activo En limpieza */}
        {!mostrarLimpieza && <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 12,
            boxShadow: 'var(--shadow)',
          }}>
            <button onClick={() => setLunesBase(d => addDays(d, -7))}
              style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}>‹</button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                {fechasSemana[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                {' — '}
                {fechasSemana[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {totalAsigs} asignación{totalAsigs !== 1 ? 'es' : ''} · {personalConTarea.length} persona{personalConTarea.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={() => setLunesBase(d => addDays(d, 7))}
              style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}>›</button>
          </div>

          {/* Botones filtro Mañana / Noche */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => setFiltroTurno(filtroTurno === 'mañana' ? null : 'mañana')}
              style={{
                flex: 1, borderRadius: 10, padding: '10px 8px', textAlign: 'center', cursor: 'pointer', border: 'none',
                background: filtroTurno === 'mañana' ? '#d97706' : '#fef3c7',
                boxShadow: filtroTurno === 'mañana' ? '0 3px 10px rgba(217,119,6,0.4)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <p style={{ fontSize: 18, fontWeight: 800, color: filtroTurno === 'mañana' ? '#fff' : '#d97706' }}>{totalManana}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: filtroTurno === 'mañana' ? '#fff' : '#92400e' }}>☀️ Mañana</p>
            </button>
            <button
              onClick={() => setFiltroTurno(filtroTurno === 'noche' ? null : 'noche')}
              style={{
                flex: 1, borderRadius: 10, padding: '10px 8px', textAlign: 'center', cursor: 'pointer', border: 'none',
                background: filtroTurno === 'noche' ? '#6d28d9' : '#ede9fe',
                boxShadow: filtroTurno === 'noche' ? '0 3px 10px rgba(109,40,217,0.4)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <p style={{ fontSize: 18, fontWeight: 800, color: filtroTurno === 'noche' ? '#fff' : '#6d28d9' }}>{totalNoche}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: filtroTurno === 'noche' ? '#fff' : '#4c1d95' }}>🌙 Noche</p>
            </button>
          </div>

          {/* Días */}
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Semana
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
            {fechasSemana.map((fecha, i) => {
              const iso      = fechasISO[i]
              const esHoy    = iso === hoyISO
              const asigsDia = asigs.filter(a => a.fecha === iso && (!filtroTurno || a.turno === filtroTurno))

              return (
                <div key={iso} className="card" style={{
                  borderLeft: `4px solid ${esHoy ? 'var(--primary)' : 'var(--border)'}`,
                  padding: '12px 14px',
                  opacity: asigsDia.length === 0 ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: asigsDia.length > 0 ? 10 : 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: esHoy ? 'var(--primary-dark)' : 'var(--text)' }}>{DIAS_FULL[i]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                    {esHoy && <span className="badge badge-blue">Hoy</span>}
                    {asigsDia.length === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 'auto' }}>Sin asignaciones</span>
                    )}
                  </div>

                  {asigsDia.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {asigsDia.map(a => (
                        <div key={a.id} style={{
                          background: '#f8fafc', borderRadius: 6, padding: '6px 10px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{getNombre(a)}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.zona?.nombre || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>}

      </div>
    </div>
  )
}
