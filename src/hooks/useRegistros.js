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
  const [registros, setRegistros] = useState(getCached)
  const [regError, setRegError]   = useState('')

  const refetch = useCallback(() => setRegistros(getCached()), [])

  useEffect(() => {
    pullRegistros().then(ok => { if (ok) refetch() })
  }, [fecha, refetch])

  async function marcarEntrada(asignacion_id) {
    setRegError('')
    const cached = getCached()
    if (cached.find(r => r.asignacion_id === asignacion_id)) return

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
    const existing = cached.find(r => r.asignacion_id === asignacion_id)

    const record = existing
      ? { ...existing, hora_salida: new Date().toISOString(), completado: true, notas }
      : { id: genId(), asignacion_id, hora_entrada: new Date().toISOString(), hora_salida: new Date().toISOString(), completado: true, notas }

    const { error } = await supabase.from('limpieza_registros').upsert(record)
    if (error) { setRegError('No se pudo registrar la salida: ' + error.message); return }

    setCached(existing
      ? cached.map(r => r.asignacion_id === asignacion_id ? record : r)
      : [...cached, record]
    )
    refetch()
  }

  function getRegistroPorAsignacion(asignacion_id) {
    return registros.find(r => r.asignacion_id === asignacion_id) || null
  }

  return { registros, loading: false, regError, marcarEntrada, marcarSalida, getRegistroPorAsignacion, refetch, pullRegistros }
}
