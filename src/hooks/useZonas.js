import { useState, useCallback } from 'react'
import * as store from '../data/store'

export function useZonas() {
  const [zonas, setZonas] = useState(() => store.getZonas())

  const refetch = useCallback(() => {
    setZonas(store.getZonas())
  }, [])

  function crearZona(nombre) {
    store.addZona(nombre)
    refetch()
    return { error: null }
  }

  function editarZona(id, nombre) {
    store.editZona(id, nombre)
    refetch()
    return { error: null }
  }

  function desactivarZona(id) {
    store.removeZona(id)
    refetch()
    return { error: null }
  }

  return { zonas, loading: false, crearZona, editarZona, desactivarZona, refetch }
}
