export default function ModalConfirmSalida({ onConfirmar, onCancelar }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onCancelar}
    >
      <div
        style={{
          background: '#fff', borderRadius: 24,
          padding: '32px 24px 24px',
          width: '100%', maxWidth: 320,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          textAlign: 'center',
          animation: 'fadeInUp 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Ícono */}
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, margin: '0 auto 20px',
          boxShadow: '0 4px 16px rgba(251,191,36,0.35)',
        }}>
          ⚠️
        </div>

        {/* Título */}
        <p style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
          Cambios sin guardar
        </p>

        {/* Subtítulo */}
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 28 }}>
          Si salís ahora, las asignaciones que planificaste se van a perder.
        </p>

        {/* Botones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onCancelar}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #1d4ed8, #6d28d9)',
              color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(29,78,216,0.35)',
            }}
          >
            Quedarme y guardar
          </button>
          <button
            onClick={onConfirmar}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 14,
              border: '1.5px solid #e2e8f0',
              background: '#f8fafc', color: '#64748b',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Salir sin guardar
          </button>
        </div>
      </div>
    </div>
  )
}
