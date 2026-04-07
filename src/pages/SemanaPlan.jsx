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
  }, [])

  const fechasSemana = Array.from({ length: 7 }, (_, i) => addDays(lunesBase, i))
  const fechasISO    = fechasSemana.map(fechaISO)
  const asigs        = store.getAsignacionesPorFechas(fechasISO) || (tick, [])
  const hoyISO       = fechaISO(new Date())

  function getNombre(a) {
    return personalMap[a.personal_id] || a.personalNombre || a.personal?.nombre || '—'
  }

  const totalAsigs   = asigs.length
  const totalManana  = asigs.filter(a => a.turno === 'mañana').length
  const totalNoche   = asigs.filter(a => a.turno === 'noche').length

  const personalConTarea = (() => {
    const mapa = {}
    asigs.forEach(a => {
      const id = a.personal_id
      if (!id) return
      const nombre = personalMap[id] || a.personalNombre || a.personal?.nombre || '—'
      const diaIdx = fechasISO.indexOf(a.fecha)
      const diaCorto = diaIdx >= 0 ? DIAS_CORTO[diaIdx] : '?'
      if (!mapa[id]) mapa[id] = { nombre, dias: [] }
      if (!mapa[id].dias.includes(diaCorto)) mapa[id].dias.push(diaCorto)
    })
    return Object.values(mapa).sort((a, b) => b.dias.length - a.dias.length)
  })()

  const todoElPersonal = (() => {
    try { return JSON.parse(localStorage.getItem('cleansys_personal') || '[]') } catch { return [] }
  })()
  const idsConTarea = [...new Set(asigs.map(a => a.personal?.id).filter(Boolean))]
  const sinTarea = todoElPersonal.filter(p => !idsConTarea.includes(p.id))

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
          <div style={{ flex: 1, background: '#dcfce7', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#15803d' }}>{personalConTarea.length}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>🧹 En limpieza</p>
          </div>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#64748b' }}>{sinTarea.length}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>💤 Sin tareas</p>
          </div>
        </div>

        {/* Nav semana */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20,
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

        {/* Tarjetas Mañana / Noche */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <div style={{ flex: 1, background: '#fef3c7', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{totalManana}</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>☀️ Mañana</p>
          </div>
          <div style={{ flex: 1, background: '#ede9fe', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#6d28d9' }}>{totalNoche}</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>🌙 Noche</p>
          </div>
        </div>

        {/* ── Días con columnas Mañana / Noche ── */}
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Semana
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {fechasSemana.map((fecha, i) => {
            const iso      = fechasISO[i]
            const esHoy    = iso === hoyISO
            const asigsDia = asigs.filter(a => a.fecha === iso)

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

        {/* ── En limpieza ── */}
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          En limpieza esta semana
        </p>
        {personalConTarea.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>No hay personal asignado</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {personalConTarea.map((p, i) => (
              <div key={i} className="card" style={{
                padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#14532d' }}>🧹 {p.nombre}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#15803d',
                  background: '#dcfce7', borderRadius: 8, padding: '3px 8px',
                }}>
                  {p.dias.join(' · ')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Sin tareas ── */}
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Sin tareas esta semana
        </p>
        {sinTarea.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Todo el personal tiene tareas</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {sinTarea.map((p, i) => (
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
