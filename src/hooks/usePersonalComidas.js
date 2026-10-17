import { useMemo } from 'react'
import { usePersonal, normalizarNombre } from './usePersonal'

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const CORTE_NOCHE = '14:00' // turno "otro": quien entra desde esta hora cuenta como noche

// Hora de entrada de hoy para el turno "otro" (horario propio cargado en MenuSoft)
function horaEntrada(p) {
  if (p.modoTurno === 'pordia' && Array.isArray(p.horariosPorDia)) {
    const hoy = DIAS[new Date().getDay()]
    const dia = p.horariosPorDia.find(h => normalizarNombre(h?.dia) === hoy)
    if (dia?.inicio) return dia.inicio
  }
  return p.horarioTodosInicio || null
}

// Mapea el turno de Supabase (menusoft) al turno de cleansys
function turnoDePersona(p) {
  if (!p.turno) return null
  const t = p.turno.toLowerCase().normalize('NFC').trim()
  if (t === 'mañana' || t === 'manana' || t === 'diurno') return 'mañana'
  if (t === 'tarde' || t === 'noche') return 'noche'
  if (t === 'otro') {
    const hora = horaEntrada(p)
    if (hora) return hora.padStart(5, '0') < CORTE_NOCHE ? 'mañana' : 'noche'
  }
  return null
}

// Usa la misma carga que usePersonal (copia guardada + reintentos).
// Antes pedía el personal una sola vez: si fallaba, el supervisor se quedaba
// sin nombres para asignar hasta recargar.
export function usePersonalComidas(turno) {
  const { personal: todos, loading, error } = usePersonal()

  const personal = useMemo(() => {
    // Si turno es null, devuelve todos; si no, filtra por mapeo
    if (turno === null) return todos
    const resultado = todos.filter(p => turnoDePersona(p) === turno)
    // Fallback: si el filtro dejó vacío (turno en DB no reconocido), devuelve todos
    return resultado.length > 0 ? resultado : todos
  }, [todos, turno])

  return { personal, loading, error }
}
