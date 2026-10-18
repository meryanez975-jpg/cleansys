import { useState, useEffect } from 'react'
import { materialesDeSede, guardarMaterial, eliminarMaterial, movimientosDeSede, registrarMovimiento, eliminarMovimiento, editarMovimiento } from '../../lib/sedes'
import { hoyIso, diasEntre, sumarDias, fechaCorta } from './fechas'

// Unidades en que se cuenta cada producto: [singular, plural]
const UNIDADES = {
  unidad: ['unidad', 'unidades'], rollo: ['rollo', 'rollos'], paquete: ['paquete', 'paquetes'],
  litro: ['litro', 'litros'], ml: ['ml', 'ml'], kg: ['kg', 'kg'], gramo: ['g', 'g'],
  metro: ['metro', 'metros'], bolsa: ['bolsa', 'bolsas'], botella: ['botella', 'botellas'], caja: ['caja', 'cajas'],
}
const nUnidad = (u, n) => { const x = UNIDADES[u] || [u || 'unidad', u || 'unidades']; return Number(n) === 1 ? x[0] : x[1] }
const fmt = n => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('es-BO', { maximumFractionDigits: 2 }))
const num = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))
const VENTANA_DIAS = 60   // el consumo se calcula con lo usado en los últimos 60 días

// Todo lo que se calcula de un producto a partir de sus movimientos
function calcular(movs) {
  const hoy = hoyIso()
  const entradas = movs.filter(m => m.tipo === 'entrada').sort((a, b) => a.fecha.localeCompare(b.fecha))
  const salidas  = movs.filter(m => m.tipo === 'salida')
  const hay = entradas.reduce((s, m) => s + Number(m.cantidad), 0) - salidas.reduce((s, m) => s + Number(m.cantidad), 0)

  const ultima = entradas[entradas.length - 1] || null
  const conPrecio = entradas.filter(e => e.precio_paquete != null)
  const precioUnidad = e => (e ? Number(e.precio_paquete) / Number(e.unidades_por_paquete) : null)
  const precioActual = conPrecio.length ? precioUnidad(conPrecio[conPrecio.length - 1]) : null
  const precioAntes  = conPrecio.length > 1 ? precioUnidad(conPrecio[conPrecio.length - 2]) : null

  // Consumo por día (lo usado en la ventana / días desde el primer uso, mínimo 7)
  const desde = sumarDias(hoy, -VENTANA_DIAS)
  const recientes = salidas.filter(s => s.fecha >= desde)
  let porDia = null
  if (recientes.length) {
    const primero = recientes.reduce((m, s) => (s.fecha < m ? s.fecha : m), hoy)
    porDia = recientes.reduce((s, m) => s + Number(m.cantidad), 0) / Math.max(7, diasEntre(primero, hoy) + 1)
  }
  const diasQuedan = porDia ? hay / porDia : null
  const seAcaba = diasQuedan != null ? sumarDias(hoy, Math.max(0, Math.floor(diasQuedan))) : null
  const duraPaquete = porDia && ultima ? Number(ultima.unidades_por_paquete) / porDia : null
  const tramos = entradas.slice(1).map((e, i) => diasEntre(entradas[i].fecha, e.fecha)).filter(d => d > 0)
  const cadaCuanto = tramos.length ? Math.round(tramos.reduce((s, d) => s + d, 0) / tramos.length) : null
  return { hay, ultima, precioActual, precioAntes, porDia, diasQuedan, seAcaba, duraPaquete, cadaCuanto }
}

function estado(c, minimo) {
  if (c.hay <= 0) return { txt: 'Se acabó', color: '#b91c1c', bg: '#fee2e2' }
  if ((minimo != null && c.hay <= minimo) || (c.diasQuedan != null && c.diasQuedan <= 3)) return { txt: 'Casi no queda', color: '#b91c1c', bg: '#fee2e2' }
  if ((minimo != null && c.hay <= minimo * 2) || (c.diasQuedan != null && c.diasQuedan <= 7)) return { txt: 'Queda poco', color: '#a16207', bg: '#fef9c3' }
  return { txt: 'Hay', color: '#15803d', bg: '#dcfce7' }
}

