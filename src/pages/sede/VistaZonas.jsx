import { useState, useEffect } from 'react'
import { guardarZona, eliminarZona, asignacionesDeSede } from '../../lib/sedes'
import { lunesDeSemana, sumarDias, deIso, DIAS_CORTO, SEMANA_JS } from './fechas'
import { trabajaEnTurno } from '../../hooks/usePersonalComidas'

const TURNOS = [
  { id: 'mañana', icono: '☀️', label: 'Mañana', desde: '08:00', hasta: '12:00' },
  { id: 'noche',  icono: '🌙', label: 'Noche',  desde: '18:00', hasta: '22:00' },
]
// "☀️ 08:00–12:00 · 🌙 19:00–22:00"
export function textoHorarios(h) {
  return TURNOS.filter(t => h?.[t.id]).map(t => `${t.icono} ${h[t.id].desde}–${h[t.id].hasta}`).join(' · ')
}

// Zonas de la sede con su lista de tareas y quién las limpia esta semana
export default function VistaZonas({ sesion, zonas, personal, recargarBase }) {
  const [editando, setEditando]     = useState(null)   // { id, nombre, tareas } — id null = nueva
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [guardando, setGuardando]   = useState(false)
  const [borrar, setBorrar]         = useState(null)
  const [error, setError]           = useState('')
  const [semana, setSemana]         = useState([])     // asignaciones de esta semana
  const [guardado, setGuardado]     = useState('')

  useEffect(() => {
    const lunes = lunesDeSemana(0)
    asignacionesDeSede(zonas.map(z => z.id), lunes, sumarDias(lunes, 6)).then(setSemana).catch(() => setSemana([]))
  }, [zonas])

  const nombreDe = id => personal.find(p => p.id === id)?.nombre
  // Turnos que hay en esta tienda (si nadie trabaja de mañana, no se ofrece mañana)
  const conGente = TURNOS.filter(t => personal.some(p => SEMANA_JS.some(dj => trabajaEnTurno(p, t.id, dj))))
  const turnosTienda = conGente.length ? conGente : TURNOS

  function abrir(z) {
    setEditando(z
      ? { id: z.id, nombre: z.nombre, tareas: [...(z.tareas || [])], horarios: { ...(z.horarios || {}) } }
      // Zona nueva: ya vienen tildados los turnos de la tienda con un horario de ejemplo
      : { id: null, nombre: '', tareas: [], horarios: Object.fromEntries(turnosTienda.map(t => [t.id, { desde: t.desde, hasta: t.hasta }])) })
    setNuevaTarea(''); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function usarTurno(t, usar) {
    setEditando(p => {
      const h = { ...p.horarios }
      if (usar) h[t.id] = h[t.id] || { desde: t.desde, hasta: t.hasta }
      else delete h[t.id]
      return { ...p, horarios: h }
    })
  }
  // El horario es obligatorio: al menos un turno, con inicio antes que el fin
  const horarioValido = h => {
    const usados = Object.values(h || {})
    return usados.length > 0 && usados.every(x => x.desde && x.hasta && x.desde < x.hasta)
  }
  const setHora = (turno, campo, valor) =>
    setEditando(p => ({ ...p, horarios: { ...p.horarios, [turno]: { ...p.horarios[turno], [campo]: valor } } }))

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
      await guardarZona(sesion.token, { id: editando.id, nombre: editando.nombre, tareas, horarios: editando.horarios })
      setEditando(null); setNuevaTarea('')
      await recargarBase()
      setGuardado('✅ Zona guardada')
      setTimeout(() => setGuardado(''), 2500)
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
          onClick={() => abrir(null)}
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
          <div className="input-group">
            <label className="input-label">Horario de limpieza</label>
            {turnosTienda.map(t => {
              const h = editando.horarios[t.id]
              return (
                <div key={t.id} style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: h ? 'var(--bg)' : 'transparent' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!h} onChange={e => usarTurno(t, e.target.checked)} />
                    {t.icono} {t.label}
                  </label>
                  {h && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <input type="time" className="input" style={{ flex: 1, minWidth: 0 }} value={h.desde} onChange={e => setHora(t.id, 'desde', e.target.value)} />
                      <span className="text-muted">a</span>
                      <input type="time" className="input" style={{ flex: 1, minWidth: 0 }} value={h.hasta} onChange={e => setHora(t.id, 'hasta', e.target.value)} />
                    </div>
                  )}
                </div>
              )
            })}
            {horarioValido(editando.horarios)
              ? <p className="text-muted" style={{ fontSize: 12 }}>El personal puede marcar la entrada a esta zona desde la hora de inicio.</p>
              : <p style={{ fontSize: 12, color: '#b45309', fontWeight: 700 }}>⚠️ Tildá al menos un turno y poné de qué hora a qué hora (el inicio antes que el fin).</p>}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={guardando || !editando.nombre.trim() || !horarioValido(editando.horarios)}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setEditando(null); setNuevaTarea('') }}>Cancelar</button>
          </div>
        </form>
      )}

      {!editando && (zonas.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay zonas. Tocá ＋ abajo a la derecha para crear la primera.</p>
      ) : zonas.map(z => {
        const quienes = quienesLimpian(z.id)
        return (
          <div key={z.id} className="card" style={{ marginBottom: 12 }}>
            <div className="flex-between" style={{ marginBottom: 6 }}>
              <p style={{ fontWeight: 800, fontSize: 16 }}>🧹 {z.nombre}</p>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm" title="Editar"
                  onClick={() => abrir(z)}>✏️</button>
                <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => setBorrar(z)}>🗑️</button>
              </div>
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 4 }}>
              🕐 {textoHorarios(z.horarios) || 'Sin horario (se usa 8:00 mañana / 18:00 noche)'}
            </p>
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
      }))}

      {guardado && (
        <div style={{ position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', zIndex: 300,
          background: '#15803d', color: '#fff', fontWeight: 800, padding: '10px 18px', borderRadius: 999, boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}>
          {guardado}
        </div>
      )}

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
