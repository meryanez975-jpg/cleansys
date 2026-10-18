import { useState, useEffect, useCallback } from 'react'
import BarraFecha from '../../components/BarraFecha'
import { asignacionesDeSede, asignar, quitarAsignacion } from '../../lib/sedes'
import { trabajaEnTurno, noVieneEseDia } from '../../hooks/usePersonalComidas'
import { iso, lunesDeSemana, sumarDias, deIso, hoyIso, fechaCorta, SEMANA_JS } from './fechas'

const TURNOS = [
  { id: 'mañana', icono: '☀️', label: 'Mañana', color: '#c2410c', bg: '#ffedd5' },
  { id: 'noche',  icono: '🌙', label: 'Noche',  color: '#4338ca', bg: '#e0e7ff' },
]
const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaChica = f => { const d = deIso(f); return `${d.getDate()} ${MESES[d.getMonth()]}` }
const MAX_DIAS = 92          // el rango puede ser de hasta 3 meses
const VARIA = '__varia__'    // en el rango hay personas distintas ese día de la semana

// Plan semanal: zona → turno → rango de fechas. Para cada día de la semana se
// elige de una lista quién limpia; se aplica a todos esos días del rango.
// Lo que se deja vacío no se toca.
export default function VistaPlan({ sesion, zonas, personal, avisos, recargarBase }) {
  const conGente = TURNOS.filter(t => personal.some(p => SEMANA_JS.some(dj => trabajaEnTurno(p, t.id, dj))))
  const turnosTienda = conGente.length ? conGente : TURNOS

  const [zonaId, setZonaId]   = useState(zonas[0]?.id || '')
  const zonaSel = zonas.find(z => z.id === zonaId) || null
  // Si la zona tiene horario, solo sus turnos; si no, los de la tienda
  const turnosZona = TURNOS.filter(t => zonaSel?.horarios?.[t.id])
  const turnosVista = turnosZona.length ? turnosZona : turnosTienda
  const [turno, setTurno]     = useState(turnosVista[0]?.id || 'mañana')
  // Por defecto: la próxima semana completa
  const [rango, setRango]     = useState(() => ({ desde: lunesDeSemana(1), hasta: sumarDias(lunesDeSemana(1), 6) }))
  const [asig, setAsig]       = useState([])
  const [elegido, setElegido] = useState({})    // díaJs → personalId ('' = quitar) — solo lo que se tocó
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]     = useState('')
  const [exito, setExito]     = useState('')

  const hoy  = hoyIso()
  const zona = zonas.find(z => z.id === zonaId) || null
  const infoTurno = TURNOS.find(t => t.id === turno)

  useEffect(() => { if (!zonas.some(z => z.id === zonaId)) setZonaId(zonas[0]?.id || '') }, [zonas])
  useEffect(() => { if (!turnosVista.some(t => t.id === turno)) setTurno(turnosVista[0].id) }, [personal, zonaId, zonas])

  // Fechas del rango que todavía se pueden cambiar (de hoy en adelante)
  const fechasRango = []
  for (let f = rango.desde; f <= rango.hasta; f = sumarDias(f, 1)) fechasRango.push(f)
  const editables = fechasRango.filter(f => f >= hoy)
  const diasDelRango = SEMANA_JS.filter(dj => fechasRango.some(f => deIso(f).getDay() === dj))
  const soloVer = editables.length === 0

  const cargar = useCallback(async () => {
    setCargando(true)
    try { setAsig(await asignacionesDeSede(zonas.map(z => z.id), rango.desde, rango.hasta)); setError('') }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }, [zonas, rango.desde, rango.hasta])
  useEffect(() => { cargar() }, [cargar])

  // Al cambiar zona, turno o rango se empieza de nuevo
  useEffect(() => { setElegido({}); setExito('') }, [zonaId, turno, rango.desde, rango.hasta])

  const persona = id => personal.find(p => p.id === id)
  const nombreZona = id => zonas.find(z => z.id === id)?.nombre
  // Fechas de ese día de la semana que se pueden cambiar (de hoy en adelante)
  const fechasDe = dj => editables.filter(f => deIso(f).getDay() === dj)
  // Las que se muestran: las editables, o si ya pasaron todas, las pasadas (solo para ver)
  const fechasVer = dj => (fechasDe(dj).length ? fechasDe(dj) : fechasRango.filter(f => deIso(f).getDay() === dj))

  // Quién está guardado ese día de la semana en el período
  function actualDe(dj) {
    const fs = fechasVer(dj)
    const ids = new Set(asig.filter(a => a.zona_id === zonaId && a.turno === turno && fs.includes(a.fecha)).map(a => a.personal_id))
    if (ids.size === 0) return ''
    if (ids.size > 1) return VARIA
    const [id] = ids
    // Si no está en todos esos días del período, también varía
    return fs.every(f => asig.some(a => a.zona_id === zonaId && a.turno === turno && a.fecha === f && a.personal_id === id)) ? id : VARIA
  }
  const valorDe = dj => (dj in elegido ? elegido[dj] : actualDe(dj))
  const cambios = Object.keys(elegido).filter(dj => elegido[dj] !== actualDe(Number(dj)))

  // Otras zonas donde esa persona ya limpia ese día de la semana (mismo turno)
  // y si el horario choca con esta zona. Se permite igual: las hace de a una.
  function otrasZonas(personalId, dj) {
    if (!personalId || personalId === VARIA) return []
    const fs = fechasVer(dj)
    const ids = [...new Set(asig.filter(a => a.personal_id === personalId && a.turno === turno && a.zona_id !== zonaId && fs.includes(a.fecha)).map(a => a.zona_id))]
    const mio = zonaSel?.horarios?.[turno]
    return ids.map(id => {
      const otra = zonas.find(z => z.id === id)
      const h = otra?.horarios?.[turno]
      const choca = mio && h ? (mio.desde < h.hasta && h.desde < mio.hasta) : null   // null = sin horario para saber
      return { nombre: otra?.nombre || 'otra zona', h, choca }
    })
  }

  // Quién se puede elegir ese día en este turno. Regla: en su día libre no aparece.
  const opcionesDe = dj => personal.filter(p => !noVieneEseDia(p, dj) && trabajaEnTurno(p, turno, dj))

  async function guardar() {
    if (!cambios.length || !zona) return
    setGuardando(true); setError('')
    try {
      let ocupadas = 0
      for (const djStr of cambios) {
        const dj = Number(djStr)
        const nuevo = elegido[dj]
        const fs = fechasDe(dj)
        // Se quita a quien estaba en esos días (zona y turno) y no es el elegido
        for (const a of asig.filter(a => a.zona_id === zonaId && a.turno === turno && fs.includes(a.fecha) && a.personal_id !== nuevo)) {
          await quitarAsignacion(sesion.token, a.id)
        }
        if (nuevo) {
          const r = await asignar(sesion.token, { zonaId, personalId: nuevo, turno, fechas: fs })
          ocupadas += r.ocupadas || 0
        }
      }
      setElegido({})
      await cargar(); await recargarBase()
      setExito(`✅ Guardado: ${zona.nombre}, ${infoTurno.label.toLowerCase()}, del ${fechaChica(rango.desde)} al ${fechaChica(rango.hasta)}` +
        (ocupadas ? ` · ${ocupadas} día${ocupadas !== 1 ? 's' : ''} no se pudo porque esa persona ya tenía tarea en otra tienda` : ''))
    } catch (err) {
      setError('No se pudo guardar: ' + err.message)
      await cargar()
    } finally { setGuardando(false) }
  }

  // Avisar si se cierra la página con cambios sin guardar
  useEffect(() => {
    if (!cambios.length) return
    const avisar = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [cambios.length])

  // Se puede ir al pasado para ver; solo de hoy en adelante se puede cambiar
  function moverSemana(n) {
    const dias = Math.round((deIso(rango.hasta) - deIso(rango.desde)) / 86400000)
    const desde = sumarDias(rango.desde, n * 7)
    setRango({ desde, hasta: sumarDias(desde, dias) })
  }
  function elegirRango({ inicio, fin }) {
    const desde = iso(inicio)
    let hasta = iso(fin)
    if (hasta < desde) hasta = desde
    if (Math.round((deIso(hasta) - deIso(desde)) / 86400000) > MAX_DIAS) hasta = sumarDias(desde, MAX_DIAS)
    setRango({ desde, hasta })
  }
  function irAlAviso(a) {
    setZonaId(a.zona_id); setTurno(a.turno)
    const l = sumarDias(a.fecha, -((deIso(a.fecha).getDay() + 6) % 7))
    setRango({ desde: l, hasta: sumarDias(l, 6) })
  }

  if (zonas.length === 0) return <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Primero creá una zona en 🧹 Zonas de limpieza.</p>
  if (personal.length === 0) return <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Esta tienda todavía no tiene personal. Mirá 👥 Personal de la tienda.</p>

  const esSemana = (off) => rango.desde === lunesDeSemana(off) && rango.hasta === sumarDias(lunesDeSemana(off), 6)
  const titulo = esSemana(0) ? 'Esta semana' : esSemana(1) ? 'Próxima semana' : esSemana(-1) ? 'Semana pasada'
    : rango.hasta < hoy ? 'Período pasado' : 'Período elegido'
  const avisosZona = avisos

  return (
    <div style={{ paddingBottom: 90 }}>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}

      {/* ── Tareas cuya persona ya no está ── */}
      {avisosZona.length > 0 && (
        <div className="card" style={{ marginBottom: 12, background: '#fef2f2', borderColor: '#fecaca' }}>
          <p style={{ fontWeight: 800, color: '#b91c1c', marginBottom: 4 }}>⚠️ Tareas sin persona</p>
          <p style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 6 }}>Esa persona ya no está en la tienda. Tocá para ir y elegí a otra.</p>
          {avisosZona.map(a => (
            <button key={a.id} onClick={() => irAlAviso(a)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #fecaca', padding: '6px 0', cursor: 'pointer', fontSize: 13 }}>
              <span style={{ textTransform: 'capitalize' }}>{fechaCorta(a.fecha)}</span> · {a.turno === 'mañana' ? '☀️' : '🌙'} {nombreZona(a.zona_id) || 'Zona'}
              <span className="text-muted"> (antes: {a.personalNombre || '—'})</span> ›
            </button>
          ))}
        </div>
      )}

      {/* ── 1. Zona (desplegable) ── */}
      <div className="input-group" style={{ marginBottom: 10 }}>
        <label className="input-label">🧹 Zona de limpieza</label>
        <select className="input" value={zonaId} onChange={e => setZonaId(e.target.value)} style={{ fontWeight: 700 }}>
          {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
        {(zona?.tareas || []).length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--primary-dark)', marginTop: 4 }}>Tareas: {zona.tareas.join(' · ')}</p>
        )}
      </div>

      {/* ── 2. Turno: solo los que hay en esta tienda ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {turnosVista.map(t => {
          const activo = turno === t.id
          return (
            <button key={t.id} onClick={() => setTurno(t.id)} style={{
              flex: 1, padding: '10px', borderRadius: 16, cursor: 'pointer',
              border: `2px solid ${activo ? t.color : 'transparent'}`, background: t.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icono}</span>
              <span style={{ fontWeight: 800, fontSize: 14, color: t.color }}>{t.label}</span>
              {zonaSel?.horarios?.[t.id] && <span style={{ fontSize: 11, color: t.color }}>{zonaSel.horarios[t.id].desde}–{zonaSel.horarios[t.id].hasta}</span>}
            </button>
          )
        })}
      </div>

      {/* ── 3. Período: ‹ › por semana y 📅 para elegir el rango ── */}
      <div style={{ marginBottom: 10 }}>
        <BarraFecha
          titulo={titulo}
          subtitulo={`${fechaChica(rango.desde)} → ${fechaChica(rango.hasta)} · ${fechasRango.length} día${fechasRango.length !== 1 ? 's' : ''}`}
          onAnterior={() => moverSemana(-1)}
          onSiguiente={() => moverSemana(1)}
          modo="rango"
          rango={{ inicio: deIso(rango.desde), fin: deIso(rango.hasta) }}
          onElegirRango={elegirRango}
        />
      </div>

      {/* ── 4. Días: se elige de la lista quién limpia ── */}
      <div style={{ border: `1.5px solid ${infoTurno.color}`, borderRadius: 18, overflow: 'hidden', background: 'var(--bg-card)', marginBottom: 10 }}>
        <div style={{ background: infoTurno.bg, padding: '10px 14px' }}>
          <p style={{ fontWeight: 800, color: infoTurno.color }}>{infoTurno.icono} {zona?.nombre} · {infoTurno.label}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {soloVer
              ? '👁️ Este período ya pasó: se puede ver, pero no cambiar.'
              : 'Lo que elijas para cada día se aplica a todos esos días del período (de hoy en adelante). Lo que quede vacío no se toca.'}
          </p>
        </div>
        {cargando ? <div className="skeleton" style={{ height: 220 }} /> : diasDelRango.map(dj => {
          const valor = valorDe(dj)
          const opciones = opcionesDe(dj)
          const actual = actualDe(dj)
          const idsActuales = [...new Set(asig.filter(a => a.zona_id === zonaId && a.turno === turno && fechasVer(dj).includes(a.fecha)).map(a => a.personal_id))]
          const bloqueado = fechasDe(dj).length === 0          // todos esos días ya pasaron: solo se ve
          const yaNoEsta = !bloqueado && actual && actual !== VARIA && !persona(actual)
          const fueraDeLista = actual && actual !== VARIA && !opciones.some(p => p.id === actual)
          const cambiado = dj in elegido && elegido[dj] !== actual
          const asignado = !!valor                              // se resalta cuando ya tiene a alguien
          return (
            <div key={dj} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border)',
              borderLeft: `3px solid ${valor && valor !== VARIA ? infoTurno.color : 'transparent'}`,
            }}>
              <div style={{ width: 84, flexShrink: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 14 }}>{DIAS_LARGO[dj]}{cambiado ? ' ✏️' : ''}</p>
                <p className="text-muted" style={{ fontSize: 11 }}>
                  {bloqueado ? '👁️ ya pasó' : `${fechasDe(dj).length} día${fechasDe(dj).length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
              <select className="input" disabled={bloqueado}
                style={{
                  flex: 1, minWidth: 0, fontWeight: asignado ? 800 : 400,
                  borderColor: yaNoEsta ? '#fca5a5' : asignado ? infoTurno.color : undefined,
                  background: yaNoEsta ? '#fee2e2' : asignado ? infoTurno.bg : undefined,
                  color: asignado ? infoTurno.color : undefined, opacity: bloqueado ? 0.8 : 1,
                }}
                value={valor} onChange={e => { setElegido(prev => ({ ...prev, [dj]: e.target.value })); setExito('') }}>
                <option value="">— Sin asignar —</option>
                {valor === VARIA && (
                  <option value={VARIA} disabled>Varía: {idsActuales.map(id => persona(id)?.nombre?.split(' ')[0] || '⚠️').join(' / ')}</option>
                )}
                {fueraDeLista && (
                  <option value={actual}>
                    {yaNoEsta ? '⚠️ ' : ''}{persona(actual)?.nombre || asig.find(a => a.personal_id === actual)?.personalNombre || 'Persona'}{yaNoEsta ? ' (ya no está)' : ''}
                  </option>
                )}
                {opciones.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              {!bloqueado && otrasZonas(valor, dj).map((o, k) => (
                <p key={k} style={{ fontSize: 11, marginTop: 3, fontWeight: 700, color: o.choca ? '#b45309' : 'var(--text-muted)' }}>
                  {o.choca ? '⚠️ Choca con' : 'ℹ️ También limpia'} {o.nombre}{o.h ? ` (${o.h.desde}–${o.h.hasta})` : ''}{o.choca ? ' — las hace de a una' : ''}
                </p>
              ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Guardar (siempre a la vista) ── */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90, padding: '10px 16px 14px',
        background: 'var(--bg-card)', borderTop: '1px solid var(--border)', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {exito && !cambios.length && <p style={{ fontSize: 12, color: '#15803d', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{exito}</p>}
          <button className="btn btn-primary btn-block" onClick={guardar} disabled={!cambios.length || guardando}>
            {guardando ? '⏳ Guardando…' : cambios.length ? `💾 Guardar (${cambios.length} día${cambios.length !== 1 ? 's' : ''} de la semana)` : '✓ Todo guardado'}
          </button>
        </div>
      </div>
    </div>
  )
}
