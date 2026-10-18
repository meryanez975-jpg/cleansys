import { useState, useEffect } from 'react'
import { asignacionesDeSede } from '../../lib/sedes'
import { turnosDePersona, noVieneEseDia } from '../../hooks/usePersonalComidas'
import { DIAS_CORTO, SEMANA_JS, lunesDeSemana, sumarDias, deIso } from './fechas'

const TURNO_LABEL = { mañana: '7am a 7pm', diurno: '7am a 4pm', tarde: '11am a 11pm', noche: '2pm a 11pm', otro: 'Horario especial' }
const SEMANAS = [{ off: 0, label: 'Esta semana' }, { off: 1, label: 'Próxima semana' }]

// Personal de la tienda: el personal fijo de MenuSoft con sector = esta tienda,
// con los días que limpia esta semana y la próxima
export default function VistaPersonal({ personal, sede, zonas = [] }) {
  const [asig, setAsig] = useState([])

  useEffect(() => {
    const desde = lunesDeSemana(0)
    asignacionesDeSede(zonas.map(z => z.id), desde, sumarDias(desde, 13)).then(setAsig).catch(() => setAsig([]))
  }, [zonas])

  // "🧹 Baño ☀️ Lun, Mar" por semana
  function limpiezas(personalId, off) {
    const lunes = lunesDeSemana(off)
    const grupos = {}
    asig.filter(a => a.personal_id === personalId && a.fecha >= lunes && a.fecha <= sumarDias(lunes, 6)).forEach(a => {
      const k = `${a.zona_id}|${a.turno}`
      ;(grupos[k] = grupos[k] || []).push(deIso(a.fecha).getDay())
    })
    return Object.entries(grupos).map(([k, dias]) => {
      const [zonaId, turno] = k.split('|')
      const orden = SEMANA_JS.filter(dj => dias.includes(dj)).map(dj => DIAS_CORTO[dj]).join(', ')
      return `🧹 ${zonas.find(z => z.id === zonaId)?.nombre || 'Zona'} ${turno === 'mañana' ? '☀️' : '🌙'} ${orden}`
    })
  }

  return (
    <>
      <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
        El personal se carga en Comidas → Agregar personal, eligiendo el sector <strong>{sede.nombre}</strong>.
        Si alguien sale de Comidas o cambia de tienda, deja de aparecer aquí y sus tareas quedan marcadas para cambiar.
      </p>
      {personal.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay personal con la tienda {sede.nombre} como sector.</p>
      ) : personal.map(p => {
        const noViene = SEMANA_JS.filter(dj => noVieneEseDia(p, dj)).map(dj => DIAS_CORTO[dj])
        const turnos = [...new Set(SEMANA_JS.flatMap(dj => turnosDePersona(p, dj)))]
        return (
          <div key={p.id} className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
            <p style={{ fontWeight: 700 }}>{p.nombre}</p>
            <p className="text-muted" style={{ fontSize: 12 }}>
              {TURNO_LABEL[p.turno] || p.turno}
              {turnos.length > 0 && ` · ${turnos.map(t => t === 'mañana' ? '☀️ Mañana' : '🌙 Noche').join(' y ')}`}
              {' · No viene: '}{noViene.length ? noViene.join(', ') : 'ninguno'}
            </p>
            {SEMANAS.map(s => {
              const lista = limpiezas(p.id, s.off)
              return (
                <p key={s.off} style={{ fontSize: 12, marginTop: 4 }}>
                  <strong>{s.label}:</strong> {lista.length ? lista.join(' · ') : <span className="text-muted">sin limpieza</span>}
                </p>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
