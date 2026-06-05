import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

export function usePersonal() {
  const [personal, setPersonal] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('com_personal')
      .select('id, nombre, sector, turno, activo')
      .eq('activo', true)
      .order('nombre')

    if (!error && data) {
      // Migrar personal que solo existe en localStorage → Supabase
      const localPersonal = (() => {
        try { return JSON.parse(localStorage.getItem('cleansys_personal') || '[]').filter(p => p.activo !== false) }
        catch { return [] }
      })()
      const remoteIds = new Set(data.map(p => p.id))
      const soloLocal = localPersonal.filter(p => !remoteIds.has(p.id))
      if (soloLocal.length > 0) {
        await supabase.from('com_personal').upsert(
          soloLocal.map(p => ({
            id:     p.id,
            nombre: p.nombre,
            sector: p.sector || '',
            turno:  p.turno  || null,
            activo: true,
          }))
        )
        // Re-leer después de migrar
        const { data: updated } = await supabase
          .from('com_personal').select('id, nombre, sector, turno, activo')
          .eq('activo', true).order('nombre')
        const final = updated || data
        setPersonal(final)
        try { localStorage.setItem('cleansys_personal', JSON.stringify(final)) } catch {}
        setLoading(false)
        return
      }

      setPersonal(data)
      try { localStorage.setItem('cleansys_personal', JSON.stringify(data)) } catch {}
    }
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  async function agregar(nombre, sector, turno = null) {
    const { error } = await supabase
      .from('com_personal')
      .insert({ id: genId(), nombre: nombre.trim(), sector: sector.trim(), turno, activo: true })
    if (!error) await refetch()
    return { error: error?.message || null }
  }

  async function editar(id, nombre, sector, turno = null) {
    const { error } = await supabase
      .from('com_personal')
      .update({ nombre: nombre.trim(), sector: sector.trim(), turno })
      .eq('id', id)
    if (!error) await refetch()
    return { error: error?.message || null }
  }

  async function eliminar(id) {
    const { error } = await supabase
      .from('com_personal')
      .update({ activo: false })
      .eq('id', id)
    if (!error) await refetch()
    return { error: error?.message || null }
  }

  return { personal, loading, agregar, editar, eliminar, refetch }
}
