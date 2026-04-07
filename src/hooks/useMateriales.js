import { useState, useCallback } from 'react'
import * as store from '../data/store'

export function useMateriales() {
  const [materiales, setMateriales] = useState(() => store.getMateriales())

  const refetch = useCallback(() => setMateriales(store.getMateriales()), [])

  function agregar(nombre, sector, cantidad, unidad, fechaCompra, fechaReposicion, foto) {
    store.addMaterial(nombre, sector, cantidad, unidad, fechaCompra, fechaReposicion, foto)
    refetch()
  }

  function editar(id, datos) {
    store.editMaterial(id, datos)
    refetch()
  }

  function eliminar(id) {
    store.removeMaterial(id)
    refetch()
  }

  return { materiales, agregar, editar, eliminar }
}
