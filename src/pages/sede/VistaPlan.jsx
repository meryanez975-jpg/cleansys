import { useState, useEffect, useCallback } from 'react'
import { asignacionesDeSede, asignar, quitarAsignacion, cambiarPersona } from '../../lib/sedes'
import { trabajaEnTurno, noVieneEseDia } from '../../hooks/usePersonalComidas'
import { lunesDeSemana, sumarDias, deIso, hoyIso, fechaCorta, DIAS_CORTO, SEMANA_JS } from './fechas'

const TURNOS = [
  { id: 'mañana', icono: '☀️', label: 'Mañana' },
  { id: 'noche',  icono: '🌙', label: 'Noche' },
]

// ¿La persona puede limpiar esa fecha y turno? (viene ese día y trabaja en ese turno)
const disponible = (p, fecha, turno) => {
  const dj = deIso(fecha).getDay()
  return !noVieneEseDia(p, dj) && trabajaEnTurno(p, turno, dj)
}

// Plan semanal de la sede: quién limpia qué zona cada día
export default function VistaPlan({ sesion, zonas, personal, avisos, recargarBase }) {
  const [offset, setOffset]   = useState(0)
  const [asig, setAsig]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]     = useState('')
  const [mensaje, setMensaje] = useState('')
  const [form, setForm]       = useState(null)   // formulario de asignar
  const [cambiando, setCambiando] = useState(null) // asignación a la que se le pone otra persona

  const lunes = lunesDeSemana(offset)
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const hoy = hoyIso()

  const cargar = useCallback(async () => {
    setCargando(true)
    try { setAsig(await asignacionesDeSede(zonas.map(z => z.id), lunes, sumarDias(lunes, 6))); setError('') }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }, [zonas, lunes])
  useEffect(() => { cargar() }, [cargar])

  const persona  = id => personal.find(p => p.id === id)
  const zonaDe   = id => zonas.find(z => z.id === id)

  function abrirForm() {
    setMensaje(''); setError('')
    setForm({ zonaId: zonas[0]?.id || '', turno: 'mañana', personalId: '', desde: sumarDias(lunesDeSemana(0), 0) < hoy ? hoy : lunesDeSemana(0), hasta: sumarDias(lunesDeSemana(0), 4) < hoy ? sumarDias(lunesDeSemana(1), 4) : sumarDias(lunesDeSemana(0), 4), dias: [1, 2, 3, 4, 5] })
  }

  // Fechas que se van a asignar con el formulario (se saltan los días que no viene)
  function fechasDelForm() {
    if (!form?.desde || !form?.hasta || form.hasta < form.desde) return { ok: [], saltadas: 0 }
    const p = persona(form.personalId)
    const ok = []; let saltadas = 0
    for (let f = form.desde; f <= form.hasta; f = sumarDias(f, 1)) {
      if (f < hoy || !form.dias.includes(deIso(f).getDay())) continue
      if (p && !disponible(p, f, form.turno)) { saltadas++; continue }
      ok.push(f)
    }
    return { ok, saltadas }
  }

  async function guardarForm(e) {
    e.preventDefault()
    const { ok } = fechasDelForm()
    if (ok.length === 0) { setError('No hay días para asignar en ese período.'); return }
    setError('')
    try {
      const r = await asignar(sesion.token, { zonaId: form.zonaId, personalId: form.personalId, turno: form.turno, fechas: ok })
      setMensaje(`✅ ${r.asignadas} día${r.asignadas !== 1 ? 's' : ''} asignado${r.asignadas !== 1 ? 's' : ''}` +
        (r.ocupadas ? ` · ${r.ocupadas} ya tenía tarea en otra tienda` : ''))
      setForm(null)
      await cargar(); await recargarBase()
    } catch (err) { setError(err.message) }
  }

  async function quitar(a) {
    if (!window.confirm('¿Quitar esta tarea?')) return
    try { await quitarAsignacion(sesion.token, a.id); await cargar(); await recargarBase() }
    catch (err) { setError(err.message) }
  }

  async function ponerPersona(personalId) {
    const a = cambiando
    setCambiando(null)
    try { await cambiarPersona(sesion.token, a.id, personalId); await cargar(); await recargarBase() }
    catch (err) { setError(err.message) }
  }

  const etiquetaSemana = offset === 0 ? 'Esta semana' : offset === 1 ? 'Próxima semana' : offset === -1 ? 'Semana pasada'
    : offset > 0 ? `En ${offset} semanas` : `Hace ${-offset} semanas`
  const previo = form ? fechasDelForm() : null

  return (
    <>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}
      {mensaje && <p style={{ color: 'var(--success, #15803d)', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: 700 }}>{mensaje}</p>}

      {/* Avisos: tareas futuras sin persona */}
      {avisos.length > 0 && (
        <div className="card" style={{ marginBottom: 14, background: '#fef2f2', borderColor: '#fecaca' }}>
          <p style={{ fontWeight: 800, color: '#b91c1c', marginBottom: 6 }}>⚠️ Tareas sin persona</p>
          <p style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 8 }}>Estas personas ya no están en la tienda. Elegí a otra para cada día.</p>
          {avisos.map(a => (
            <div key={a.id} className="flex-between" style={{ padding: '6px 0', borderTop: '1px solid #fecaca', gap: 8 }}>
              <span style={{ fontSize: 13 }}>
                {fechaCorta(a.fecha)} · {a.turno === 'mañana' ? '☀️' : '🌙'} {zonaDe(a.zona_id)?.nombre || 'Zona'}
                <span className="text-muted"> (antes: {a.personalNombre || '—'})</span>
              </span>
              <button className="btn btn-primary btn-sm" onClick={() => setCambiando(a)}>Cambiar</button>
            </div>
          ))}
        </div>
      )}

      {zonas.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Primero creá una zona en 🧹 Zonas de limpieza.</p>
      ) : personal.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Esta tienda todavía no tiene personal. Mirá 👥 Personal de la tienda.</p>
      ) : !form && (
        <button className="btn btn-primary btn-block" style={{ marginBottom: 14 }} onClick={abrirForm}>➕ Asignar limpieza</button>
      )}

      {form && (
        <form className="card" onSubmit={guardarForm} style={{ marginBottom: 14 }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>➕ Asignar limpieza</p>

          <div className="input-group">
            <label className="input-label">Zona</label>
            <select className="input" value={form.zonaId} onChange={e => setForm(f => ({ ...f, zonaId: e.target.value }))}>
              {zonas.map(z => <option key={z.id} value={z.id}>🧹 {z.nombre}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Turno</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TURNOS.map(t => (
                <button key={t.id} type="button" className={`btn ${form.turno === t.id ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}
                  onClick={() => setForm(f => ({ ...f, turno: t.id, personalId: '' }))}>{t.icono} {t.label}</button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Persona</label>
            <select className="input" value={form.personalId} onChange={e => setForm(f => ({ ...f, personalId: e.target.value }))}>
              <option value="">Elegir persona…</option>
              {personal.filter(p => SEMANA_JS.some(dj => trabajaEnTurno(p, form.turno, dj))).map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Desde — hasta</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" className="input" min={hoy} value={form.desde} onChange={e => setForm(f => ({ ...f, desde: e.target.value }))} />
              <input type="date" className="input" min={form.desde || hoy} value={form.hasta} onChange={e => setForm(f => ({ ...f, hasta: e.target.value }))} />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Días</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {SEMANA_JS.map(dj => (
                <button key={dj} type="button" className={`btn btn-sm ${form.dias.includes(dj) ? 'btn-primary' : 'btn-outline'}`} style={{ flex: '1 0 40px' }}
                  onClick={() => setForm(f => ({ ...f, dias: f.dias.includes(dj) ? f.dias.filter(x => x !== dj) : [...f.dias, dj] }))}>
                  {DIAS_CORTO[dj]}
                </button>
              ))}
            </div>
          </div>

          {form.personalId && previo && (
            <p style={{ fontSize: 12, color: 'var(--primary-dark)', marginBottom: 10 }}>
              Se asignan <strong>{previo.ok.length}</strong> día{previo.ok.length !== 1 ? 's' : ''}
              {previo.saltadas > 0 && ` · se saltan ${previo.saltadas} que no viene o no es su turno`}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!form.zonaId || !form.personalId || form.dias.length === 0}>Guardar</button>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Semana */}
      <div className="flex-between" style={{ marginBottom: 10 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setOffset(o => o - 1)}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 800 }}>{etiquetaSemana}</p>
          <p className="text-muted" style={{ fontSize: 12 }}>{fechaCorta(fechas[0])} — {fechaCorta(fechas[6])}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setOffset(o => o + 1)}>›</button>
      </div>

      {cargando ? (
        [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 8 }} />)
      ) : fechas.map(f => {
        const delDia = asig.filter(a => a.fecha === f).sort((a, b) => a.turno.localeCompare(b.turno) || (zonaDe(a.zona_id)?.nombre || '').localeCompare(zonaDe(b.zona_id)?.nombre || ''))
        return (
          <div key={f} className="card" style={{ marginBottom: 8, padding: '10px 12px', opacity: f < hoy ? 0.6 : 1 }}>
            <p style={{ fontWeight: 800, fontSize: 13, marginBottom: delDia.length ? 6 : 0, textTransform: 'capitalize' }}>
              {fechaCorta(f)}{f === hoy ? ' · Hoy' : ''}
            </p>
            {delDia.length === 0 && <p className="text-muted" style={{ fontSize: 12 }}>Sin tareas</p>}
            {delDia.map(a => {
              const p = persona(a.personal_id)
              return (
                <div key={a.id} className="flex-between" style={{ padding: '4px 0', gap: 8 }}>
                  <span style={{ fontSize: 13 }}>
                    {a.turno === 'mañana' ? '☀️' : '🌙'} <strong>{zonaDe(a.zona_id)?.nombre}</strong> — {p
                      ? p.nombre
                      : <span style={{ color: '#b91c1c', fontWeight: 700 }}>⚠️ Falta persona</span>}
                  </span>
                  {f >= hoy && (
                    <span style={{ display: 'flex', gap: 4 }}>
                      {!p && <button className="btn btn-primary btn-sm" onClick={() => setCambiando(a)}>Cambiar</button>}
                      <button className="btn btn-ghost btn-sm" title="Quitar" onClick={() => quitar(a)}>✕</button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {cambiando && (
        <div className="modal-overlay" onClick={() => setCambiando(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">¿Quién limpia {zonaDe(cambiando.zona_id)?.nombre}?</p>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 12, textTransform: 'capitalize' }}>
              {fechaCorta(cambiando.fecha)} · {cambiando.turno === 'mañana' ? '☀️ Mañana' : '🌙 Noche'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
              {personal.filter(p => disponible(p, cambiando.fecha, cambiando.turno)).map(p => (
                <button key={p.id} className="btn btn-outline" onClick={() => ponerPersona(p.id)}>{p.nombre}</button>
              ))}
              {personal.filter(p => disponible(p, cambiando.fecha, cambiando.turno)).length === 0 &&
                <p className="text-muted" style={{ fontSize: 13 }}>Nadie de la tienda viene ese día en ese turno.</p>}
            </div>
            <button className="btn btn-ghost btn-block" onClick={() => setCambiando(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  )
}
