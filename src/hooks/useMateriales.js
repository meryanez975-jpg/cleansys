import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

const LS_MAT = 'cleansys_materiales'
const LS_CAM = 'cleansys_cambios_materiales'

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

export function useMateriales() {
  const [materiales, setMateriales] = useState(() => lsGet(LS_MAT))
  const [cambios, setCambios]       = useState(() => lsGet(LS_CAM))
  const [loading, setLoading]       = useState(true)

  const refetch = useCallback(async () => {
    const [{ data: mats }, { data: cams }] = await Promise.all([
      supabase.from('limpieza_materiales').select('*').eq('activo', true).order('nombre'),
      supabase.from('limpieza_cambios_materiales').select('*').order('fecha'),
    ])
    if (mats) { setMateriales(mats); lsSet(LS_MAT, mats) }
    if (cams) { setCambios(cams);    lsSet(LS_CAM, cams) }
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  async function agregar(nombre, sector, cantidad, unidad, fechaCompra, fechaReposicion, foto) {
    const nuevo = {
      id: genId(), nombre: nombre.trim(), sector: sector || '',
      cantidad: String(cantidad), unidad: unidad || 'unidad',
      fechaCompra: fechaCompra || null, fechaReposicion: fechaReposicion || null,
      foto: foto || null, activo: true,
    }
    const updated = [...materiales, nuevo]
    setMateriales(updated)
    lsSet(LS_MAT, updated)
    await supabase.from('limpieza_materiales').insert(nuevo)
    await refetch()
  }

  async function editar(id, datos) {
    const row = {
      nombre: datos.nombre?.trim() || '',
      sector: datos.sector || '',
      cantidad: String(datos.cantidad || ''),
      unidad: datos.unidad || 'unidad',
      fechaCompra: datos.fechaCompra || null,
      fechaReposicion: datos.fechaReposicion || null,
      foto: datos.foto || null,
    }
    const updated = materiales.map(m => m.id === id ? { ...m, ...row } : m)
    setMateriales(updated)
    lsSet(LS_MAT, updated)
    await supabase.from('limpieza_materiales').update(row).eq('id', id)
    await refetch()
  }

  async function eliminar(id) {
    const updated = materiales.filter(m => m.id !== id)
    setMateriales(updated)
    lsSet(LS_MAT, updated)
    await supabase.from('limpieza_materiales').update({ activo: false }).eq('id', id)
  }

  async function registrarCambio(material_id, materialNombre, fecha) {
    const nuevo = {
      id: genId(), material_id,
      materialNombre: materialNombre || '',
      fecha: fecha || new Date().toISOString().split('T')[0],
      registrado_en: new Date().toISOString(),
    }
    const updated = [...cambios, nuevo]
    setCambios(updated)
    lsSet(LS_CAM, updated)
    await supabase.from('limpieza_cambios_materiales').insert(nuevo)
    await refetch()
  }

  async function eliminarCambio(id) {
    const updated = cambios.filter(c => c.id !== id)
    setCambios(updated)
    lsSet(LS_CAM, updated)
    await supabase.from('limpieza_cambios_materiales').delete().eq('id', id)
  }

  return { materiales, cambios, loading, agregar, editar, eliminar, registrarCambio, eliminarCambio, refetch }
}
