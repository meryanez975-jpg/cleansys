import { useState } from 'react'

const DIAS_SEMANA = [
  { label: 'Sin día libre', value: null },
  { label: 'Lunes',   value: 1 },
  { label: 'Martes',  value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves',  value: 4 },
  { label: 'Viernes', value: 5 },
  { label: 'Sábado',  value: 6 },
  { label: 'Domingo', value: 0 },
]

function FormPersona({ inicial, onGuardar, onCancelar, labelBoton }) {
  const [nombre,    setNombre]    = useState(inicial?.nombre    ?? '')
  const [sector,    setSector]    = useState(inicial?.sector    ?? '')
  const [turno,     setTurno]     = useState(inicial?.turno     ?? null)
  const [diaLibre,  setDiaLibre]  = useState(inicial?.dia_libre ?? null)

  function handleGuardar() {
    if (!nombre.trim()) return
    onGuardar({ nombre, sector, turno, dia_libre: diaLibre })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        className="input"
        placeholder="Nombre completo *"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleGuardar()}
        autoFocus={!inicial}
      />
      <input
        className="input"
        placeholder="Sector (opcional)"
        value={sector}
        onChange={e => setSector(e.target.value)}
      />

      {/* Turno */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Turno</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { t: 'mañana', emoji: '☀️', label: 'Mañana' },
            { t: 'noche',  emoji: '🌙', label: 'Noche'  },
          ].map(({ t, emoji, label }) => (
            <button
              key={t}
              type="button"
              onClick={() => setTurno(turno === t ? null : t)}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${turno === t ? 'var(--primary)' : 'var(--border)'}`,
                background: turno === t ? 'var(--primary-light)' : 'var(--bg)',
                fontWeight: 600, fontSize: 13,
                color: turno === t ? 'var(--primary-dark)' : 'var(--text-muted)',
              }}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Día libre */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Día libre</p>
        <select
          className="input"
          style={{ padding: '8px 10px', fontSize: 13 }}
          value={diaLibre === null ? '' : String(diaLibre)}
          onChange={e => setDiaLibre(e.target.value === '' ? null : Number(e.target.value))}
        >
          {DIAS_SEMANA.map(d => (
            <option key={String(d.value)} value={d.value === null ? '' : String(d.value)}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1 }}
          onClick={handleGuardar}
          disabled={!nombre.trim()}
        >
          {labelBoton}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  )
}

export default function PersonalModal({ personal, onAgregar, onEditar, onEliminar, onClose }) {
  const [editando, setEditando] = useState(null) // persona completa
  const [agregando, setAgregando] = useState(false)

  function handleAgregar({ nombre, sector, turno, dia_libre }) {
    onAgregar(nombre, sector, turno, dia_libre)
    setAgregando(false)
  }

  function handleEditar({ nombre, sector, turno, dia_libre }) {
    onEditar(editando.id, nombre, sector, turno, dia_libre)
    setEditando(null)
  }

  function handleEliminar(id, nombrePersona) {
    if (!window.confirm(`¿Eliminar a ${nombrePersona}?`)) return
    onEliminar(id)
  }

  function handleClose() {
    if (agregando || editando) {
      if (!window.confirm('Tenés cambios sin guardar. ¿Cerrar igual?')) return
    }
    onClose()
  }

  const NOMBRE_DIA = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal"
        style={{ maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="modal-title">👥 Gestionar Personal</p>

        {/* Lista actual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
          {personal.length === 0 && !agregando && (
            <p className="text-muted text-center">Sin personal agregado aún</p>
          )}
          {personal.map(p => (
            <div key={p.id} style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
            }}>
              {editando?.id === p.id ? (
                <FormPersona
                  inicial={editando}
                  onGuardar={handleEditar}
                  onCancelar={() => setEditando(null)}
                  labelBoton="✓ Guardar"
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{p.nombre}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      {p.sector && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.sector}</span>
                      )}
                      {p.turno && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: p.turno === 'mañana' ? '#b45309' : '#4f46e5', background: p.turno === 'mañana' ? '#fef3c7' : '#ede9fe', borderRadius: 4, padding: '1px 5px' }}>
                          {p.turno === 'mañana' ? '☀️ Mañana' : '🌙 Noche'}
                        </span>
                      )}
                      {p.dia_libre !== null && p.dia_libre !== undefined && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#d1fae5', borderRadius: 4, padding: '1px 5px' }}>
                          🏖️ {NOMBRE_DIA[p.dia_libre]}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setAgregando(false); setEditando(p) }}
                  >✏️</button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleEliminar(p.id, p.nombre)}
                  >🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Formulario agregar */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          {agregando ? (
            <FormPersona
              inicial={null}
              onGuardar={handleAgregar}
              onCancelar={() => setAgregando(false)}
              labelBoton="+ Agregar"
            />
          ) : (
            <button
              className="btn btn-primary btn-block"
              onClick={() => { setEditando(null); setAgregando(true) }}
            >
              + Agregar persona
            </button>
          )}
        </div>

        <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={handleClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
