import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

function getCached() {
  try { return JSON.parse(localStorage.getItem('cleansys_registros') || '[]') } catch { return [] }
}
function setCached(data) {
  localStorage.setItem('cleansys_registros', JSON.stringify(data))
}

export async function pullRegistros() {
  try {
    const { data, error } = await supabase.from('limpieza_registros').select('*')
    if (error || !data) return false
    setCached(data)
    return true
  } catch (e) {
    console.warn('pullRegistros error:', e)
    return false
  }
}

export function useRegistros(fecha) {
  const [registros, setRegistros] = useState([])
  const [regError, setRegError]   = useState('')

  const refetch = useCallback(() => setRegistros(getCached()), [])

  useEffect(() => {
    pullRegistros().then(ok => { if (ok) refetch() })
  }, [fecha, refetch])

  async function marcarEntrada(asignacion_id) {
    setRegError('')
    const cached = getCached()
    // Solo bloquear si ya hay una sesión activa (sin hora_salida)
    if (cached.find(r => r.asignacion_id === asignacion_id && !r.hora_salida)) return

    const nuevo = {
      id: genId(),
      asignacion_id,
      hora_entrada: new Date().toISOString(),
      hora_salida:  null,
      completado:   false,
      notas:        '',
    }
    const { error } = await supabase.from('limpieza_registros').upsert(nuevo)
    if (error) { setRegError('No se pudo registrar la entrada: ' + error.message); return }

    setCached([...cached, nuevo])
    refetch()
  }

  async function marcarSalida(asignacion_id, notas = '') {
    setRegError('')
    const cached   = getCached()
    // Buscar la sesión activa (la que no tiene hora_salida)
    const existing = cached.find(r => r.asignacion_id === asignacion_id && !r.hora_salida)

    const record = existing
      ? { ...existing, hora_salida: new Date().toISOString(), completado: true, notas }
      : { id: genId(), asignacion_id, hora_entrada: new Date().toISOString(), hora_salida: new Date().toISOString(), completado: true, notas }

    const { error } = await supabase.from('limpieza_registros').upsert(record)
    if (error) { setRegError('No se pudo registrar la salida: ' + error.message); return }

    // Actualizar solo el registro por id (no por asignacion_id, pueden ser varios)
    setCached(existing
      ? cached.map(r => r.id === existing.id ? record : r)
      : [...cached, record]
    )
    refetch()
  }

  function getRegistroPorAsignacion(asignacion_id) {
    // Retorna la sesión más reciente
    const todos = registros.filter(r => r.asignacion_id === asignacion_id)
    if (!todos.length) return null
    return todos.reduce((a, b) => ((a.hora_entrada || '') > (b.hora_entrada || '') ? a : b))
  }

  function getAllRegistrosPorAsignacion(asignacion_id) {
    return registros
      .filter(r => r.asignacion_id === asignacion_id)
      .sort((a, b) => (a.hora_entrada || '').localeCompare(b.hora_entrada || ''))
  }

  return { registros, loading: false, regError, marcarEntrada, marcarSalida, getRegistroPorAsignacion, getAllRegistrosPorAsignacion, refetch, pullRegistros }
}
