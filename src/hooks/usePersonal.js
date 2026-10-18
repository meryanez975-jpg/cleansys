import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'

const CLAVE        = 'cleansys_personal'
const REINTENTO_MS = 5000   // mientras la carga falla (ej. tablet sin wifi al abrir)
const REFRESCO_MS  = 60000  // con datos OK, para ver altas/bajas hechas en MenuSoft

function leerCache() {
  try {
    const data = JSON.parse(localStorage.getItem(CLAVE))
    return Array.isArray(data) ? data.filter(p => p?.id && p?.nombre && p.activo !== false) : []
  } catch { return [] }
}

// Quita acentos y espacios de más, para que "lucia" encuentre a "Lucía "
export function normalizarNombre(texto) {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Sector como se escribe en MenuSoft
const SECTORES = { bisuteria: 'Bisutería', cosmeticos: 'Cosméticos', libreria: 'Librería', lili: 'Lili', otros: 'Otros' }
export function etiquetaSector(sector) {
  return SECTORES[sector] || sector || ''
}

// Solo lectura — el personal se gestiona desde MenuSoft.
// Antes se pedía una sola vez: si esa carga fallaba, la lista quedaba vacía
// hasta medianoche. Ahora arranca con la copia guardada y reintenta sola.
export function usePersonal() {
  const [personal, setPersonal] = useState(leerCache)
  const [loading, setLoading]   = useState(() => leerCache().length === 0)
  const [error, setError]       = useState(null)

  const refetch = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('com_personal')
        .select('id, nombre, sector, turno, activo, "diaLibre", ausencias, "modoTurno", "horarioTodosInicio", "horariosPorDia"')
        .neq('activo', false)
        .order('nombre')
      if (error) throw error
      setPersonal(data || [])
      setError(null)
      try { localStorage.setItem(CLAVE, JSON.stringify(data || [])) } catch {}
      return true
    } catch (err) {
      console.error('Personal:', err)
      setError(err?.message || 'Sin conexión')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    function alVolver() { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', refetch)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', refetch)
    }
  }, [refetch])

  useEffect(() => {
    const id = setInterval(refetch, error ? REINTENTO_MS : REFRESCO_MS)
    return () => clearInterval(id)
  }, [error, refetch])

  return { personal, loading, error, refetch }
}
