import { useState, useCallback } from 'react'
import * as store from '../data/store'

export function usePersonal() {
  const [personal, setPersonal] = useState(() => store.getPersonal())

  const refetch = useCallback(() => {
    setPersonal(store.getPersonal())
  }, [])

  function agregar(nombre, sector) {
    store.addPersonal(nombre, sector)
    refetch()
  }

  function editar(id, nombre, sector) {
    store.editPersonal(id, nombre, sector)
    refetch()
  }

  function eliminar(id) {
    store.removePersonal(id)
    refetch()
  }

  return { personal, loading: false, agregar, editar, eliminar, refetch }
}
