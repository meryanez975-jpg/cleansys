import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as store from '../data/store'

const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

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
  const [cardAbierta, setCardAbierta] = useState(null) // 'semana' | 'limpieza' | 'sinTarea'
  const diasRef = useRef(null)

  useEffect(() => { setTick(t => t + 1) }, [])

  const fechasSemana = Array.from({ length: 7 }, (_, i) => addDays(lunesBase, i))
  const fechasISO    = fechasSemana.map(fechaISO)
  const asigs        = store.getAsignacionesPorFechas(fechasISO) || (tick, [])
  const hoyISO       = fechaISO(new Date())

  const regs = (() => {
    try { return JSON.parse(localStorage.getItem('cleansys_registros') || '[]') } catch { return [] }
  })()

  const totalAsigs = asigs.length

  // personas únicas con tarea + conteo
  const personalConTarea = (() => {
    const mapa = {}
    asigs.forEach(a => {
      if (!a.personal?.id) return
      if (!mapa[a.personal.id]) mapa[a.personal.id] = { nombre: a.personal.nombre, count: 0 }
      mapa[a.personal.id].count++
    })
    return Object.values(mapa).sort((a, b) => b.count - a.count)
  })()

  // personas sin tarea
  const todoElPersonal = (() => {
    try { return JSON.parse(localStorage.getItem('cleansys_personal') || '[]') } catch { return [] }
  })()
  const idsConTarea = [...new Set(asigs.map(a => a.personal?.id).filter(Boolean))]
  const sinTarea = todoElPersonal.filter(p => !idsConTarea.includes(p.id))

  function toggleCard(nombre) {
    if (nombre === 'semana') {
      setCardAbierta(null)
      setTimeout(() => diasRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } else {
      setCardAbierta(v => v === nombre ? null : nombre)
    }
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

        {/* 3 tarjetas resumen */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {/* Semana */}
          <button onClick={() => toggleCard('semana')} style={{ flex: 1, background: '#dbeafe', borderRadius: 12, padding: '12px 10px', textAlign: 'center', border: 'none', cursor: 'pointer' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8' }}>{totalAsigs}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>📅 Semana ↓</p>
          </button>
          {/* En limpieza */}
          <button onClick={() => toggleCard('limpieza')} style={{ flex: 1, background: cardAbierta === 'limpieza' ? '#bbf7d0' : '#dcfce7', borderRadius: 12, padding: '12px 10px', textAlign: 'center', border: cardAbierta === 'limpieza' ? '2px solid #15803d' : '2px solid transparent', cursor: 'pointer' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#15803d' }}>{personalConTarea.length}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>🧹 En limpieza {cardAbierta === 'limpieza' ? '▲' : '▼'}</p>
          </button>
          {/* Sin tareas */}
          <button onClick={() => toggleCard('sinTarea')} style={{ flex: 1, background: cardAbierta === 'sinTarea' ? '#e2e8f0' : '#f1f5f9', borderRadius: 12, padding: '12px 10px', textAlign: 'center', border: cardAbierta === 'sinTarea' ? '2px solid #64748b' : '2px solid transparent', cursor: 'pointer' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#64748b' }}>{sinTarea.length}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>💤 Sin tareas {cardAbierta === 'sinTarea' ? '▲' : '▼'}</p>
          </button>
        </div>

        {/* Panel: En limpieza */}
        {cardAbierta === 'limpieza' && (
          <div style={{ background: '#dcfce7', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
            {personalConTarea.length === 0 ? (
              <p style={{ fontSize: 13, color: '#15803d' }}>No hay personal asignado esta semana</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {personalConTarea.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '7px 10px' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#14532d' }}>🧹 {p.nombre}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', background: '#bbf7d0', borderRadius: 6, padding: '2px 8px' }}>
                      {p.count} vez{p.count !== 1 ? 'es' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Panel: Sin tareas */}
        {cardAbierta === 'sinTarea' && (
          <div style={{ background: '#f1f5f9', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
            {sinTarea.length === 0 ? (
              <p style={{ fontSize: 13, color: '#64748b' }}>Todo el personal tiene tareas asignadas</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sinTarea.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '7px 10px' }}>
                    <span style={{ fontSize: 16 }}>💤</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#475569' }}>{p.nombre}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* Días */}
        <div ref={diasRef} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fechasSemana.map((fecha, i) => {
            const iso      = fechasISO[i]
            const esHoy    = iso === hoyISO
            const asigsDia = asigs.filter(a => a.fecha === iso)
            const completados  = asigsDia.filter(a => regs.some(r => r.asignacion_id === a.id && r.completado))
            const enProceso    = asigsDia.filter(a => regs.some(r => r.asignacion_id === a.id && r.hora_entrada && !r.completado))
            const sinRegistrar = asigsDia.filter(a => !regs.some(r => r.asignacion_id === a.id && r.hora_entrada))

            return (
              <div key={iso} className="card" style={{
                borderLeft: `4px solid ${esHoy ? 'var(--primary)' : 'var(--border)'}`,
                padding: '14px 16px',
                opacity: asigsDia.length === 0 ? 0.55 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: asigsDia.length > 0 ? 12 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: esHoy ? 'var(--primary-dark)' : 'var(--text)' }}>{DIAS_FULL[i]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                    {esHoy && <span className="badge badge-blue">Hoy</span>}
                  </div>
                  {asigsDia.length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{asigsDia.length} persona{asigsDia.length !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {asigsDia.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-light)' }}>Sin asignaciones</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {completados.length > 0 && <MiniTarjeta titulo="✅ Completados" items={completados} bg="#dcfce7" color="#15803d" />}
                    {enProceso.length > 0 && <MiniTarjeta titulo="🟡 En proceso" items={enProceso} bg="#fef9c3" color="#a16207" />}
                    {sinRegistrar.length > 0 && <MiniTarjeta titulo="⬜ Sin registrar" items={sinRegistrar} bg="#f1f5f9" color="#64748b" />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MiniTarjeta({ titulo, items, bg, color }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '8px 12px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{titulo}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 6, fontSize: 13, color: '#1e293b', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{a.personal?.nombre || '—'}</span>
            <span style={{ color: '#94a3b8' }}>→</span>
            <span>{a.zona?.nombre || '—'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color, background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '1px 6px' }}>
              {a.turno === 'mañana' ? '☀️' : '🌙'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
