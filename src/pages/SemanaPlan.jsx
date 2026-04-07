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
  const [vista, setVista] = useState('semana') // 'semana' | 'limpieza' | 'sinTarea'
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

  const btnBase = { flex: 1, borderRadius: 12, padding: '14px 10px', textAlign: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }

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

        {/* 3 botones de navegación */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
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

        {/* ── Vista: Semana ── */}
        {vista === 'semana' && <>
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

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setFiltroTurno(filtroTurno === 'mañana' ? null : 'mañana')} style={{
              flex: 1, borderRadius: 10, padding: '10px 8px', textAlign: 'center', cursor: 'pointer', border: 'none',
              background: filtroTurno === 'mañana' ? '#d97706' : '#fef3c7',
              boxShadow: filtroTurno === 'mañana' ? '0 3px 10px rgba(217,119,6,0.4)' : 'none',
              transition: 'all 0.15s',
            }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: filtroTurno === 'mañana' ? '#fff' : '#d97706' }}>{totalManana}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: filtroTurno === 'mañana' ? '#fff' : '#92400e' }}>☀️ Mañana</p>
            </button>
            <button onClick={() => setFiltroTurno(filtroTurno === 'noche' ? null : 'noche')} style={{
              flex: 1, borderRadius: 10, padding: '10px 8px', textAlign: 'center', cursor: 'pointer', border: 'none',
              background: filtroTurno === 'noche' ? '#6d28d9' : '#ede9fe',
              boxShadow: filtroTurno === 'noche' ? '0 3px 10px rgba(109,40,217,0.4)' : 'none',
              transition: 'all 0.15s',
            }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: filtroTurno === 'noche' ? '#fff' : '#6d28d9' }}>{totalNoche}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: filtroTurno === 'noche' ? '#fff' : '#4c1d95' }}>🌙 Noche</p>
            </button>
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Semana</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
            {fechasSemana.map((fecha, i) => {
              const iso      = fechasISO[i]
              const esHoy    = iso === hoyISO
              const asigsDia = asigs.filter(a => a.fecha === iso && (!filtroTurno || a.turno === filtroTurno))
              return (
                <div key={iso} className="card" style={{
                  borderLeft: `4px solid ${esHoy ? 'var(--primary)' : 'var(--border)'}`,
                  padding: '12px 14px', opacity: asigsDia.length === 0 ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: asigsDia.length > 0 ? 10 : 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: esHoy ? 'var(--primary-dark)' : 'var(--text)' }}>{DIAS_FULL[i]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                    {esHoy && <span className="badge badge-blue">Hoy</span>}
                    {asigsDia.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 'auto' }}>Sin asignaciones</span>}
                  </div>
                  {asigsDia.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {asigsDia.map(a => (
                        <div key={a.id} style={{ background: '#f8fafc', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

        {/* ── Vista: En limpieza ── */}
        {vista === 'limpieza' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {personalConTarea.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No hay personal asignado esta semana</p>
            ) : personalConTarea.map((p, pi) => (
              <div key={pi} style={{ background: '#f0fdf4', borderRadius: 12, padding: '10px 12px', border: '1px solid #bbf7d0' }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#14532d', marginBottom: 6 }}>🧹 {p.nombre}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {p.asignaciones.map(a => (
                    <div key={a.id}>
                      {editandoId === a.id ? (
                        <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '2px solid #86efac' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>Editar asignación</p>

                          {/* Día */}
                          <div style={{ marginBottom: 10 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Día</p>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {fechasSemana.map((fecha, i) => {
                                const iso = fechasISO[i]
                                const activo = editForm.fecha === iso
                                return (
                                  <button key={iso} onClick={() => setEditForm(f => ({ ...f, fecha: iso }))}
                                    style={{
                                      flex: 1, minWidth: 36, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                      fontWeight: 700, fontSize: 11,
                                      background: activo ? '#0ea5e9' : '#e0f2fe',
                                      color: activo ? '#fff' : '#0369a1',
                                      boxShadow: activo ? '0 2px 8px rgba(14,165,233,0.4)' : 'none',
                                      transition: 'all 0.15s',
                                    }}
                                  >{DIAS_CORTO[i]}</button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Turno: botones toggle */}
                          <div style={{ marginBottom: 10 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Turno</p>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => setEditForm(f => ({ ...f, turno: 'mañana' }))}
                                style={{
                                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                                  background: editForm.turno === 'mañana' ? '#d97706' : '#fef3c7',
                                  color: editForm.turno === 'mañana' ? '#fff' : '#92400e',
                                  boxShadow: editForm.turno === 'mañana' ? '0 2px 8px rgba(217,119,6,0.4)' : 'none',
                                  transition: 'all 0.15s',
                                }}
                              >☀️ Mañana</button>
                              <button
                                onClick={() => setEditForm(f => ({ ...f, turno: 'noche' }))}
                                style={{
                                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                                  background: editForm.turno === 'noche' ? '#6d28d9' : '#ede9fe',
                                  color: editForm.turno === 'noche' ? '#fff' : '#4c1d95',
                                  boxShadow: editForm.turno === 'noche' ? '0 2px 8px rgba(109,40,217,0.4)' : 'none',
                                  transition: 'all 0.15s',
                                }}
                              >🌙 Noche</button>
                            </div>
                          </div>
                          {/* Zona: select desplegable */}
                          <div style={{ marginBottom: 10 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zona</p>
                            <select
                              value={editForm.zona_id}
                              onChange={e => setEditForm(f => ({ ...f, zona_id: e.target.value }))}
                              style={{
                                width: '100%', fontSize: 13, padding: '9px 12px',
                                borderRadius: 10, border: '2px solid #a78bfa',
                                background: 'linear-gradient(135deg, #ede9fe, #fdf4ff)',
                                color: '#5b21b6', fontWeight: 700, cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(167,139,250,0.25)',
                              }}
                            >
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
    </div>
  )
}
