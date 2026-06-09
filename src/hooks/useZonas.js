import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

export function useZonas() {
  const [zonas, setZonas] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('limpieza_zonas')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    if (!error && data) {
      setZonas(data)
      // Cachear en localStorage para que store.js resuelva nombres de zona en asignaciones
      try { localStorage.setItem('cleansys_zonas', JSON.stringify(data)) } catch {}
    }
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  async function crearZona(nombre) {
    const { error } = await supabase
      .from('limpieza_zonas')
      .insert({ id: genId(), nombre: nombre.trim(), activo: true })
    if (!error) await refetch()
    return { error: error?.message || null }
  }

  async function editarZona(id, nombre) {
    const { error } = await supabase
      .from('limpieza_zonas')
      .update({ nombre: nombre.trim() })
      .eq('id', id)
    if (!error) await refetch()
    return { error: error?.message || null }
  }

  async function desactivarZona(id) {
    const { error } = await supabase
      .from('limpieza_zonas')
      .update({ activo: false })
      .eq('id', id)
    if (!error) await refetch()
    return { error: error?.message || null }
  }

  async function updateTareas(id, tareas) {
    const { error } = await supabase
      .from('limpieza_zonas')
      .update({ tareas })
      .eq('id', id)
    if (!error) await refetch()
    return { error: error?.message || null }
  }

  return { zonas, loading, crearZona, editarZona, desactivarZona, updateTareas, refetch }
}
