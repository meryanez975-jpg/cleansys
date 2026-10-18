import { useState, useEffect } from 'react'
import { guardarZona, eliminarZona, asignacionesDeSede } from '../../lib/sedes'
import { lunesDeSemana, sumarDias, deIso, DIAS_CORTO } from './fechas'

// Zonas de la sede con su lista de tareas y quién las limpia esta semana
export default function VistaZonas({ sesion, zonas, personal, recargarBase }) {
  const [editando, setEditando]     = useState(null)   // { id, nombre, tareas } — id null = nueva
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [guardando, setGuardando]   = useState(false)
  const [borrar, setBorrar]         = useState(null)
  const [error, setError]           = useState('')
  const [semana, setSemana]         = useState([])     // asignaciones de esta semana

  useEffect(() => {
    const lunes = lunesDeSemana(0)
    asignacionesDeSede(zonas.map(z => z.id), lunes, sumarDias(lunes, 6)).then(setSemana).catch(() => setSemana([]))
  }, [zonas])

  const nombreDe = id => personal.find(p => p.id === id)?.nombre

  // "Ana (Lun, Mar, Mié · mañana)"
  function quienesLimpian(zonaId) {
    const porPersona = {}
    semana.filter(a => a.zona_id === zonaId).forEach(a => {
      const k = `${a.personal_id}|${a.turno}`
      if (!porPersona[k]) porPersona[k] = { nombre: nombreDe(a.personal_id), turno: a.turno, dias: [] }
      porPersona[k].dias.push(DIAS_CORTO[deIso(a.fecha).getDay()])
    })
    return Object.values(porPersona)
  }

  function agregarTarea() {
    const t = nuevaTarea.trim()
    if (!t) return
    setEditando(p => ({ ...p, tareas: [...p.tareas, t] }))
    setNuevaTarea('')
  }

  async function guardar(e) {
    e.preventDefault()
    const tareas = nuevaTarea.trim() ? [...editando.tareas, nuevaTarea.trim()] : editando.tareas
    setGuardando(true); setError('')
    try {
      await guardarZona(sesion.token, { id: editando.id, nombre: editando.nombre, tareas })
      setEditando(null); setNuevaTarea('')
      await recargarBase()
    } catch (err) { setError(err.message) } finally { setGuardando(false) }
  }

  async function confirmarBorrar() {
    const z = borrar
    setBorrar(null); setError('')
    try { await eliminarZona(sesion.token, z.id); await recargarBase() }
    catch (err) { setError(err.message) }
  }

  return (
    <>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}

      {/* Botón flotante: nueva zona */}
      {!editando && (
        <button aria-label="Nueva zona de limpieza" title="Nueva zona de limpieza"
          onClick={() => { setEditando({ id: null, nombre: '', tareas: [] }); setNuevaTarea(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          style={{
            position: 'fixed', right: 18, bottom: 22, zIndex: 95, width: 56, height: 56, borderRadius: '50%',
            border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 28, cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(59,130,246,0.4)',
          }}>＋</button>
      )}

      {editando && (
        <form className="card" onSubmit={guardar} style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{editando.id ? '✏️ Editar zona' : '➕ Nueva zona'}</p>
          <div className="input-group">
            <label className="input-label">Nombre de la zona</label>
            <input className="input" placeholder="Ej: Baño, Depósito, Escalera" value={editando.nombre} autoFocus
              onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Tareas que se realizan en esta zona</label>
            {editando.tareas.length === 0 && <p className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>Todavía no hay tareas.</p>}
            {editando.tareas.map((t, i) => (
              <div key={i} className="flex-between" style={{ padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>✓ {t}</span>
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setEditando(p => ({ ...p, tareas: p.tareas.filter((_, j) => j !== i) }))}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Ej: Sacar cartones" value={nuevaTarea}
                onChange={e => setNuevaTarea(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarTarea() } }} />
              <button type="button" className="btn btn-outline" onClick={agregarTarea} disabled={!nuevaTarea.trim()}>+ Agregar</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={guardando || !editando.nombre.trim()}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setEditando(null); setNuevaTarea('') }}>Cancelar</button>
          </div>
        </form>
      )}

      {zonas.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay zonas. Tocá ＋ abajo a la derecha para crear la primera.</p>
      ) : zonas.map(z => {
        const quienes = quienesLimpian(z.id)
        return (
          <div key={z.id} className="card" style={{ marginBottom: 12 }}>
            <div className="flex-between" style={{ marginBottom: 6 }}>
              <p style={{ fontWeight: 800, fontSize: 16 }}>🧹 {z.nombre}</p>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm" title="Editar"
                  onClick={() => { setEditando({ id: z.id, nombre: z.nombre, tareas: [...(z.tareas || [])] }); setNuevaTarea(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>✏️</button>
                <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => setBorrar(z)}>🗑️</button>
              </div>
            </div>
            {(z.tareas || []).length === 0
              ? <p className="text-muted" style={{ fontSize: 12 }}>Sin tareas cargadas</p>
              : (z.tareas || []).map((t, i) => <p key={i} style={{ fontSize: 14, padding: '2px 0' }}>✓ {t}</p>)}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>👥 Esta semana limpian:</p>
              {quienes.length === 0
                ? <p className="text-muted" style={{ fontSize: 12 }}>Nadie asignado. Asigná en 📅 Plan semanal.</p>
                : quienes.map((q, i) => (
                  <p key={i} style={{ fontSize: 13, color: q.nombre ? 'var(--text)' : '#b91c1c' }}>
                    {q.turno === 'mañana' ? '☀️' : '🌙'} {q.nombre || '⚠️ Falta persona'} <span className="text-muted">({q.dias.join(', ')})</span>
                  </p>
                ))}
            </div>
          </div>
        )
      })}

      {borrar && (
        <div className="modal-overlay" onClick={() => setBorrar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">¿Eliminar la zona {borrar.nombre}?</p>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>Lo que ya se registró en esta zona queda en el historial.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarBorrar}>Sí, eliminar</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setBorrar(null)}>No</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
