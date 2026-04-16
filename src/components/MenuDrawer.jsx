import { useNavigate } from 'react-router-dom'

export default function MenuDrawer({ onClose, onIr, onAbrirPersonal, onAbrirZonas }) {
  const navigate = useNavigate()

  function ir(path) {
    onClose()
    if (onIr) onIr(path)
    else navigate(path)
  }

  function accion(fn) {
    onClose()
    fn()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(30,58,95,0.35)',
          zIndex: 200,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 280,
        background: 'var(--bg-card)',
        boxShadow: '4px 0 24px rgba(59,130,246,0.15)',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 24px',
      }}>
        {/* Header drawer */}
        <div style={{
          background: 'var(--primary)',
          padding: '28px 20px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>CleaSys</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>Panel Supervisor</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none', borderRadius: 8,
              color: '#fff', cursor: 'pointer',
              fontSize: 18, padding: '4px 10px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Ítems del menú */}
        <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-light)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '0 8px', marginBottom: 6,
          }}>
            Vistas
          </p>

          <MenuItem
            icono="📋"
            texto="Asignación diaria"
            sub="Gestionar turnos del día"
            onClick={() => ir('/asignacion')}
          />

          <MenuItem
            icono="📅"
            texto="Personal de la semana"
            sub="Ver cómo está organizada la semana"
            onClick={() => ir('/semana')}
          />

          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />

          <p style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-light)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '0 8px', marginBottom: 6,
          }}>
            Inventario
          </p>

          <MenuItem
            icono="🧴"
            texto="Material de limpieza"
            sub="Stock, compras y reposición"
            onClick={() => ir('/materiales')}
          />

          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />

          <p style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-light)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '0 8px', marginBottom: 6,
          }}>
            Gestión
          </p>

          <MenuItem
            icono="👥"
            texto="Personal"
            sub="Agregar, turnos y día libre"
            onClick={() => onAbrirPersonal && accion(onAbrirPersonal)}
          />

          <MenuItem
            icono="🏢"
            texto="Zonas de limpieza"
            sub="Agregar, editar y eliminar zonas"
            onClick={() => ir('/zonas')}
          />

          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />

          <p style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-light)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '0 8px', marginBottom: 6,
          }}>
            Reportes
          </p>

          <MenuItem
            icono="⏱"
            texto="Control de limpiezas"
            sub="Cronómetros de hoy y ayer por turno"
            onClick={() => ir('/control')}
          />

          <MenuItem
            icono="👤"
            texto="Historial del personal"
            sub="Cuántas veces limpió cada uno"
            onClick={() => ir('/historial')}
          />
        </div>
      </div>
    </>
  )
}

function MenuItem({ icono, texto, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
        padding: '10px 12px',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'background 0.15s',
        width: '100%',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 22, width: 30, textAlign: 'center', flexShrink: 0 }}>{icono}</span>
      <div>
        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{texto}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</p>
      </div>
    </button>
  )
}
