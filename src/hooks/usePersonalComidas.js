import { useMemo } from 'react'
import { usePersonal, normalizarNombre } from './usePersonal'

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const CORTE_NOCHE = '14:00' // turno "otro": quien entra desde esta hora cuenta como noche

// diaJs: 0 = domingo … 6 = sábado (como Date.getDay()); por defecto hoy
const nombreDia = (diaJs = new Date().getDay()) => DIAS[diaJs]

// Hora de entrada ese día para el turno "otro" (horario propio cargado en MenuSoft)
function horaEntrada(p, diaJs) {
  if (p.modoTurno === 'pordia' && Array.isArray(p.horariosPorDia)) {
    const dia = p.horariosPorDia.find(h => normalizarNombre(h?.dia) === nombreDia(diaJs))
    if (dia?.inicio) return dia.inicio
  }
  return p.horarioTodosInicio || null
}

// Turnos de CleanSys en los que trabaja (mismo turno que en MenuSoft):
// mañana / diurno → mañana · noche → noche · tarde (11am a 11pm) → los dos
// · "otro" según su hora de entrada ese día
export function turnosDePersona(p, diaJs) {
  if (!p?.turno) return []
  const t = p.turno.toLowerCase().normalize('NFC').trim()
  if (t === 'mañana' || t === 'manana' || t === 'diurno') return ['mañana']
  if (t === 'noche') return ['noche']
  if (t === 'tarde') return ['mañana', 'noche']
  if (t === 'otro') {
    const hora = horaEntrada(p, diaJs)
    if (hora) return [hora.padStart(5, '0') < CORTE_NOCHE ? 'mañana' : 'noche']
  }
  return []
}

export const trabajaEnTurno = (p, turno, diaJs) => turnosDePersona(p, diaJs).includes(turno)

// ¿No viene ese día? Misma regla que MenuSoft: en "Por día" los días sin
// horario; con descanso "Otro" todos los días cargados; si no, su día libre
export function noVieneEseDia(p, diaJs) {
  if (!p) return false
  const dia = nombreDia(diaJs)
  if (p.modoTurno === 'pordia' && Array.isArray(p.horariosPorDia) && p.horariosPorDia.length > 0)
    return !p.horariosPorDia.some(h => normalizarNombre(h?.dia) === dia)
  if (p.diaLibre === 'Otro' && Array.isArray(p.ausencias) && p.ausencias.length > 0)
    return p.ausencias.some(a => !a.inicio && !a.fin && normalizarNombre(a.dia) === dia)
  return normalizarNombre(p.diaLibre) === dia
}

// Usa la misma carga que usePersonal (copia guardada + reintentos).
// Antes pedía el personal una sola vez: si fallaba, el supervisor se quedaba
// sin nombres para asignar hasta recargar.
export function usePersonalComidas(turno) {
  const { personal: todos, loading, error } = usePersonal()

  const personal = useMemo(() => {
    // Si turno es null, devuelve todos; si no, filtra por mapeo
    if (turno === null) return todos
    const resultado = todos.filter(p => trabajaEnTurno(p, turno))
    // Fallback: si el filtro dejó vacío (turno en DB no reconocido), devuelve todos
    return resultado.length > 0 ? resultado : todos
  }, [todos, turno])

  return { personal, loading, error }
}
