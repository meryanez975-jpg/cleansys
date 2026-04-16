import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

// Mapea el turno de Supabase (menusoft) al turno de cleansys
function turnoDePersona(turnoSupabase) {
  if (!turnoSupabase) return null
  const t = turnoSupabase.toLowerCase()
  if (t === 'mañana' || t === 'diurno') return 'mañana'
  if (t === 'tarde'  || t === 'noche')  return 'noche'
  return null
}

export function usePersonalComidas(turno) {
  const [personal, setPersonal] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPersonal() {
      setLoading(true)
      const { data, error } = await supabase
        .from('com_personal')
        .select('id, nombre, sector, turno, dia_libre')
        .eq('activo', true)
        .order('nombre')

      if (!error && data) {
        // Filtra en JS usando el mismo mapeo que HistorialPersonal
        setPersonal(data.filter(p => turnoDePersona(p.turno) === turno))
      } else if (error) {
        console.error('Error cargando personal de comidas:', error.message)
      }
      setLoading(false)
    }
    fetchPersonal()
  }, [turno])

  return { personal, loading }
}
