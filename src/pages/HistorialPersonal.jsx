import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersonal } from '../hooks/usePersonal'
import * as store from '../data/store'

function mesActualStr() {
  return new Date().toISOString().slice(0, 7)
}

function addMes(mes, delta) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMesLargo(mes) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

function formatFecha(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function HistorialPersonal() {
  const navigate   = useNavigate()
  const { personal } = usePersonal()
  const [mes, setMes]           = useState(mesActualStr)
  const [selId, setSelId]       = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const personalFiltrado = personal.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const asigsSel = selId
    ? store.getAsignacionesPorPersonalYMes(selId, mes)
    : []

  const personaSel = personal.find(p => p.id === selId)

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Historial del personal</p>
            <p className="header-sub" style={{ textTransform: 'capitalize' }}>{formatMesLargo(mes)}</p>
          </div>
        </div>

        {/* Selector de mes */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 16,
          boxShadow: 'var(--shadow)',
        }}>
          <button
            onClick={() => { setMes(m => addMes(m, -1)); setSelId(null) }}
            style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}
          >‹</button>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', textTransform: 'capitalize' }}>
            {formatMesLargo(mes)}
          </span>
          <button
            onClick={() => { setMes(m => addMes(m, 1)); setSelId(null) }}
            style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 16 }}
          >›</button>
        </div>

        {/* Buscador */}
        <input
          className="input"
          placeholder="Buscar persona..."
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setSelId(null) }}
          style={{ marginBottom: 12 }}
        />

        {/* Lista de personal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {personalFiltrado.length === 0 && (
            <p className="text-muted text-center" style={{ padding: 20 }}>Sin resultados</p>
          )}

          {personalFiltrado.map(p => {
            const asigs    = store.getAsignacionesPorPersonalYMes(p.id, mes)
            const cantidad = asigs.length
            const abierto  = selId === p.id

            return (
              <div key={p.id}>
                <button
                  onClick={() => setSelId(abierto ? null : p.id)}
                  style={{
                    width: '100%', background: abierto ? 'var(--primary)' : 'var(--bg-card)',
                    border: `1.5px solid ${abierto ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: abierto ? '10px 10px 0 0' : 10,
                    padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    boxShadow: 'var(--shadow)', transition: 'all 0.15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: abierto ? 'rgba(255,255,255,0.2)' : 'var(--primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 15,
                    color: abierto ? '#fff' : 'var(--primary-dark)',
                  }}>
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: abierto ? '#fff' : 'var(--text)' }}>
                      {p.nombre}
                    </p>
                    {p.sector && (
                      <p style={{ fontSize: 12, color: abierto ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                        {p.sector}
                      </p>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, fontSize: 20, color: abierto ? '#fff' : (cantidad > 0 ? 'var(--primary)' : 'var(--text-light)') }}>
                      {cantidad}
                    </p>
                    <p style={{ fontSize: 11, color: abierto ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                      vez{cantidad !== 1 ? 'es' : ''}
                    </p>
                  </div>

                  <span style={{ color: abierto ? '#fff' : 'var(--text-muted)', fontSize: 14 }}>
                    {abierto ? '▲' : '▼'}
                  </span>
                </button>

                {/* Detalle expandido */}
                {abierto && (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1.5px solid var(--primary)',
                    borderTop: 'none',
                    borderRadius: '0 0 10px 10px',
                    padding: '12px 16px',
                  }}>
                    {asigsSel.length === 0 ? (
                      <p className="text-muted" style={{ textAlign: 'center', padding: '12px 0' }}>
                        Sin limpieza asignada este mes
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                          {cantidad} limpieza{cantidad !== 1 ? 's' : ''} en {formatMesLargo(mes).split(' ')[0]}
                        </p>
                        {asigsSel.map(a => (
                          <div key={a.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: a.turno === 'mañana' ? 'var(--manana-bg)' : 'var(--noche-bg)',
                            borderRadius: 8, padding: '8px 12px',
                          }}>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                                {formatFecha(a.fecha)}
                              </p>
                              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                🏢 {a.zona?.nombre || '—'}
                              </p>
                            </div>
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              color: a.turno === 'mañana' ? 'var(--manana-badge)' : 'var(--noche-badge)',
                              background: 'transparent',
                            }}>
                              {a.turno === 'mañana' ? '☀️ Mañana' : '🌙 Noche'}
                            </span>
                          </div>
                        ))}
                      </div>
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
