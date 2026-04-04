import { useNavigate } from 'react-router-dom'

export default function Inicio() {
  const navigate = useNavigate()

  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div className="container" style={{ textAlign: 'center' }}>

        {/* Logo / título */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            width: 80, height: 80,
            background: 'var(--primary-light)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 38
          }}>
            🧼
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            CleaSys
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Sistema de Limpieza — Turno Mañana &amp; Noche
          </p>
        </div>

        {/* Tarjetas de acceso */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Registro Personal */}
          <button
            onClick={() => navigate('/registro')}
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '24px 20px',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: 'var(--shadow)',
              transition: 'all 0.2s',
              width: '100%'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 52, height: 52,
                background: 'var(--primary-light)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0
              }}>
                👤
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>
                  Registro Personal
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Marcá tu entrada y salida de limpieza
                </p>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontSize: 20 }}>›</span>
            </div>
          </button>

          {/* Asignación */}
          <button
            onClick={() => navigate('/login-supervisor')}
            style={{
              background: 'var(--primary)',
              border: '1.5px solid var(--primary)',
              borderRadius: 'var(--radius)',
              padding: '24px 20px',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
              transition: 'all 0.2s',
              width: '100%'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-dark)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 52, height: 52,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0
              }}>
                📋
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 4 }}>
                  Asignación
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                  Supervisor — Asignar tareas de limpieza
                </p>
              </div>
              <span style={{ marginLeft: 'auto', color: '#fff', fontSize: 20 }}>›</span>
            </div>
          </button>

        </div>

        <p style={{ marginTop: 32, fontSize: 12, color: 'var(--text-light)' }}>
          CleaSys v1.0
        </p>
      </div>
    </div>
  )
}
