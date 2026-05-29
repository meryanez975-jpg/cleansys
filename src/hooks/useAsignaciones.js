import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'
import * as store from '../data/store'

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

// Sync asignaciones de Supabase a localStorage para que el store.js pueda leerlas offline
async function pullFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('limpieza_asignaciones')
      .select('*')
      .eq('activo', true)
    if (!error && data) {
      const existing = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
      const remoteIds = new Set(data.map(a => a.id))
      const localOnly = existing.filter(a => !remoteIds.has(a.id) && a.activo !== false)
      localStorage.setItem('cleansys_asignaciones', JSON.stringify([...data, ...localOnly]))
      return true
    }
  } catch {}
  return false
}

// Push una asignación a Supabase en background
async function pushToSupabase(asig) {
  try {
    await supabase.from('limpieza_asignaciones').upsert({
      id: asig.id,
      personal_id: asig.personal_id,
      zona_id: asig.zona_id || null,
      turno: asig.turno,
      fecha: asig.fecha,
      personalNombre: asig.personalNombre || '',
      personalSector: asig.personalSector || '',
      activo: asig.activo !== false,
    })
  } catch (e) {
    console.warn('Supabase sync asig failed:', e)
  }
}

// Hook para una sola fecha (usado por /registro, /asignacion, etc.)
export function useAsignaciones(fecha) {
  const [asignaciones, setAsignaciones] = useState(() => store.getAsignaciones(fecha))

  const refetch = useCallback(() => {
    setAsignaciones(store.getAsignaciones(fecha))
  }, [fecha])

  useEffect(() => {
    pullFromSupabase().then(ok => { if (ok) refetch() })
  }, [fecha, refetch])

  async function crearAsignacion(personal_id, zona_id, turno, personalNombre = '', personalSector = '') {
    const result = store.addAsignacion(personal_id, zona_id, turno, fecha, personalNombre, personalSector)
    if (!result.error) {
      refetch()
      const nueva = store.getAsignaciones(fecha).find(a => a.personal_id === personal_id && a.turno === turno)
      if (nueva) pushToSupabase(nueva)
    }
    return result
  }

  async function eliminarAsignacion(id) {
    store.removeAsignacion(id)
    refetch()
    try { await supabase.from('limpieza_asignaciones').update({ activo: false }).eq('id', id) } catch {}
    return { error: null }
  }

  return { asignaciones, loading: false, crearAsignacion, eliminarAsignacion, refetch, pullFromSupabase }
}

export { pullFromSupabase, pushToSupabase }