// Excel (.csv que Excel abre directo): inventario de hoy y todos los movimientos
function archivoExcel(sede, productos, todos) {
  const movs = todos.filter(m => !m.eliminado_en)   // lo eliminado no cuenta en el inventario ni en los totales
  const n = v => (v == null || isNaN(v) ? '' : Number(v).toFixed(2).replace('.', ','))
  const celda = t => `"${String(t ?? '').replace(/"/g, '""')}"`
  const filas = [[`Inventario ${sede.nombre} al ${hoyIso()}`], ['Producto', 'Unidad', 'Hay', 'Precio por unidad (Bs)', 'Se usa por día', 'Se acaba aprox.', 'Se compra cada (días)']]
  productos.forEach(p => {
    const c = calcular(movs.filter(m => m.material_id === p.id))
    filas.push([p.nombre, p.unidad, n(c.hay), n(c.precioActual), n(c.porDia), c.seAcaba || '', c.cadaCuanto ?? ''])
  })
  const hora = t => (t ? new Date(t).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '')
  const cuando = t => (t ? `${new Date(t).toLocaleDateString('es-BO')} ${hora(t)}` : '')
  const nombreDe = id => productos.find(x => x.id === id)?.nombre || '(producto eliminado)'
  const unidadDe = id => productos.find(x => x.id === id)?.unidad || ''
  filas.push([], ['Movimientos'], ['Fecha', 'Hora', 'Producto', 'Tipo', 'Cantidad', 'Unidad', 'Paquetes', 'Por paquete', 'Precio paquete (Bs)', 'Total (Bs)', 'Nota', 'Estado'])
  ;[...todos].sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(m => {
    const estado = m.eliminado_en ? `ELIMINADO el ${cuando(m.eliminado_en)}` : m.editado_en ? `Editado el ${cuando(m.editado_en)}` : 'Vigente'
    filas.push([m.fecha, hora(m.creado), nombreDe(m.material_id), m.tipo === 'entrada' ? 'Compra' : 'Uso', n(m.cantidad), unidadDe(m.material_id),
      n(m.paquetes), n(m.unidades_por_paquete), n(m.precio_paquete),
      m.precio_paquete != null && m.paquetes != null ? n(m.precio_paquete * m.paquetes) : '', m.nota || '', estado])
  })
  // Lo que tenía cada movimiento antes de editarlo
  const conCambios = todos.filter(m => (m.cambios || []).length)
  if (conCambios.length) {
    filas.push([], ['Cambios (cómo estaba antes de editar)'], ['Cambiado el', 'Producto', 'Tipo', 'Fecha que tenía', 'Cantidad que tenía', 'Paquetes', 'Por paquete', 'Precio paquete (Bs)', 'Nota que tenía'])
    conCambios.forEach(m => (m.cambios || []).forEach(c => filas.push([
      cuando(c.cambiado_en), nombreDe(m.material_id), m.tipo === 'entrada' ? 'Compra' : 'Uso', c.fecha, n(c.cantidad),
      n(c.paquetes), n(c.unidades_por_paquete), n(c.precio_paquete), c.nota || '',
    ])))
  }
  const total = movs.filter(m => m.tipo === 'entrada' && m.precio_paquete != null).reduce((s, m) => s + m.precio_paquete * m.paquetes, 0)
  const mes = hoyIso().slice(0, 7)
  const totalMes = movs.filter(m => m.tipo === 'entrada' && m.precio_paquete != null && m.fecha.startsWith(mes)).reduce((s, m) => s + m.precio_paquete * m.paquetes, 0)
  filas.push([], ['GASTADO ESTE MES', '', '', '', '', '', '', '', '', n(totalMes)], ['TOTAL GASTADO', '', '', '', '', '', '', '', '', n(total)])
  const csv = '\ufeff' + filas.map(f => f.map(celda).join(';')).join('\r\n')
  const nombre = `inventario-${sede.slug || 'tienda'}-${hoyIso()}.csv`
  return new File([csv], nombre, { type: 'text/csv' })
}

