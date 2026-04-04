import { useState, useCallback } from 'react'
import * as store from '../data/store'

export function useRegistros(fecha) {
  const [registros, setRegistros] = useState(() => store.getRegistros(fecha))

  const refetch = useCallback(() => {
    setRegistros(store.getRegistros(fecha))
  }, [fecha])

  function marcarEntrada(asignacion_id) {
    store.marcarEntrada(asignacion_id)
    refetch()
  }

  function marcarSalida(asignacion_id, notas = '') {
    store.marcarSalida(asignacion_id, notas)
    refetch()
  }

  function getRegistroPorAsignacion(asignacion_id) {
    return registros.find(r => r.asignacion_id === asignacion_id) || null
  }

  return { registros, loading: false, marcarEntrada, marcarSalida, getRegistroPorAsignacion, refetch }
}
