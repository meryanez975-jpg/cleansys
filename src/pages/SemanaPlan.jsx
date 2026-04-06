import { useState, useEffect } from 'react'
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

function fechaISO(date) {
  return date.toISOString().split('T')[0]
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatMes(date) {
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export default function SemanaPlan() {
  const navigate = useNavigate()
  const [lunesBase, setLunesBase] = useState(getLunesDeHoy)
  const [tick, setTick] = useState(0)

  useEffect(() => { setTick(t => t + 1) }, [])

  const fechasSemana = Array.from({ length: 7 }, (_, i) => addDays(lunesBase, i))
  const fechasISO    = fechasSemana.map(fechaISO)
  const asigs        = store.getAsignacionesPorFechas(fechasISO) || (tick, [])
  const hoyISO       = fechaISO(new Date())

  // registros de la semana
  const regs = (() => {
    try { return JSON.parse(localStorage.getItem('cleansys_registros') || '[]') } catch { return [] }
  })()

  const totalAsigs = asigs.length

  // personas únicas con tarea esta semana
  const idsConTarea = [...new Set(asigs.map(a => a.personal?.id).filter(Boolean))]

  // personas del sistema sin tarea esta semana
  const todoElPersonal = (() => {
    try { return JSON.parse(localStorage.getItem('cleansys_personal') || '[]') } catch { return [] }
  })()
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

        {/* 3 tarjetas resumen */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#dbeafe', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8' }}>{totalAsigs}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>📅 Semana</p>
          </div>
          <div style={{ flex: 1, background: '#dcfce7', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#15803d' }}>{idsConTarea.length}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>🧹 En limpieza</p>
          </div>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
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
          <button
            onClick={() => setLunesBase(d => addDays(d, -7))}
            style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}
          >‹</button>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              {fechasSemana[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
              {' — '}
              {fechasSemana[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {totalAsigs} asignación{totalAsigs !== 1 ? 'es' : ''} · {totalCompletos} completada{totalCompletos !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={() => setLunesBase(d => addDays(d, 7))}
            style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}
          >›</button>
        </div>

        {/* Días */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fechasSemana.map((fecha, i) => {
            const iso      = fechasISO[i]
            const esHoy    = iso === hoyISO
            const asigsDia = asigs.filter(a => a.fecha === iso)

            // clasificar
            const completados   = asigsDia.filter(a => regs.some(r => r.asignacion_id === a.id && r.completado))
            const enProceso     = asigsDia.filter(a => regs.some(r => r.asignacion_id === a.id && r.hora_entrada && !r.completado))
            const sinRegistrar  = asigsDia.filter(a => !regs.some(r => r.asignacion_id === a.id && r.hora_entrada))

            return (
              <div
                key={iso}
                className="card"
                style={{
                  borderLeft: `4px solid ${esHoy ? 'var(--primary)' : 'var(--border)'}`,
                  padding: '14px 16px',
                  opacity: asigsDia.length === 0 ? 0.55 : 1,
                }}
              >
                {/* Cabecera día */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: asigsDia.length > 0 ? 12 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: esHoy ? 'var(--primary-dark)' : 'var(--text)' }}>
                      {DIAS_FULL[i]}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                    {esHoy && <span className="badge badge-blue">Hoy</span>}
                  </div>
                  {asigsDia.length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {asigsDia.length} persona{asigsDia.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {asigsDia.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-light)' }}>Sin asignaciones</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {/* Tarjeta 1: Completados */}
                    {completados.length > 0 && (
                      <MiniTarjeta
                        titulo="✅ Completados"
                        items={completados}
                        bg="#dcfce7" color="#15803d"
                      />
                    )}

                    {/* Tarjeta 2: En proceso */}
                    {enProceso.length > 0 && (
                      <MiniTarjeta
                        titulo="🟡 En proceso"
                        items={enProceso}
                        bg="#fef9c3" color="#a16207"
                      />
                    )}

                    {/* Tarjeta 3: Sin registrar */}
                    {sinRegistrar.length > 0 && (
                      <MiniTarjeta
                        titulo="⬜ Sin registrar"
                        items={sinRegistrar}
                        bg="#f1f5f9" color="#64748b"
                      />
                    )}

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
      <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {titulo}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 6, fontSize: 13, color: '#1e293b', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{a.personal?.nombre || '—'}</span>
            <span style={{ color: '#94a3b8' }}>→</span>
            <span>{a.zona?.nombre || '—'}</span>
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 600,
              color, background: 'rgba(255,255,255,0.6)',
              borderRadius: 6, padding: '1px 6px',
            }}>
              {a.turno === 'mañana' ? '☀️' : '🌙'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
