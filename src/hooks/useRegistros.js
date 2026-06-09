import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'
import * as store from '../data/store'

async function pushRegistro(registro) {
  try {
    await supabase.from('limpieza_registros').upsert({
      id:            registro.id,
      asignacion_id: registro.asignacion_id,
      hora_entrada:  registro.hora_entrada  || null,
      hora_salida:   registro.hora_salida   || null,
      completado:    registro.completado    || false,
      notas:         registro.notas         || '',
    })
  } catch (e) {
    console.warn('Supabase sync registro failed:', e)
  }
}

export async function pullRegistros() {
  try {
    const { data, error } = await supabase.from('limpieza_registros').select('*')
    if (error || !data) return false
    // Supabase es la fuente de verdad — los registros se pushean en tiempo real al marcar
    localStorage.setItem('cleansys_registros', JSON.stringify(data))
    return true
  } catch (e) {
    console.warn('pullRegistros error:', e)
    return false
  }
}

function getRegFromStorage(asignacion_id) {
  const all = JSON.parse(localStorage.getItem('cleansys_registros') || '[]')
  return all.find(r => r.asignacion_id === asignacion_id) || null
}

export function useRegistros(fecha) {
  const [registros, setRegistros] = useState(() => store.getRegistros(fecha))

  const refetch = useCallback(() => {
    setRegistros(store.getRegistros(fecha))
  }, [fecha])

  useEffect(() => {
    pullRegistros().then(ok => { if (ok) refetch() })
  }, [fecha, refetch])

  function marcarEntrada(asignacion_id) {
    store.marcarEntrada(asignacion_id)
    refetch()
    const reg = getRegFromStorage(asignacion_id)
    if (reg) pushRegistro(reg)
  }

  function marcarSalida(asignacion_id, notas = '') {
    store.marcarSalida(asignacion_id, notas)
    refetch()
    const reg = getRegFromStorage(asignacion_id)
    if (reg) pushRegistro(reg)
  }

  function marcarCompletado(asignacion_id, completado) {
    store.marcarCompletado(asignacion_id, completado)
    refetch()
    const reg = getRegFromStorage(asignacion_id)
    if (reg) pushRegistro(reg)
  }

  function getRegistroPorAsignacion(asignacion_id) {
    return registros.find(r => r.asignacion_id === asignacion_id) || null
  }

  return { registros, loading: false, marcarEntrada, marcarSalida, marcarCompletado, getRegistroPorAsignacion, refetch, pullRegistros }
}