// Descarga que funciona también en celulares y en la app instalada
function descargar(archivo) {
  const url = URL.createObjectURL(archivo)
  const a = document.createElement('a')
  a.href = url
  a.download = archivo.name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

// Resumen en texto para WhatsApp (cuando el celular no deja adjuntar el archivo)
function textoResumen(sede, productos, todos) {
  const movs = todos.filter(m => !m.eliminado_en)
  const lineas = productos.map(p => {
    const c = calcular(movs.filter(m => m.material_id === p.id))
    return `• ${p.nombre}: ${fmt(c.hay)} ${nUnidad(p.unidad, c.hay)}${c.seAcaba && c.hay > 0 ? ` (se acaba aprox. ${fechaCorta(c.seAcaba)})` : ''}`
  })
  return `📦 Inventario ${sede.nombre} — ${fechaCorta(hoyIso())}\n${lineas.join('\n')}`
}

// Compartir el Excel: menú del celular (WhatsApp, correo…) con el archivo adjunto
async function compartirExcel(sede, productos, movs) {
  const archivo = archivoExcel(sede, productos, movs)
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: archivo.name, text: `Inventario ${sede.nombre}` })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return   // se canceló el menú de compartir
    }
  }
  // Sin compartir archivos: se descarga y se abre WhatsApp con el resumen
  descargar(archivo)
  window.open(`https://wa.me/?text=${encodeURIComponent(textoResumen(sede, productos, movs) + '\n\n(El Excel se descargó en el celular: adjuntalo desde Descargas)')}`, '_blank')
}

const Stepper = ({ valor, onCambiar, paso = 1 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <button type="button" className="btn btn-outline" style={{ width: 44 }} onClick={() => onCambiar(String(Math.max(0, (num(valor) || 0) - paso)))}>−</button>
    <input className="input" inputMode="decimal" style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, flex: 1, minWidth: 0 }}
      value={valor} onChange={e => onCambiar(e.target.value)} />
    <button type="button" className="btn btn-outline" style={{ width: 44 }} onClick={() => onCambiar(String((num(valor) || 0) + paso))}>＋</button>
  </div>
)

