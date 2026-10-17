import { useState } from 'react'
import './BarraFecha.css'

// Copia de la BarraFecha de Comidas (Menu Soft), con los colores de CleanSys.
// Barra de fecha única: texto a la izquierda, flechas ‹ › juntas y el
// calendario 📅 en la esquina (con Aceptar).
//   modo="dia"   → se elige un día (onElegirDia)
//   modo="rango" → se elige desde / hasta (onElegirRango), donde hace falta

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DIAS_CAL = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']
const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function soloFecha(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function corta(d) { return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}` }

function Calendario({ modo, valor, rango, min, max, onAceptar, onCancelar }) {
  const piso = min ? soloFecha(min) : null
  const tope = max ? soloFecha(max) : null
  const base = modo === 'rango' ? (rango?.inicio || valor || new Date()) : (valor || new Date())
  const [elegido, setElegido] = useState(() => soloFecha(base))
  const [inicio, setInicio]   = useState(() => rango?.inicio ? soloFecha(rango.inicio) : null)
  const [fin, setFin]         = useState(() => rango?.fin ? soloFecha(rango.fin) : null)
  const [mes, setMes] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1))

  const offset = (mes.getDay() + 6) % 7
  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1))]
  const hoy = soloFecha(new Date())
  const puedeMesAnt = !piso || new Date(mes.getFullYear(), mes.getMonth(), 0) >= piso
  const puedeMesSig = !tope || new Date(mes.getFullYear(), mes.getMonth() + 1, 1) <= tope

  function tocar(d) {
    if (modo !== 'rango') { setElegido(d); return }
    if (!inicio || fin) { setInicio(d); setFin(null) }       // empieza un rango nuevo
    else if (d < inicio) { setFin(inicio); setInicio(d) }
    else setFin(d)
  }

  function clase(d) {
    const t = d.getTime()
    const c = ['bf-dia']
    if (t === hoy.getTime()) c.push('hoy')
    if (modo === 'rango') {
      if (inicio && t === inicio.getTime()) c.push('elegido')
      else if (fin && t === fin.getTime()) c.push('elegido')
      else if (inicio && fin && d > inicio && d < fin) c.push('en-rango')
    } else if (t === elegido.getTime()) c.push('elegido')
    return c.join(' ')
  }

  const texto = modo === 'rango'
    ? (inicio ? `${corta(inicio)} → ${fin ? corta(fin) : '…'}` : 'Tocá el primer día y después el último')
    : `${DIAS[elegido.getDay()]} ${elegido.getDate()} de ${MESES[elegido.getMonth()]}`

  return (
    <div className="bf-overlay" onClick={onCancelar}>
      <div className="bf-modal" onClick={e => e.stopPropagation()}>
        <div className="bf-modal-cab">
          <span className="bf-modal-titulo">{modo === 'rango' ? 'Elegir fechas' : 'Elegir día'}</span>
          <button className="bf-cerrar" onClick={onCancelar} aria-label="Cerrar">✕</button>
        </div>
        <div className="bf-mes">
          <button className="bf-mes-flecha" disabled={!puedeMesAnt} onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
          <span>{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
          <button className="bf-mes-flecha" disabled={!puedeMesSig} onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="bf-grid">
          {DIAS_CAL.map(d => <span key={d} className="bf-dia-nombre">{d}</span>)}
          {celdas.map((d, i) => {
            if (!d) return <span key={i} />
            return (
              <button key={i} disabled={(!!tope && d > tope) || (!!piso && d < piso)}
                className={clase(d)} onClick={() => tocar(d)}>
                {d.getDate()}
              </button>
            )
          })}
        </div>
        <p className="bf-elegido">{texto}</p>
        <div className="bf-botones">
          <button className="bf-cancelar" onClick={onCancelar}>Cancelar</button>
          <button className="bf-aceptar" disabled={modo === 'rango' && !inicio}
            onClick={() => onAceptar(modo === 'rango' ? { inicio, fin: fin || inicio } : elegido)}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BarraFecha({
  titulo, subtitulo, extra,
  onAnterior, onSiguiente, puedeAnterior = true, puedeSiguiente = true,
  modo = 'dia', valorCalendario, rango, min, max, onElegirDia, onElegirRango,
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <div className="bf-barra">
        <div className="bf-textos">
          <span className="bf-titulo">{titulo}{extra}</span>
          {subtitulo && <span className="bf-subtitulo">{subtitulo}</span>}
        </div>
        <div className="bf-flechas">
          <button className="bf-flecha" onClick={onAnterior} disabled={!puedeAnterior} aria-label="Anterior">‹</button>
          <button className="bf-flecha" onClick={onSiguiente} disabled={!puedeSiguiente} aria-label="Siguiente">›</button>
        </div>
        <button className="bf-cal" onClick={() => setAbierto(true)} aria-label="Elegir fecha" title="Elegir fecha">📅</button>
      </div>
      {abierto && (
        <Calendario modo={modo} valor={valorCalendario} rango={rango} min={min} max={max}
          onCancelar={() => setAbierto(false)}
          onAceptar={v => { setAbierto(false); modo === 'rango' ? onElegirRango(v) : onElegirDia(v) }} />
      )}
    </>
  )
}

// Cuántas semanas hay entre la semana de hoy y la del día d (0 = esta semana)
export function semanasDesdeHoy(d) {
  const lunes = x => { const l = new Date(x); l.setHours(0, 0, 0, 0); l.setDate(l.getDate() - ((l.getDay() + 6) % 7)); return l }
  return Math.round((lunes(d) - lunes(new Date())) / (7 * 86400000))
}
