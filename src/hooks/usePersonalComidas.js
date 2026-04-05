import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

// Mapeo turno cleansys → turnos menusoft
const TURNO_MAP = {
  'mañana': ['mañana', 'diurno'],
  'noche':  ['tarde', 'noche'],
}

export function usePersonalComidas(turno) {
  const [personal, setPersonal] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPersonal() {
      setLoading(true)
      const turnos = TURNO_MAP[turno] || [turno]
      const { data, error } = await supabase
        .from('com_personal')
        .select('id, nombre, sector, turno')
        .eq('activo', true)
        .in('turno', turnos)
        .order('nombre')

      if (!error && data) {
        setPersonal(data)
      } else if (error) {
        console.error('Error cargando personal de comidas:', error.message)
      }
      setLoading(false)
    }
    fetchPersonal()
  }, [turno])

  return { personal, loading }
}
