import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'
import * as store from '../data/store'

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

// Sync bidireccional: baja de Supabase y sube las locales que faltan
async function pullFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('limpieza_asignaciones')
      .select('*')
    if (error) return false

    const remoteIds = new Set((data || []).map(a => a.id))
    const existing = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')

    // Subir a Supabase las asignaciones locales que no están en Supabase
    const localOnly = existing.filter(a => !remoteIds.has(a.id) && a.activo !== false)
    if (localOnly.length > 0) {
      await supabase.from('limpieza_asignaciones').upsert(
        localOnly.map(a => ({
          id: a.id,
          personal_id: a.personal_id,
          zona_id: a.zona_id || null,
          turno: a.turno,
          fecha: a.fecha,
          personalNombre: a.personalNombre || '',
          personalSector: a.personalSector || '',
          activo: a.activo !== false,
        }))
      )
    }

    // Bajar todo de Supabase y guardar en localStorage
    const { data: all } = await supabase
      .from('limpieza_asignaciones')
      .select('*')
      .eq('activo', true)
    if (all) {
      // Preservar asignaciones locales que no llegaron a Supabase (push fallido)
      const remoteDownloadedIds = new Set(all.map(a => a.id))
      const stillLocal = existing.filter(a => !remoteDownloadedIds.has(a.id) && a.activo !== false)
      localStorage.setItem('cleansys_asignaciones', JSON.stringify([...all, ...stillLocal]))
    }
    return true
  } catch (e) {
    console.warn('pullFromSupabase error:', e)
    return false
  }
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