// Inventario de la tienda: cuánto hay de cada producto, se agrega lo que se
// compra y se descuenta lo que se usa
export default function VistaInventario({ sesion }) {
  const [productos, setProductos] = useState([])
  const [movs, setMovs]           = useState([])
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [aviso, setAviso]         = useState('')
  const [buscar, setBuscar]       = useState('')
  const [abierto, setAbierto]     = useState(null)   // { producto, modo: 'menu' | 'agregar' | 'usar' | 'historial' | 'editar', ...form }
  const [nuevo, setNuevo]         = useState(null)
  const [borrar, setBorrar]       = useState(null)

  const sede = sesion.sede

  async function cargar() {
    try {
      const [p, m] = await Promise.all([materialesDeSede(sede.id), movimientosDeSede(sede.id)])
      setProductos(p); setMovs(m); setError('')
    } catch (err) { setError(err.message) } finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  function avisar(txt) { setAviso(txt); setTimeout(() => setAviso(''), 2500) }

  const movsDe = id => movs.filter(m => m.material_id === id && !m.eliminado_en)
  const lista = productos.filter(p => p.nombre.toLowerCase().includes(buscar.trim().toLowerCase()))

  function abrir(p, modo = 'menu') {
    const u = calcular(movsDe(p.id)).ultima
    setAbierto({
      producto: p, modo, fecha: hoyIso(), nota: '',
      paquetes: '1', unidades_por_paquete: u ? String(Number(u.unidades_por_paquete)) : '1',
      precio_paquete: '', conPrecio: false,
      cantidad: '1', nombre: p.nombre, unidad: p.unidad || 'unidad', minimo: p.minimo != null ? String(p.minimo) : '',
    })
    setError('')
  }
  const setA = (k, v) => setAbierto(a => ({ ...a, [k]: v }))

  async function guardarMovimiento(e) {
    e.preventDefault()
    const a = abierto
    try {
      if (a.modo === 'agregar') {
        await registrarMovimiento(sesion.token, a.producto.id, {
          tipo: 'entrada', fecha: a.fecha, paquetes: num(a.paquetes), unidades_por_paquete: num(a.unidades_por_paquete),
          precio_paquete: num(a.precio_paquete), nota: a.nota,
        })
        avisar(`✅ Se agregaron ${fmt(num(a.paquetes) * num(a.unidades_por_paquete))} ${nUnidad(a.producto.unidad, 2)}`)
      } else {
        await registrarMovimiento(sesion.token, a.producto.id, { tipo: 'salida', fecha: a.fecha, cantidad: num(a.cantidad), nota: a.nota })
        avisar(`✅ Se descontaron ${fmt(num(a.cantidad))} ${nUnidad(a.producto.unidad, num(a.cantidad))}`)
      }
      setAbierto(null); await cargar()
    } catch (err) { setError(err.message) }
  }

  function abrirEdicion(m) {
    setAbierto(x => ({
      ...x, modo: 'editarMov', mov: m, fecha: m.fecha, nota: m.nota || '',
      cantidad: String(Number(m.cantidad)),
      paquetes: m.paquetes != null ? String(Number(m.paquetes)) : '1',
      unidades_por_paquete: m.unidades_por_paquete != null ? String(Number(m.unidades_por_paquete)) : '1',
      precio_paquete: m.precio_paquete != null ? String(Number(m.precio_paquete)) : '',
      conPrecio: m.precio_paquete != null,
    }))
    setError('')
  }

  async function guardarEdicionMov(e) {
    e.preventDefault()
    const x = abierto
    try {
      await editarMovimiento(sesion.token, x.mov.id, x.mov.tipo === 'entrada'
        ? { fecha: x.fecha, paquetes: num(x.paquetes), unidades_por_paquete: num(x.unidades_por_paquete), precio_paquete: num(x.precio_paquete), nota: x.nota }
        : { fecha: x.fecha, cantidad: num(x.cantidad), nota: x.nota })
      await cargar()
      setAbierto(y => ({ ...y, modo: 'historial' }))
      avisar('✅ Corregido (queda registrado en el Excel)')
    } catch (err) { setError(err.message) }
  }

  async function guardarEdicion(e) {
    e.preventDefault()
    try {
      await guardarMaterial(sesion.token, abierto.producto.id, { nombre: abierto.nombre, unidad: abierto.unidad, minimo: num(abierto.minimo) })
      setAbierto(null); await cargar(); avisar('✅ Guardado')
    } catch (err) { setError(err.message) }
  }

  async function crear(e) {
    e.preventDefault()
    try {
      const p = await guardarMaterial(sesion.token, null, { nombre: nuevo.nombre, unidad: nuevo.unidad, minimo: num(nuevo.minimo) })
      if (nuevo.conStock) {
        await registrarMovimiento(sesion.token, p.id, {
          tipo: 'entrada', fecha: hoyIso(), paquetes: num(nuevo.paquetes), unidades_por_paquete: num(nuevo.unidades_por_paquete), precio_paquete: num(nuevo.precio_paquete),
        })
      }
      setNuevo(null); await cargar(); avisar('✅ Producto agregado')
    } catch (err) { setError(err.message) }
  }

  async function confirmarBorrar() {
    const b = borrar
    setBorrar(null)
    try {
      if (b.tipo === 'producto') { await eliminarMaterial(sesion.token, b.item.id); setAbierto(null) }
      else await eliminarMovimiento(sesion.token, b.item.id)
      await cargar(); avisar('✅ Eliminado')
    } catch (err) { setError(err.message) }
  }

  // Campos de una compra: paquetes, cuánto trae cada uno y el precio
  function camposCompra(f, set, unidad) {
    const total = (num(f.paquetes) || 0) * (num(f.unidades_por_paquete) || 0)
    return (
      <>
        <div className="input-group">
          <label className="input-label">¿Cuántos paquetes?</label>
          <Stepper valor={f.paquetes} onCambiar={v => set('paquetes', v)} />
        </div>
        <div className="input-group">
          <label className="input-label">Cada paquete trae ({nUnidad(unidad, 2)})</label>
          <input className="input" inputMode="decimal" value={f.unidades_por_paquete} onChange={e => set('unidades_por_paquete', e.target.value)} />
        </div>
        <div style={{ background: '#dcfce7', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 14 }}>
          ➕ <strong>{fmt(total)} {nUnidad(unidad, total)}</strong>
        </div>
        {/* El precio es opcional: solo se pone cuando hace falta (se ve en el Excel) */}
        {f.conPrecio ? (
          <div className="input-group">
            <label className="input-label">Precio de cada paquete (Bs)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 1 }} inputMode="decimal" placeholder="Ej: 25" value={f.precio_paquete} autoFocus onChange={e => set('precio_paquete', e.target.value)} />
              <button type="button" className="btn btn-ghost" onClick={() => { set('precio_paquete', ''); set('conPrecio', false) }}>✕</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => set('conPrecio', true)}>💰 Agregar precio (opcional)</button>
        )}
      </>
    )
  }

  const a = abierto
  const ca = a ? calcular(movsDe(a.producto.id)) : null

  return (
    <div style={{ paddingBottom: 80 }}>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}

      <div className="card" style={{ marginBottom: 10 }}>
        <p className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>El Excel trae todo: cantidades, fechas, horas y lo gastado.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" disabled={!productos.length} onClick={() => { descargar(archivoExcel(sede, productos, movs)); avisar('📥 Excel descargado') }}>📥 Descargar Excel</button>
          <button className="btn btn-sm" disabled={!productos.length} onClick={() => compartirExcel(sede, productos, movs)}
            style={{ background: '#25d366', color: '#fff', border: 'none', fontWeight: 700 }}>💬 Enviar por WhatsApp</button>
        </div>
      </div>

      {productos.length > 4 && (
        <input className="input" placeholder="🔍 Buscar producto…" value={buscar} onChange={e => setBuscar(e.target.value)} style={{ marginBottom: 10 }} />
      )}

      {/* Lista: una fila por producto */}
      {cargando ? (
        [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 58, borderRadius: 12, marginBottom: 8 }} />)
      ) : productos.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay productos. Tocá ＋ abajo a la derecha.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {lista.map((p, i) => {
            const c = calcular(movsDe(p.id))
            const e = estado(c, p.minimo)
            return (
              <button key={p.id} onClick={() => abrir(p)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', cursor: 'pointer',
                background: 'none', border: 'none', borderTop: i ? '1px solid var(--border)' : 'none', textAlign: 'left',
                borderLeft: `5px solid ${e.color}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{p.nombre}</p>
                  {c.seAcaba && c.hay > 0 && (
                    <p className="text-muted" style={{ fontSize: 12 }}>se acaba aprox. {fechaCorta(c.seAcaba)}</p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 800, fontSize: 17, color: e.color }}>{fmt(c.hay)}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{nUnidad(p.unidad, c.hay)}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: e.color, background: e.bg, borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>{e.txt}</span>
              </button>
            )
          })}
        </div>
      )}

      {aviso && (
        <div style={{ position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', zIndex: 300,
          background: '#15803d', color: '#fff', fontWeight: 800, padding: '10px 18px', borderRadius: 999, boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}>
          {aviso}
        </div>
      )}

      <button aria-label="Producto nuevo" title="Producto nuevo" onClick={() => {
        setNuevo({ nombre: '', unidad: 'unidad', minimo: '', conStock: true, paquetes: '1', unidades_por_paquete: '1', precio_paquete: '', conPrecio: false }); setError('')
      }} style={{
        position: 'fixed', right: 18, bottom: 22, zIndex: 95, width: 56, height: 56, borderRadius: '50%',
        border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 28, cursor: 'pointer', boxShadow: '0 6px 18px rgba(59,130,246,0.4)',
      }}>＋</button>

      {/* ── Producto abierto: Agregar / Usar / Historial ── */}
      {a && (
        <div className="modal-overlay" onClick={() => setAbierto(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: 4 }}>
              <p className="modal-title" style={{ margin: 0 }}>{a.producto.nombre}</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setAbierto(null)}>✕</button>
            </div>
            <p style={{ fontSize: 15, marginBottom: 12 }}>
              Hay <strong style={{ color: estado(ca, a.producto.minimo).color, fontSize: 20 }}>{fmt(ca.hay)}</strong> {nUnidad(a.producto.unidad, ca.hay)}
            </p>

            {a.modo === 'menu' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12, fontSize: 12 }}>
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px' }}>
                    <p className="text-muted">📉 Se usa por día</p>
                    <p style={{ fontWeight: 800, fontSize: 14 }}>{ca.porDia ? `${fmt(ca.porDia)} ${nUnidad(a.producto.unidad, ca.porDia)}` : '—'}</p>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px' }}>
                    <p className="text-muted">⏳ Se acaba aprox.</p>
                    <p style={{ fontWeight: 800, fontSize: 14, textTransform: 'capitalize' }}>{ca.seAcaba ? fechaCorta(ca.seAcaba) : '—'}</p>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px' }}>
                    <p className="text-muted">📦 Un paquete dura</p>
                    <p style={{ fontWeight: 800, fontSize: 14 }}>{ca.duraPaquete ? `${fmt(Math.round(ca.duraPaquete))} días` : '—'}</p>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px' }}>
                    <p className="text-muted">🛒 Se compra cada</p>
                    <p style={{ fontWeight: 800, fontSize: 14 }}>{ca.cadaCuanto ? `${ca.cadaCuanto} días` : '—'}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <button className="btn btn-success btn-lg" onClick={() => setA('modo', 'agregar')}>➕ Agregar</button>
                  <button className="btn btn-danger btn-lg" disabled={ca.hay <= 0} onClick={() => setA('modo', 'usar')}>➖ Usar</button>
                </div>
                <button className="btn btn-outline btn-block" onClick={() => setA('modo', 'historial')}>📜 Historial ({movsDe(a.producto.id).length})</button>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setA('modo', 'editar')}>✏️ Editar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setBorrar({ tipo: 'producto', item: a.producto })}>🗑️ Eliminar</button>
                </div>
              </>
            )}

            {(a.modo === 'agregar' || a.modo === 'usar') && (
              <form onSubmit={guardarMovimiento}>
                <p style={{ fontWeight: 800, marginBottom: 10, color: a.modo === 'agregar' ? '#15803d' : '#b91c1c' }}>
                  {a.modo === 'agregar' ? '➕ Agregar (compra)' : '➖ Usar (se descuenta)'}
                </p>
                {a.modo === 'agregar' ? camposCompra(a, setA, a.producto.unidad) : (
                  <>
                    <div className="input-group">
                      <label className="input-label">¿Cuánto se usó? ({nUnidad(a.producto.unidad, 2)})</label>
                      <Stepper valor={a.cantidad} onCambiar={v => setA('cantidad', v)} />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {[0.5, 1, 2, 5].map(v => (
                          <button key={v} type="button" className="btn btn-outline btn-sm" onClick={() => setA('cantidad', String(v))}>{fmt(v)}</button>
                        ))}
                        {ca.ultima && Number(ca.ultima.unidades_por_paquete) !== 1 && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setA('cantidad', String(Number(ca.ultima.unidades_por_paquete)))}>
                            1 paquete ({fmt(ca.ultima.unidades_por_paquete)})
                          </button>
                        )}
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setA('cantidad', String(ca.hay))}>Todo ({fmt(ca.hay)})</button>
                      </div>
                    </div>
                    <div style={{ background: num(a.cantidad) > ca.hay ? '#fee2e2' : '#fef3c7', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 14 }}>
                      {num(a.cantidad) > ca.hay
                        ? <>⚠️ Solo hay <strong>{fmt(ca.hay)}</strong> {nUnidad(a.producto.unidad, ca.hay)}</>
                        : <>Quedan <strong>{fmt(ca.hay - (num(a.cantidad) || 0))}</strong> {nUnidad(a.producto.unidad, ca.hay - (num(a.cantidad) || 0))}</>}
                    </div>
                  </>
                )}
                <div className="input-group">
                  <label className="input-label">Fecha</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" className="input" style={{ flex: 1 }} max={hoyIso()} value={a.fecha} onChange={e => setA('fecha', e.target.value)} />
                    <button type="button" className={`btn ${a.fecha === hoyIso() ? 'btn-primary' : 'btn-outline'}`} onClick={() => setA('fecha', hoyIso())}>
                      {a.fecha === hoyIso() ? '✓ Hoy' : 'Hoy'}
                    </button>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Nota — opcional</label>
                  <input className="input" placeholder={a.modo === 'agregar' ? 'Ej: comprado en el mercado' : 'Ej: para el baño'} value={a.nota} onChange={e => setA('nota', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={
                    a.modo === 'agregar'
                      ? !(num(a.paquetes) > 0 && num(a.unidades_por_paquete) > 0 && (a.precio_paquete === '' || num(a.precio_paquete) >= 0))
                      : !(num(a.cantidad) > 0 && num(a.cantidad) <= ca.hay)
                  }>💾 Guardar</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setA('modo', 'menu')}>‹ Volver</button>
                </div>
              </form>
            )}

            {a.modo === 'historial' && (
              <>
                <p style={{ fontWeight: 800, marginBottom: 8 }}>📜 Historial</p>
                {movsDe(a.producto.id).length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Sin movimientos todavía.</p>}
                {movsDe(a.producto.id).map(m => (
                  <div key={m.id} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                    <div style={{ fontSize: 13 }}>
                      <p style={{ fontWeight: 700, color: m.tipo === 'entrada' ? '#15803d' : '#b91c1c' }}>
                        {m.tipo === 'entrada' ? '➕' : '➖'} {fmt(m.cantidad)} {nUnidad(a.producto.unidad, m.cantidad)}
                        <span className="text-muted" style={{ fontWeight: 500, textTransform: 'capitalize' }}> · {fechaCorta(m.fecha)}</span>
                      </p>
                      {m.tipo === 'entrada' && (
                        <p className="text-muted">{fmt(m.paquetes)} paq. × {fmt(m.unidades_por_paquete)}</p>
                      )}
                      {m.nota && <p className="text-muted">📝 {m.nota}</p>}
                      {m.editado_en && <p className="text-muted" style={{ fontSize: 11 }}>✏️ editado</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => abrirEdicion(m)}>✏️</button>
                      <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => setBorrar({ tipo: 'movimiento', item: m })}>🗑️</button>
                    </div>
                  </div>
                ))}
                <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>Lo que se edita o elimina queda registrado en el Excel.</p>
                <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => setA('modo', 'menu')}>‹ Volver</button>
              </>
            )}

            {a.modo === 'editarMov' && (
              <form onSubmit={guardarEdicionMov}>
                <p style={{ fontWeight: 800, marginBottom: 10 }}>✏️ Corregir {a.mov.tipo === 'entrada' ? 'compra' : 'uso'}</p>
                <div className="input-group">
                  <label className="input-label">Fecha</label>
                  <input type="date" className="input" max={hoyIso()} value={a.fecha} onChange={e => setA('fecha', e.target.value)} />
                </div>
                {a.mov.tipo === 'entrada' ? camposCompra(a, setA, a.producto.unidad) : (
                  <div className="input-group">
                    <label className="input-label">¿Cuánto se usó? ({nUnidad(a.producto.unidad, 2)})</label>
                    <Stepper valor={a.cantidad} onCambiar={v => setA('cantidad', v)} />
                  </div>
                )}
                <div className="input-group">
                  <label className="input-label">Nota — opcional</label>
                  <input className="input" value={a.nota} onChange={e => setA('nota', e.target.value)} />
                </div>
                <p className="text-muted" style={{ fontSize: 11, marginBottom: 10 }}>Lo que tenía antes queda guardado en el Excel.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={
                    a.mov.tipo === 'entrada'
                      ? !(num(a.paquetes) > 0 && num(a.unidades_por_paquete) > 0 && (a.precio_paquete === '' || num(a.precio_paquete) >= 0))
                      : !(num(a.cantidad) > 0)
                  }>💾 Guardar</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setA('modo', 'historial')}>‹ Volver</button>
                </div>
              </form>
            )}

            {a.modo === 'editar' && (
              <form onSubmit={guardarEdicion}>
                <div className="input-group">
                  <label className="input-label">Producto</label>
                  <input className="input" value={a.nombre} onChange={e => setA('nombre', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Se cuenta por</label>
                  <select className="input" value={a.unidad} onChange={e => setA('unidad', e.target.value)}>
                    {[...new Set([...Object.keys(UNIDADES), a.unidad])].map(u => <option key={u} value={u}>{nUnidad(u, 2)}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Avisar cuando queden (opcional)</label>
                  <input className="input" inputMode="decimal" placeholder="Ej: 2" value={a.minimo} onChange={e => setA('minimo', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!a.nombre.trim()}>💾 Guardar</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setA('modo', 'menu')}>‹ Volver</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Producto nuevo ── */}
      {nuevo && (
        <div className="modal-overlay" onClick={() => setNuevo(null)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={crear} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <p className="modal-title">➕ Producto nuevo</p>
            <div className="input-group">
              <label className="input-label">Producto</label>
              <input className="input" placeholder="Ej: Papel higiénico" value={nuevo.nombre} autoFocus onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Se cuenta por</label>
              <select className="input" value={nuevo.unidad} onChange={e => setNuevo(n => ({ ...n, unidad: e.target.value }))}>
                {Object.keys(UNIDADES).map(u => <option key={u} value={u}>{nUnidad(u, 2)}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Avisar cuando queden (opcional)</label>
              <input className="input" inputMode="decimal" placeholder="Ej: 2" value={nuevo.minimo} onChange={e => setNuevo(n => ({ ...n, minimo: e.target.value }))} />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 14, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={nuevo.conStock} onChange={e => setNuevo(n => ({ ...n, conStock: e.target.checked }))} />
              Ya hay de este producto (cargar lo que hay)
            </label>
            {nuevo.conStock && camposCompra(nuevo, (k, v) => setNuevo(n => ({ ...n, [k]: v })), nuevo.unidad)}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}
                disabled={!nuevo.nombre.trim() || (nuevo.conStock && !(num(nuevo.paquetes) > 0 && num(nuevo.unidades_por_paquete) > 0))}>💾 Guardar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setNuevo(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {borrar && (
        <div className="modal-overlay" style={{ zIndex: 400 }} onClick={() => setBorrar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">
              {borrar.tipo === 'producto' ? `¿Eliminar ${borrar.item.nombre} del inventario?` : '¿Borrar este movimiento?'}
            </p>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              {borrar.tipo === 'producto' ? 'Deja de aparecer en la lista.' : 'Deja de contar en el inventario. Queda registrado en el Excel como eliminado.'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarBorrar}>Sí, eliminar</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setBorrar(null)}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
