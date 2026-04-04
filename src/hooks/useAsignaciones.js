import { useState, useCallback } from 'react'
import * as store from '../data/store'

export function useAsignaciones(fecha) {
  const [asignaciones, setAsignaciones] = useState(() => store.getAsignaciones(fecha))

  const refetch = useCallback(() => {
    setAsignaciones(store.getAsignaciones(fecha))
  }, [fecha])

  function crearAsignacion(personal_id, zona_id, turno) {
    const result = store.addAsignacion(personal_id, zona_id, turno, fecha)
    if (!result.error) refetch()
    return result
  }

  function eliminarAsignacion(id) {
    store.removeAsignacion(id)
    refetch()
    return { error: null }
  }

  return { asignaciones, loading: false, crearAsignacion, eliminarAsignacion, refetch }
}
