import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as store from '../data/store'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function getLunesDeHoy() {
  const hoy = new Date()
  const dia = hoy.getDay() // 0=dom, 1=lun ...
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

  // Refrescar al montar (por si se agregaron asignaciones en otra pantalla)
  useEffect(() => { setTick(t => t + 1) }, [])

  const fechasSemana = Array.from({ length: 7 }, (_, i) => addDays(lunesBase, i))
  const fechasISO    = fechasSemana.map(fechaISO)
  // tick fuerza re-lectura del localStorage
  const asigs        = store.getAsignacionesPorFechas(fechasISO) || (tick, [])
  const hoyISO       = fechaISO(new Date())

  function semanaAnterior() {
    setLunesBase(d => addDays(d, -7))
  }
  function semanaSiguiente() {
    setLunesBase(d => addDays(d, 7))
  }

  const totalAsigs = asigs.length
  const totalCompletos = (() => {
    try {
      const regs = JSON.parse(localStorage.getItem('cleansys_registros') || '[]')
      const idsAsig = asigs.map(a => a.id)
      return regs.filter(r => idsAsig.includes(r.asignacion_id) && r.completado).length
    } catch { return 0 }
  })()

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

        {/* Nav semana */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20,
          boxShadow: 'var(--shadow)',
        }}>
          <button
            onClick={semanaAnterior}
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
            onClick={semanaSiguiente}
            style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}
          >›</button>
        </div>

        {/* Días */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fechasSemana.map((fecha, i) => {
            const iso       = fechasISO[i]
            const esHoy     = iso === hoyISO
            const asigsDia  = asigs.filter(a => a.fecha === iso)
            const manana    = asigsDia.filter(a => a.turno === 'mañana')
            const noche     = asigsDia.filter(a => a.turno === 'noche')

            return (
              <div
                key={iso}
                className="card"
                style={{
                  borderLeft: `4px solid ${esHoy ? 'var(--primary)' : 'var(--border)'}`,
                  padding: '14px 16px',
                  opacity: asigsDia.length === 0 ? 0.6 : 1,
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
                    {esHoy && (
                      <span className="badge badge-blue">Hoy</span>
                    )}
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
                    {manana.length > 0 && (
                      <TurnoBloque turno="mañana" items={manana} />
                    )}
                    {noche.length > 0 && (
                      <TurnoBloque turno="noche" items={noche} />
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

function TurnoBloque({ turno, items }) {
  const esManana = turno === 'mañana'
  return (
    <div style={{
      background: esManana ? 'var(--manana-bg)' : 'var(--noche-bg)',
      borderRadius: 8, padding: '8px 12px',
    }}>
      <p style={{
        fontSize: 11, fontWeight: 700,
        color: esManana ? 'var(--manana-badge)' : 'var(--noche-badge)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
      }}>
        {esManana ? '☀️ Mañana' : '🌙 Noche'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 6, fontSize: 13, color: 'var(--text)' }}>
            <span style={{ fontWeight: 600 }}>{a.personal?.nombre || '—'}</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span>{a.zona?.nombre || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
