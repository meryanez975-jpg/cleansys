import { useMemo } from 'react'
import { usePersonal } from './usePersonal'

// Mapea el turno de Supabase (menusoft) al turno de cleansys
function turnoDePersona(turnoSupabase) {
  if (!turnoSupabase) return null
  const t = turnoSupabase.toLowerCase().normalize('NFC').trim()
  if (t === 'mañana' || t === 'manana' || t === 'diurno') return 'mañana'
  if (t === 'tarde' || t === 'noche') return 'noche'
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
    const resultado = todos.filter(p => turnoDePersona(p.turno) === turno)
    // Fallback: si el filtro dejó vacío (turno en DB no reconocido), devuelve todos
    return resultado.length > 0 ? resultado : todos
  }, [todos, turno])

  return { personal, loading, error }
}
