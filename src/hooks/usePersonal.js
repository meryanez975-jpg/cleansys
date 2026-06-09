import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'

// Solo lectura — el personal se gestiona desde MenuSoft
export function usePersonal() {
  const [personal, setPersonal] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('com_personal')
      .select('id, nombre, sector, turno, activo')
      .neq('activo', false)
      .order('nombre')
    if (!error && data) {
      setPersonal(data)
      try { localStorage.setItem('cleansys_personal', JSON.stringify(data)) } catch {}
    }
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  return { personal, loading, refetch }
}
