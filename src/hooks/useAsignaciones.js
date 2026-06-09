import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'
import * as store from '../data/store'

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

// Descarga de Supabase — Supabase es la fuente de verdad
async function pullFromSupabase() {
  try {
    const [{ data: activos, error }, { data: zonas }] = await Promise.all([
      supabase.from('limpieza_asignaciones').select('*').eq('activo', true),
      supabase.from('limpieza_zonas').select('*').eq('activo', true),
    ])
    if (error) return false
    if (activos) {
      localStorage.setItem('cleansys_asignaciones', JSON.stringify(activos))
    }
    if (zonas) {
      try { localStorage.setItem('cleansys_zonas', JSON.stringify(zonas)) } catch {}
    }
    return true
  } catch (e) {
    console.warn('pullFromSupabase error:', e)
    return false
  }
}

// Mantenido para compatibilidad con SemanaPlan
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
    console.warn('pushToSupabase error:', e)
  }
}

export function useAsignaciones(fecha) {
  const [asignaciones, setAsignaciones] = useState(() => store.getAsignaciones(fecha))
  const [syncing, setSyncing] = useState(false)

  const refetch = useCallback(() => {
    setAsignaciones(store.getAsignaciones(fecha))
  }, [fecha])

  useEffect(() => {
    setSyncing(true)
    pullFromSupabase().then(ok => { if (ok) refetch(); setSyncing(false) })
  }, [fecha, refetch])

  async function sincronizar() {
    setSyncing(true)
    const ok = await pullFromSupabase()
    if (ok) refetch()
    setSyncing(false)
  }

  async function crearAsignacion(personal_id, zona_id, turno, personalNombre = '', personalSector = '') {
    // Verificar duplicado en caché local
    const cached = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
    const yaExiste = cached.find(a =>
      a.personal_id === personal_id && a.turno === turno && a.fecha === fecha && a.activo !== false
    )
    if (yaExiste) return { error: 'Esta persona ya está asignada en este turno' }

    const nueva = {
      id: genId(),
      personal_id,
      zona_id: zona_id || null,
      turno,
      fecha,
      personalNombre: personalNombre || '',
      personalSector: personalSector || '',
      activo: true,
    }

    const { error } = await supabase.from('limpieza_asignaciones').upsert(nueva, { onConflict: 'personal_id,fecha,turno' })
    if (error) return { error: error.message }

    // Actualizar caché local
    localStorage.setItem('cleansys_asignaciones', JSON.stringify([...cached, nueva]))
    refetch()
    return { error: null }
  }

  async function eliminarAsignacion(id) {
    const { error } = await supabase.from('limpieza_asignaciones').update({ activo: false }).eq('id', id)
    if (error) return { error: error.message }

    const cached = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
    localStorage.setItem('cleansys_asignaciones', JSON.stringify(
      cached.map(a => a.id === id ? { ...a, activo: false } : a)
    ))
    refetch()
    return { error: null }
  }

  return { asignaciones, loading: syncing, sincronizar, crearAsignacion, eliminarAsignacion, refetch, pullFromSupabase }
}

export { pullFromSupabase, pushToSupabase }
