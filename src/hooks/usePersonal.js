import { useState, useCallback } from 'react'
import * as store from '../data/store'

export function usePersonal() {
  const [personal, setPersonal] = useState(() => store.getPersonal())

  const refetch = useCallback(() => {
    setPersonal(store.getPersonal())
  }, [])

  function agregar(nombre, sector, turno, dia_libre) {
    store.addPersonal(nombre, sector, turno, dia_libre)
    refetch()
  }

  function editar(id, nombre, sector, turno, dia_libre) {
    store.editPersonal(id, nombre, sector, turno, dia_libre)
    refetch()
  }

  function eliminar(id) {
    store.removePersonal(id)
    refetch()
  }

  return { personal, loading: false, agregar, editar, eliminar, refetch }
}
