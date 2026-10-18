import { turnosDePersona, noVieneEseDia } from '../../hooks/usePersonalComidas'
import { DIAS_CORTO, SEMANA_JS } from './fechas'

const TURNO_LABEL = { mañana: '7am a 7pm', diurno: '7am a 4pm', tarde: '11am a 11pm', noche: '2pm a 11pm', otro: 'Horario especial' }

// Personal de la sede: el personal fijo de MenuSoft con sector = esta sede
export default function VistaPersonal({ personal, sede }) {
  return (
    <>
      <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
        El personal se carga en Comidas → Agregar personal, eligiendo el sector <strong>{sede.nombre}</strong>.
        Si alguien sale de Comidas, deja de aparecer aquí y sus tareas quedan marcadas para cambiar.
      </p>
      {personal.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay personal con sector {sede.nombre}.</p>
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
          </div>
        )
      })}
    </>
  )
}
