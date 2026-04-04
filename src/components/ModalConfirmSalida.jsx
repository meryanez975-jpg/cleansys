export default function ModalConfirmSalida({ onConfirmar, onCancelar }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 500 }}>
      <div className="modal" style={{ maxWidth: 340, textAlign: 'center' }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>⚠️</p>
        <p className="modal-title" style={{ marginBottom: 8 }}>Cambios sin guardar</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
          Si salís ahora, los cambios que no guardaste se van a perder.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-danger btn-block" onClick={onConfirmar}>
            Salir sin guardar
          </button>
          <button className="btn btn-primary btn-block" onClick={onCancelar}>
            Quedarme y guardar
          </button>
        </div>
      </div>
    </div>
  )
}
