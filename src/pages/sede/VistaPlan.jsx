import { useState, useEffect, useCallback, useRef } from 'react'
import { asignacionesDeSede, asignar, quitarAsignacion } from '../../lib/sedes'
import { trabajaEnTurno, noVieneEseDia } from '../../hooks/usePersonalComidas'
import { lunesDeSemana, sumarDias, deIso, hoyIso, fechaCorta, DIAS_CORTO, SEMANA_JS } from './fechas'

// Se planifica de a semanas, hasta un mes: esta semana y las 3 siguientes
const SEMANAS = 4
const TURNOS = [
  { id: 'mañana', icono: '☀️', label: 'Mañana' },
  { id: 'noche',  icono: '🌙', label: 'Noche' },
]
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaChica = f => { const d = deIso(f); return `${d.getDate()} ${MESES[d.getMonth()]}` }

// ¿La persona puede limpiar esa fecha y turno? (viene ese día y trabaja en ese turno)
const disponible = (p, fecha, turno) => {
  const dj = deIso(fecha).getDay()
  return !noVieneEseDia(p, dj) && trabajaEnTurno(p, turno, dj)
}
const clave = (fecha, turno, personalId) => `${fecha}|${turno}|${personalId}`

// Plan semanal, con el mismo formato que el menú de comidas: zona → semana →
// día, se tocan los nombres y al final "Guardar todo". Lo editado queda como
// borrador en todas las semanas hasta guardar.
export default function VistaPlan({ sesion, zonas, personal, avisos, recargarBase }) {
  const [zonaIdx, setZonaIdx]   = useState(0)
  const [semana, setSemana]     = useState(0)
  const [diaIdx, setDiaIdx]     = useState(() => (new Date().getDay() + 6) % 7)
  const [guardadas, setGuardadas] = useState([])   // asignaciones del mes en la base
  const [borrador, setBorrador] = useState({})     // clave → zona_id (o null = quitar)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]       = useState('')
  const [exito, setExito]       = useState('')
  const [rapida, setRapida]     = useState(null)   // asignación rápida por período
  const scrollRef = useRef(null)

  const hoy     = hoyIso()
  const desde   = lunesDeSemana(0)
  const hasta   = sumarDias(desde, SEMANAS * 7 - 1)
  const lunes   = lunesDeSemana(semana)
  const fechas  = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const fecha   = fechas[diaIdx]
  const zona    = zonas[zonaIdx] || null
  const pasado  = fecha < hoy

  const cargar = useCallback(async () => {
    setCargando(true)
    try { setGuardadas(await asignacionesDeSede(zonas.map(z => z.id), desde, hasta)); setError('') }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }, [zonas, desde, hasta])
  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    const item = scrollRef.current?.children[zonaIdx]
    if (item) item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [zonaIdx])

  // Lo guardado por clave, y lo efectivo (borrador encima de lo guardado)
  const guardadoPor = {}
  guardadas.forEach(a => { guardadoPor[clave(a.fecha, a.turno, a.personal_id)] = a })
  const zonaDe = k => (k in borrador ? borrador[k] : guardadoPor[k]?.zona_id ?? null)
  const cambios = Object.keys(borrador).filter(k => borrador[k] !== (guardadoPor[k]?.zona_id ?? null))
  const pendienteDia = (f, zonaId) => cambios.some(k => k.startsWith(f + '|') &&
    (borrador[k] === zonaId || guardadoPor[k]?.zona_id === zonaId))

  // Personas en una zona, fecha y turno (incluye a quien ya no está en la tienda)
  function asignadosA(zonaId, f, turno) {
    const ids = new Set()
    guardadas.forEach(a => { if (a.fecha === f && a.turno === turno) ids.add(a.personal_id) })
    Object.keys(borrador).forEach(k => { const [kf, kt, kp] = k.split('|'); if (kf === f && kt === turno) ids.add(kp) })
    return [...ids].filter(id => zonaDe(clave(f, turno, id)) === zonaId)
  }
  const tieneAlguien = (zonaId, f) => TURNOS.some(t => asignadosA(zonaId, f, t.id).length > 0)
  const persona = id => personal.find(p => p.id === id)
  const nombreZona = id => zonas.find(z => z.id === id)?.nombre

  // Avisar si se cierra la página con cambios sin guardar
  useEffect(() => {
    if (!cambios.length) return
    const avisar = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [cambios.length])

  function poner(k, zonaId) {
    setBorrador(prev => ({ ...prev, [k]: zonaId }))
    setExito('')
  }

  // Tocar un nombre: lo asigna a esta zona (si estaba en otra, se mueve) o lo quita
  function tocar(turno, personalId) {
    if (!zona || pasado) return
    const k = clave(fecha, turno, personalId)
    poner(k, zonaDe(k) === zona.id ? null : zona.id)
  }

  // Copia el día elegido de esta zona a otros días (solo a quien viene ese día)
  function copiarA(destinos) {
    if (!zona) return
    setBorrador(prev => {
      const nuevo = { ...prev }
      const efectivo = k => (k in nuevo ? nuevo[k] : guardadoPor[k]?.zona_id ?? null)
      destinos.filter(f => f >= hoy && f !== fecha).forEach(f => {
        TURNOS.forEach(t => {
          const origen = asignadosA(zona.id, fecha, t.id)
          // Quitar de esta zona a quien no está en el día de origen
          asignadosA(zona.id, f, t.id).forEach(id => { if (!origen.includes(id)) nuevo[clave(f, t.id, id)] = null })
          origen.forEach(id => {
            const p = persona(id)
            if (p && disponible(p, f, t.id) && efectivo(clave(f, t.id, id)) !== zona.id) nuevo[clave(f, t.id, id)] = zona.id
          })
        })
      })
      return nuevo
    })
    setExito('')
  }
  const copiarSemana = () => copiarA(fechas.slice(0, 5))
  function repetirEnElMes() {
    if (!zona) return
    // Cada día de esta semana se copia al mismo día de las semanas siguientes
    fechas.forEach((f, i) => {
      for (let s = semana + 1; s < SEMANAS; s++) copiarDesde(f, sumarDias(lunesDeSemana(s), i))
    })
  }
  function copiarDesde(origen, destino) {
    if (destino < hoy) return
    setBorrador(prev => {
      const nuevo = { ...prev }
      const efectivo = k => (k in nuevo ? nuevo[k] : guardadoPor[k]?.zona_id ?? null)
      const ids = (f, turno) => {
        const s = new Set()
        guardadas.forEach(a => { if (a.fecha === f && a.turno === turno) s.add(a.personal_id) })
        Object.keys(nuevo).forEach(k => { const [kf, kt, kp] = k.split('|'); if (kf === f && kt === turno) s.add(kp) })
        return [...s].filter(id => efectivo(clave(f, turno, id)) === zona.id)
      }
      TURNOS.forEach(t => {
        const origenIds = ids(origen, t.id)
        ids(destino, t.id).forEach(id => { if (!origenIds.includes(id)) nuevo[clave(destino, t.id, id)] = null })
        origenIds.forEach(id => {
          const p = persona(id)
          if (p && disponible(p, destino, t.id)) nuevo[clave(destino, t.id, id)] = zona.id
        })
      })
      return nuevo
    })
    setExito('')
  }

  async function guardarTodo() {
    if (!cambios.length) return
    setGuardando(true); setError('')
    try {
      // Primero lo que se quita, después lo que se asigna (agrupado por zona, persona y turno)
      for (const k of cambios.filter(k => borrador[k] === null && guardadoPor[k])) {
        await quitarAsignacion(sesion.token, guardadoPor[k].id)
      }
      const grupos = {}
      cambios.filter(k => borrador[k]).forEach(k => {
        const [f, turno, personalId] = k.split('|')
        const g = `${borrador[k]}|${turno}|${personalId}`
        ;(grupos[g] = grupos[g] || []).push(f)
      })
      let ocupadas = 0
      for (const [g, fs] of Object.entries(grupos)) {
        const [zonaId, turno, personalId] = g.split('|')
        const r = await asignar(sesion.token, { zonaId, personalId, turno, fechas: fs })
        ocupadas += r.ocupadas || 0
      }
      setBorrador({})
      await cargar(); await recargarBase()
      setExito(`✅ Se guardaron ${cambios.length} cambio${cambios.length !== 1 ? 's' : ''}` +
        (ocupadas ? ` · ${ocupadas} no se pudieron porque esa persona ya tenía tarea en otra tienda` : ''))
    } catch (err) {
      setError('No se pudo guardar todo: ' + err.message + '. Lo que no se guardó sigue marcado.')
      await cargar()
    } finally { setGuardando(false) }
  }

  // ── Asignación rápida por período (botón flotante) ──
  function abrirRapida() {
    setError('')
    setRapida({ zonaId: zona?.id || zonas[0]?.id || '', turno: 'mañana', personalId: '', desde: fecha < hoy ? hoy : fecha, hasta: sumarDias(lunesDeSemana(semana), 4) < hoy ? hoy : sumarDias(lunesDeSemana(semana), 4), dias: [1, 2, 3, 4, 5] })
  }
  function fechasRapida() {
    const r = rapida
    if (!r?.desde || !r?.hasta || r.hasta < r.desde) return { ok: [], saltadas: 0 }
    const p = persona(r.personalId)
    const ok = []; let saltadas = 0
    for (let f = r.desde; f <= r.hasta && f <= hasta; f = sumarDias(f, 1)) {
      if (f < hoy || !r.dias.includes(deIso(f).getDay())) continue
      if (p && !disponible(p, f, r.turno)) { saltadas++; continue }
      ok.push(f)
    }
    return { ok, saltadas }
  }
  function aplicarRapida(e) {
    e.preventDefault()
    const { ok } = fechasRapida()
    if (ok.length === 0) { setError('No hay días para asignar en ese período.'); return }
    setBorrador(prev => {
      const nuevo = { ...prev }
      ok.forEach(f => { nuevo[clave(f, rapida.turno, rapida.personalId)] = rapida.zonaId })
      return nuevo
    })
    const i = zonas.findIndex(z => z.id === rapida.zonaId)
    if (i >= 0) setZonaIdx(i)
    setRapida(null)
    setExito('')
  }

  if (zonas.length === 0) return <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Primero creá una zona en 🧹 Zonas de limpieza.</p>
  if (personal.length === 0) return <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Esta tienda todavía no tiene personal. Mirá 👥 Personal de la tienda.</p>

  const etiquetaSemana = semana === 0 ? 'Esta semana' : semana === 1 ? 'Próxima semana' : `Dentro de ${semana} semanas`
  const cambiosSemana = cambios.filter(k => fechas.some(f => k.startsWith(f + '|'))).length
  const previo = rapida ? fechasRapida() : null

  return (
    <div style={{ paddingBottom: 90 }}>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}

      {/* ── Tareas cuya persona ya no está: tocar lleva a ese día ── */}
      {avisos.filter(a => a.fecha <= hasta).length > 0 && (
        <div className="card" style={{ marginBottom: 12, background: '#fef2f2', borderColor: '#fecaca' }}>
          <p style={{ fontWeight: 800, color: '#b91c1c', marginBottom: 4 }}>⚠️ Tareas sin persona</p>
          <p style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 6 }}>Esa persona ya no está en la tienda. Tocá para ir al día, quitala y elegí a otra.</p>
          {avisos.filter(a => a.fecha <= hasta).map(a => (
            <button key={a.id} onClick={() => {
              const s = Math.floor((deIso(a.fecha) - deIso(desde)) / (7 * 86400000))
              setSemana(Math.max(0, Math.min(SEMANAS - 1, s)))
              setDiaIdx((deIso(a.fecha).getDay() + 6) % 7)
              const i = zonas.findIndex(z => z.id === a.zona_id)
              if (i >= 0) setZonaIdx(i)
            }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #fecaca', padding: '6px 0', cursor: 'pointer', fontSize: 13 }}>
              <span style={{ textTransform: 'capitalize' }}>{fechaCorta(a.fecha)}</span> · {a.turno === 'mañana' ? '☀️' : '🌙'} {nombreZona(a.zona_id) || 'Zona'}
              <span className="text-muted"> (antes: {a.personalNombre || '—'})</span> ›
            </button>
          ))}
        </div>
      )}

      {/* ── Zonas (como las comidas en el menú) ── */}
      <div ref={scrollRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
        {zonas.map((z, i) => (
          <button key={z.id} onClick={() => setZonaIdx(i)} style={{
            flexShrink: 0, padding: '12px 16px', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: 14,
            border: `2px solid ${zonaIdx === i ? 'var(--primary)' : 'transparent'}`,
            background: zonaIdx === i ? 'var(--primary-light)' : 'var(--bg-card)',
            color: zonaIdx === i ? 'var(--primary-dark)' : 'var(--text)', boxShadow: 'var(--shadow)',
          }}>🧹 {z.nombre}</button>
        ))}
      </div>

      {/* ── Semana ── */}
      <div className="card flex-between" style={{ marginBottom: 10, padding: '10px 12px' }}>
        <button className="btn btn-outline btn-sm" disabled={semana === 0} onClick={() => setSemana(s => s - 1)}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 800 }}>{etiquetaSemana}</p>
          <p className="text-muted" style={{ fontSize: 12 }}>
            {fechaChica(fechas[0])} — {fechaChica(fechas[6])}{cambiosSemana > 0 ? ` · ✏️ ${cambiosSemana} sin guardar` : ''}
          </p>
        </div>
        <button className="btn btn-outline btn-sm" disabled={semana === SEMANAS - 1} onClick={() => setSemana(s => s + 1)}>›</button>
      </div>

      {/* ── Días ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 }}>
        {fechas.map((f, i) => {
          const activo = diaIdx === i
          const pend = zona && pendienteDia(f, zona.id)
          const lleno = zona && tieneAlguien(zona.id, f)
          return (
            <button key={f} onClick={() => setDiaIdx(i)} style={{
              padding: '8px 2px', borderRadius: 10, cursor: 'pointer', opacity: f < hoy ? 0.5 : 1,
              border: `2px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
              background: activo ? 'var(--primary-light)' : 'var(--bg-card)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: activo ? 'var(--primary-dark)' : 'var(--text)' }}>{DIAS_CORTO[SEMANA_JS[i]]}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fechaChica(f)}</span>
              <span style={{ fontSize: 11, height: 14 }}>{pend ? '✏️' : lleno ? '✅' : ''}</span>
            </button>
          )
        })}
      </div>

      {/* ── Día elegido ── */}
      {zona && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>🧹 {zona.nombre} — <span style={{ textTransform: 'capitalize' }}>{fechaCorta(fecha)}</span></p>
          {pasado
            ? <p className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Este día ya pasó: solo se puede ver.</p>
            : <p className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Tocá un nombre para asignarlo o quitarlo.</p>}
          {(zona.tareas || []).length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--primary-dark)', marginBottom: 10 }}>Tareas: {zona.tareas.join(' · ')}</p>
          )}

          {cargando ? <div className="skeleton" style={{ height: 80, borderRadius: 10 }} /> : TURNOS.map(t => {
            const enZona = asignadosA(zona.id, fecha, t.id)
            const yaNoEstan = enZona.filter(id => !persona(id))
            const opciones = personal.filter(p => disponible(p, fecha, t.id) || enZona.includes(p.id))
            return (
              <div key={t.id} style={{ marginBottom: 12 }}>
                <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{t.icono} {t.label}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {yaNoEstan.map(id => {
                    const nombre = guardadoPor[clave(fecha, t.id, id)]?.personalNombre || 'Persona'
                    return (
                      <button key={id} disabled={pasado} onClick={() => tocar(t.id, id)} style={{
                        padding: '7px 12px', borderRadius: 999, cursor: pasado ? 'default' : 'pointer', fontSize: 13, fontWeight: 700,
                        border: '1.5px solid #fca5a5', background: '#fee2e2', color: '#b91c1c',
                      }}>⚠️ {nombre} (ya no está) ✕</button>
                    )
                  })}
                  {opciones.map(p => {
                    const sel = enZona.includes(p.id)
                    const otra = !sel && zonaDe(clave(fecha, t.id, p.id))
                    return (
                      <button key={p.id} disabled={pasado} onClick={() => tocar(t.id, p.id)} style={{
                        padding: '7px 12px', borderRadius: 999, cursor: pasado ? 'default' : 'pointer', fontSize: 13, fontWeight: 700,
                        border: `1.5px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                        background: sel ? 'var(--primary)' : 'var(--bg-card)', color: sel ? '#fff' : 'var(--text)',
                      }}>
                        {sel ? '✓ ' : ''}{p.nombre}{otra ? <span style={{ fontWeight: 500, opacity: 0.7 }}> · en {nombreZona(otra)}</span> : ''}
                      </button>
                    )
                  })}
                  {opciones.length === 0 && yaNoEstan.length === 0 &&
                    <p className="text-muted" style={{ fontSize: 12 }}>Nadie de la tienda viene este día en este turno.</p>}
                </div>
              </div>
            )
          })}

          {!pasado && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <button className="btn btn-outline btn-sm" onClick={copiarSemana}>📋 Copiar este día a Lun–Vie</button>
              {semana < SEMANAS - 1 && <button className="btn btn-outline btn-sm" onClick={repetirEnElMes}>🔁 Repetir esta semana en todo el mes</button>}
            </div>
          )}
          {diaIdx < 6 && (
            <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => setDiaIdx(d => d + 1)}>
              Siguiente día: {DIAS_CORTO[SEMANA_JS[diaIdx + 1]]} {fechaChica(fechas[diaIdx + 1])} ›
            </button>
          )}
        </div>
      )}

      {/* ── Resumen de la semana: todas las zonas ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>📅 Resumen — {etiquetaSemana}</p>
        {fechas.map((f, i) => {
          const filas = zonas.map(z => ({
            z, gente: TURNOS.flatMap(t => asignadosA(z.id, f, t.id).map(id => `${t.icono}${persona(id)?.nombre?.split(' ')[0] || '⚠️'}`)),
          })).filter(x => x.gente.length)
          return (
            <button key={f} onClick={() => setDiaIdx(i)} style={{
              display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 'none', opacity: f < hoy ? 0.6 : 1,
            }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>{DIAS_CORTO[SEMANA_JS[i]]} {fechaChica(f)}</span>
              {filas.length === 0
                ? <span className="text-muted" style={{ fontSize: 12 }}> — sin limpieza</span>
                : filas.map(({ z, gente }) => (
                  <span key={z.id} style={{ display: 'block', fontSize: 12, color: 'var(--text)' }}>🧹 {z.nombre}: {gente.join(', ')}</span>
                ))}
            </button>
          )
        })}
      </div>

      {/* ── Guardar todo (siempre a la vista) ── */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90, padding: '10px 16px 14px',
        background: 'var(--bg-card)', borderTop: '1px solid var(--border)', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {exito && !cambios.length && <p style={{ fontSize: 12, color: '#15803d', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{exito}</p>}
          <button className="btn btn-primary btn-block" onClick={guardarTodo} disabled={!cambios.length || guardando}>
            {guardando ? '⏳ Guardando…' : cambios.length ? `💾 Guardar todo (${cambios.length} cambio${cambios.length !== 1 ? 's' : ''})` : '✓ Todo guardado'}
          </button>
        </div>
      </div>

      {/* ── Botón flotante: asignación rápida por período ── */}
      <button onClick={abrirRapida} aria-label="Asignar limpieza por período" title="Asignar por período" style={{
        position: 'fixed', right: 18, bottom: 86, zIndex: 95, width: 56, height: 56, borderRadius: '50%',
        border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 28, cursor: 'pointer',
        boxShadow: '0 6px 18px rgba(59,130,246,0.4)',
      }}>＋</button>

      {rapida && (
        <div className="modal-overlay" onClick={() => setRapida(null)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={aplicarRapida} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <p className="modal-title">➕ Asignar por período</p>
            <div className="input-group">
              <label className="input-label">Zona</label>
              <select className="input" value={rapida.zonaId} onChange={e => setRapida(r => ({ ...r, zonaId: e.target.value }))}>
                {zonas.map(z => <option key={z.id} value={z.id}>🧹 {z.nombre}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Turno</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {TURNOS.map(t => (
                  <button key={t.id} type="button" className={`btn ${rapida.turno === t.id ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}
                    onClick={() => setRapida(r => ({ ...r, turno: t.id, personalId: '' }))}>{t.icono} {t.label}</button>
                ))}
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Persona</label>
              <select className="input" value={rapida.personalId} onChange={e => setRapida(r => ({ ...r, personalId: e.target.value }))}>
                <option value="">Elegir persona…</option>
                {personal.filter(p => SEMANA_JS.some(dj => trabajaEnTurno(p, rapida.turno, dj))).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Desde — hasta (máximo un mes)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" className="input" min={hoy} max={hasta} value={rapida.desde} onChange={e => setRapida(r => ({ ...r, desde: e.target.value }))} />
                <input type="date" className="input" min={rapida.desde || hoy} max={hasta} value={rapida.hasta} onChange={e => setRapida(r => ({ ...r, hasta: e.target.value }))} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Días</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {SEMANA_JS.map(dj => (
                  <button key={dj} type="button" className={`btn btn-sm ${rapida.dias.includes(dj) ? 'btn-primary' : 'btn-outline'}`} style={{ flex: '1 0 38px' }}
                    onClick={() => setRapida(r => ({ ...r, dias: r.dias.includes(dj) ? r.dias.filter(x => x !== dj) : [...r.dias, dj] }))}>
                    {DIAS_CORTO[dj]}
                  </button>
                ))}
              </div>
            </div>
            {rapida.personalId && previo && (
              <p style={{ fontSize: 12, color: 'var(--primary-dark)', marginBottom: 10 }}>
                Se marcan <strong>{previo.ok.length}</strong> día{previo.ok.length !== 1 ? 's' : ''}
                {previo.saltadas > 0 && ` · se saltan ${previo.saltadas} que no viene o no es su turno`}. Después tocá “Guardar todo”.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!rapida.zonaId || !rapida.personalId || rapida.dias.length === 0}>Marcar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setRapida(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
