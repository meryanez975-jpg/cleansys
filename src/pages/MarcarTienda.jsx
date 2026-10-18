import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase } from '../supabase/client'
import { usarManifiestoTienda } from '../lib/sedes'
import Registro from './Registro'

// /marcar/:slug — el celular fijo de la tienda, sin contraseña:
// el personal de esa tienda marca entrada, tareas y salida.
export default function MarcarTienda() {
  const { slug } = useParams()
  const [tienda, setTienda] = useState(undefined)   // undefined = cargando, null = no existe

  useEffect(() => {
    usarManifiestoTienda(slug, 'marcar')
    const guardada = (() => { try { return JSON.parse(localStorage.getItem(`cleansys_tienda_${slug}`)) } catch { return null } })()
    supabase.from('limpieza_sedes').select('id, nombre, slug, activo').eq('slug', slug).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setTienda(guardada || null); return }   // sin internet: la última que se guardó
        const t = data?.activo ? data : null
        setTienda(t)
        try { if (t) localStorage.setItem(`cleansys_tienda_${slug}`, JSON.stringify(t)) } catch {}
      })
  }, [slug])

  if (tienda === undefined) {
    return <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}><p className="text-muted" style={{ textAlign: 'center' }}>Cargando…</p></div>
  }
  if (!tienda) {
    return (
      <Aviso icono="🏬" titulo="Tienda no encontrada"
        texto="Este link no es de ninguna tienda activa. Pedile el link correcto a la encargada." />
    )
  }
  return <Registro tienda={tienda} />
}

// Link anterior (/tienda/:slug/marcar): lleva al nuevo
export function MarcarViejo() {
  const { slug } = useParams()
  return <Navigate to={`/marcar/${slug}`} replace />
}

// La página general /registro ya no se usa
export function RegistroCerrado() {
  return (
    <Aviso icono="🧹" titulo="Ahora cada tienda tiene su link"
      texto="Para marcar tu limpieza usá el celular de tu tienda, o pedile a la encargada el link para marcar de tu tienda." />
  )
}

function Aviso({ icono, titulo, texto }) {
  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: 360, textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, background: 'var(--primary-light)', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 34,
        }}>{icono}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{titulo}</h2>
        <p className="text-muted" style={{ fontSize: 15 }}>{texto}</p>
      </div>
    </div>
  )
}
