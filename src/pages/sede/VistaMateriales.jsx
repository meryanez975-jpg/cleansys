import { useState, useEffect } from 'react'
import { materialesDeSede, guardarMaterial, eliminarMaterial, comprasDeSede, registrarCompra, eliminarCompra } from '../../lib/sedes'
import { hoyIso, diasEntre, sumarDias, fechaCorta } from './fechas'

const UNIDADES = ['unidad', 'rollo', 'litro', 'kg', 'bolsa', 'botella', 'caja']
const bs = n => (n == null || isNaN(n) ? '—' : `Bs ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const num = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))

// Cálculos de una compra
const totalUnidades = c => Number(c.paquetes) * Number(c.unidades_por_paquete)
const totalCompra   = c => (c.precio_paquete == null ? null : Number(c.paquetes) * Number(c.precio_paquete))
const costoUnidad   = c => (c.precio_paquete == null ? null : Number(c.precio_paquete) / Number(c.unidades_por_paquete))

// Cuánto dura: promedio de días entre compras; con eso, la próxima compra
function resumenMaterial(compras) {
  const ordenadas = [...compras].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultima = ordenadas[ordenadas.length - 1] || null
  const tramos = ordenadas.slice(1).map((c, i) => diasEntre(ordenadas[i].fecha, c.fecha)).filter(d => d > 0)
  const dura = tramos.length ? Math.round(tramos.reduce((s, d) => s + d, 0) / tramos.length) : null
  const proxima = ultima && dura ? sumarDias(ultima.fecha, dura) : null
  return { ultima, dura, proxima }
}

function estado({ ultima, proxima }) {
  const hoy = hoyIso()
  if (!ultima) return { txt: 'Sin compras', color: '#64748b', bg: '#f1f5f9', borde: '#e2e8f0' }
  if (!proxima) return { txt: '🆕 Primera compra', color: '#1d4ed8', bg: '#dbeafe', borde: '#bfdbfe' }
  if (proxima <= hoy) return { txt: '🔴 Reponer', color: '#b91c1c', bg: '#fee2e2', borde: '#fecaca' }
  if (proxima <= sumarDias(hoy, 3)) return { txt: '🟡 Pronto', color: '#a16207', bg: '#fef9c3', borde: '#fde68a' }
  return { txt: '🟢 Hay', color: '#15803d', bg: '#dcfce7', borde: '#bbf7d0' }
}

// Excel (.csv que Excel abre directo): todas las compras y el total por material
function descargarExcel(sede, materiales, compras) {
  const nombre = id => materiales.find(m => m.id === id)?.nombre || 'Material'
  const unidad = id => materiales.find(m => m.id === id)?.unidad || 'unidad'
  const n = v => (v == null ? '' : Number(v).toFixed(2).replace('.', ','))
  const celda = t => `"${String(t ?? '').replace(/"/g, '""')}"`
  const filas = [['Fecha', 'Material', 'Paquetes', 'Unidades por paquete', 'Total unidades', 'Unidad', 'Precio paquete (Bs)', 'Total (Bs)', 'Costo por unidad (Bs)', 'Nota']]
  ;[...compras].sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(c => filas.push([
    c.fecha, nombre(c.material_id), n(c.paquetes), n(c.unidades_por_paquete), n(totalUnidades(c)), unidad(c.material_id),
    n(c.precio_paquete), n(totalCompra(c)), n(costoUnidad(c)), c.nota || '',
  ]))
  filas.push([], ['Resumen por material', 'Compras', 'Paquetes', '', 'Total unidades', '', '', 'Total gastado (Bs)', 'Costo promedio por unidad (Bs)'])
  materiales.forEach(m => {
    const cs = compras.filter(c => c.material_id === m.id)
    if (!cs.length) return
    const paq = cs.reduce((s, c) => s + Number(c.paquetes), 0)
    const uni = cs.reduce((s, c) => s + totalUnidades(c), 0)
    const conPrecio = cs.filter(c => c.precio_paquete != null)
    const gasto = conPrecio.reduce((s, c) => s + totalCompra(c), 0)
    const uniConPrecio = conPrecio.reduce((s, c) => s + totalUnidades(c), 0)
    filas.push([m.nombre, cs.length, n(paq), '', n(uni), m.unidad, '', n(gasto), uniConPrecio ? n(gasto / uniConPrecio) : ''])
  })
  const total = compras.filter(c => c.precio_paquete != null).reduce((s, c) => s + totalCompra(c), 0)
  filas.push([], ['TOTAL GASTADO', '', '', '', '', '', '', n(total)])
  const csv = '﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `materiales-${sede.slug || 'tienda'}-${hoyIso()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Materiales de la tienda: cada uno con su historial de compras, cuánto cuesta y cuánto dura
export default function VistaMateriales({ sesion }) {
  const [materiales, setMateriales] = useState([])
  const [compras, setCompras]       = useState([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState('')
  const [guardado, setGuardado]     = useState('')
  const [nuevo, setNuevo]           = useState(null)   // material nuevo con su primera compra
  const [comprando, setComprando]   = useState(null)   // { material, ...datos de la compra }
  const [editando, setEditando]     = useState(null)   // { material, nombre, unidad }
  const [historial, setHistorial]   = useState(null)   // id del material abierto
  const [borrar, setBorrar]         = useState(null)

  const sede = sesion.sede

  async function cargar() {
    try {
      const [m, c] = await Promise.all([materialesDeSede(sede.id), comprasDeSede(sede.id)])
      setMateriales(m); setCompras(c); setError('')
    } catch (err) { setError(err.message) } finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  function avisarGuardado(txt) {
    setGuardado(txt)
    setTimeout(() => setGuardado(''), 2500)
  }

  const comprasDe = id => compras.filter(c => c.material_id === id)
  const mes = hoyIso().slice(0, 7)
  const gastoMes = compras.filter(c => c.fecha.startsWith(mes) && c.precio_paquete != null).reduce((s, c) => s + totalCompra(c), 0)

  // "Se compró hoy": se llena con la última compra para solo confirmar
  function abrirCompra(m) {
    const u = resumenMaterial(comprasDe(m.id)).ultima
    setComprando({ material: m, fecha: hoyIso(), paquetes: u ? String(u.paquetes) : '1',
      unidades_por_paquete: u ? String(u.unidades_por_paquete) : '1', precio_paquete: u?.precio_paquete != null ? String(u.precio_paquete) : '', nota: '' })
    setError('')
  }

  const datosCompra = c => ({ fecha: c.fecha, paquetes: num(c.paquetes), unidades_por_paquete: num(c.unidades_por_paquete), precio_paquete: num(c.precio_paquete), nota: c.nota })
  const compraValida = c => num(c.paquetes) > 0 && num(c.unidades_por_paquete) > 0 && (c.precio_paquete === '' || num(c.precio_paquete) >= 0) && !!c.fecha

  async function guardarCompra(e) {
    e.preventDefault()
    try {
      await registrarCompra(sesion.token, comprando.material.id, datosCompra(comprando))
      setComprando(null); await cargar(); avisarGuardado('✅ Compra guardada')
    } catch (err) { setError(err.message) }
  }

  async function crearMaterial(e) {
    e.preventDefault()
    try {
      const m = await guardarMaterial(sesion.token, null, { nombre: nuevo.nombre, unidad: nuevo.unidad, cantidad: '' })
      if (nuevo.conCompra) await registrarCompra(sesion.token, m.id, datosCompra(nuevo))
      setNuevo(null); await cargar(); avisarGuardado('✅ Material guardado')
    } catch (err) { setError(err.message) }
  }

  async function guardarEdicion(e) {
    e.preventDefault()
    const m = editando.material
    try {
      await guardarMaterial(sesion.token, m.id, {
        nombre: editando.nombre, unidad: editando.unidad, cantidad: m.cantidad || '',
        fechaCompra: m.fechaCompra || '', fechaFin: m.fechaFin || '', fechaReposicion: m.fechaReposicion || '',
      })
      setEditando(null); await cargar(); avisarGuardado('✅ Guardado')
    } catch (err) { setError(err.message) }
  }

  async function confirmarBorrar() {
    const b = borrar
    setBorrar(null)
    try {
      if (b.tipo === 'material') await eliminarMaterial(sesion.token, b.item.id)
      else await eliminarCompra(sesion.token, b.item.id)
      await cargar(); avisarGuardado('✅ Eliminado')
    } catch (err) { setError(err.message) }
  }

  // Campos de una compra (se usan al crear el material y en "Se compró hoy")
  function camposCompra(c, set, unidad) {
    const total = num(c.paquetes) * num(c.precio_paquete)
    const porUnidad = num(c.precio_paquete) / num(c.unidades_por_paquete)
    return (
      <>
        <div className="input-group">
          <label className="input-label">Fecha de compra</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" className="input" style={{ flex: 1 }} value={c.fecha} onChange={e => set('fecha', e.target.value)} />
            <button type="button" className={`btn ${c.fecha === hoyIso() ? 'btn-primary' : 'btn-outline'}`} onClick={() => set('fecha', hoyIso())}>
              {c.fecha === hoyIso() ? '✓ Hoy' : 'Hoy'}
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="input-group">
            <label className="input-label">Paquetes</label>
            <input className="input" inputMode="decimal" value={c.paquetes} onChange={e => set('paquetes', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">{unidad}s por paquete</label>
            <input className="input" inputMode="decimal" value={c.unidades_por_paquete} onChange={e => set('unidades_por_paquete', e.target.value)} />
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">Precio de cada paquete (Bs) — opcional</label>
          <input className="input" inputMode="decimal" placeholder="Ej: 25" value={c.precio_paquete} onChange={e => set('precio_paquete', e.target.value)} />
        </div>
        <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
          <p>📦 {num(c.paquetes) || 0} paquete{num(c.paquetes) !== 1 ? 's' : ''} × {num(c.unidades_por_paquete) || 0} = <strong>{(num(c.paquetes) || 0) * (num(c.unidades_por_paquete) || 0)} {unidad}s</strong></p>
          {c.precio_paquete !== '' && !isNaN(total) && (
            <p>💰 Total: <strong>{bs(total)}</strong> · Cada {unidad}: <strong>{isFinite(porUnidad) ? bs(porUnidad) : '—'}</strong></p>
          )}
        </div>
        <div className="input-group">
          <label className="input-label">Nota — opcional</label>
          <input className="input" placeholder="Ej: comprado en el mercado" value={c.nota} onChange={e => set('nota', e.target.value)} />
        </div>
      </>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}

      {/* Resumen y Excel */}
      <div className="card flex-between" style={{ marginBottom: 12, gap: 10 }}>
        <div>
          <p className="text-muted" style={{ fontSize: 12 }}>Gastado este mes</p>
          <p style={{ fontWeight: 800, fontSize: 20, color: 'var(--primary-dark)' }}>{bs(gastoMes)}</p>
        </div>
        <button className="btn btn-outline btn-sm" disabled={!compras.length} onClick={() => descargarExcel(sede, materiales, compras)}>📥 Descargar Excel</button>
      </div>

      {cargando ? (
        [1, 2].map(i => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 12, marginBottom: 10 }} />)
      ) : materiales.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay materiales. Tocá ＋ abajo a la derecha.</p>
      ) : materiales.map(m => {
        const cs = comprasDe(m.id)
        const r = resumenMaterial(cs)
        const e = estado(r)
        const u = r.ultima
        return (
          <div key={m.id} className="card" style={{ marginBottom: 10, borderLeft: `5px solid ${e.color}` }}>
            <div className="flex-between" style={{ marginBottom: 8, gap: 8 }}>
              <p style={{ fontWeight: 800, fontSize: 16 }}>🧴 {m.nombre} <span className="text-muted" style={{ fontWeight: 600, fontSize: 12 }}>· por {m.unidad}</span></p>
              <span style={{ fontSize: 12, fontWeight: 800, color: e.color, background: e.bg, border: `1px solid ${e.borde}`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{e.txt}</span>
            </div>

            {u ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px' }}>
                  <p className="text-muted" style={{ fontSize: 11 }}>🛒 Última compra</p>
                  <p style={{ fontWeight: 700, fontSize: 13, textTransform: 'capitalize' }}>{fechaCorta(u.fecha)}</p>
                  <p style={{ fontSize: 12 }}>{Number(u.paquetes)} paq. × {Number(u.unidades_por_paquete)} = {totalUnidades(u)} {m.unidad}s</p>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px' }}>
                  <p className="text-muted" style={{ fontSize: 11 }}>💰 Costo</p>
                  <p style={{ fontWeight: 700, fontSize: 13 }}>{bs(totalCompra(u))}</p>
                  <p style={{ fontSize: 12 }}>Cada {m.unidad}: {bs(costoUnidad(u))}</p>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px' }}>
                  <p className="text-muted" style={{ fontSize: 11 }}>⏱️ Dura aprox.</p>
                  <p style={{ fontWeight: 700, fontSize: 13 }}>{r.dura ? `${r.dura} día${r.dura !== 1 ? 's' : ''}` : '—'}</p>
                  <p style={{ fontSize: 12 }}>{r.dura ? 'entre compras' : 'falta otra compra'}</p>
                </div>
                <div style={{ background: e.bg, borderRadius: 10, padding: '8px 10px' }}>
                  <p className="text-muted" style={{ fontSize: 11 }}>🔁 Próxima compra</p>
                  <p style={{ fontWeight: 800, fontSize: 13, color: e.color, textTransform: 'capitalize' }}>{r.proxima ? fechaCorta(r.proxima) : '—'}</p>
                  <p style={{ fontSize: 12 }}>{cs.length} compra{cs.length !== 1 ? 's' : ''} en total</p>
                </div>
              </div>
            ) : <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>Todavía no tiene compras registradas.</p>}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => abrirCompra(m)}>🛒 Se compró hoy</button>
              {cs.length > 0 && <button className="btn btn-outline btn-sm" onClick={() => setHistorial(h => h === m.id ? null : m.id)}>📜 Historial ({cs.length}) {historial === m.id ? '▲' : '▼'}</button>}
              <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => setEditando({ material: m, nombre: m.nombre, unidad: m.unidad || 'unidad' })}>✏️</button>
              <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => setBorrar({ tipo: 'material', item: m })}>🗑️</button>
            </div>

            {historial === m.id && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                {cs.map(c => (
                  <div key={c.id} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                    <div style={{ fontSize: 12 }}>
                      <p style={{ fontWeight: 700, textTransform: 'capitalize' }}>{fechaCorta(c.fecha)}</p>
                      <p>{Number(c.paquetes)} paq. × {Number(c.unidades_por_paquete)} · {bs(c.precio_paquete)} c/u = <strong>{bs(totalCompra(c))}</strong></p>
                      {c.nota && <p className="text-muted">📝 {c.nota}</p>}
                    </div>
                    <button className="btn btn-ghost btn-sm" title="Borrar esta compra" onClick={() => setBorrar({ tipo: 'compra', item: c })}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Aviso de guardado */}
      {guardado && (
        <div style={{ position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', zIndex: 300,
          background: '#15803d', color: '#fff', fontWeight: 800, padding: '10px 18px', borderRadius: 999, boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}>
          {guardado}
        </div>
      )}

      {/* Botón flotante: material nuevo */}
      <button aria-label="Nuevo material" title="Nuevo material" onClick={() => {
        setNuevo({ nombre: '', unidad: 'unidad', conCompra: true, fecha: hoyIso(), paquetes: '1', unidades_por_paquete: '1', precio_paquete: '', nota: '' }); setError('')
      }} style={{
        position: 'fixed', right: 18, bottom: 22, zIndex: 95, width: 56, height: 56, borderRadius: '50%',
        border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 28, cursor: 'pointer', boxShadow: '0 6px 18px rgba(59,130,246,0.4)',
      }}>＋</button>

      {nuevo && (
        <div className="modal-overlay" onClick={() => setNuevo(null)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={crearMaterial} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <p className="modal-title">➕ Nuevo material</p>
            <div className="input-group">
              <label className="input-label">Material</label>
              <input className="input" placeholder="Ej: Papel higiénico" value={nuevo.nombre} autoFocus onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Se cuenta por</label>
              <select className="input" value={nuevo.unidad} onChange={e => setNuevo(n => ({ ...n, unidad: e.target.value }))}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 14, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={nuevo.conCompra} onChange={e => setNuevo(n => ({ ...n, conCompra: e.target.checked }))} />
              Registrar la compra ahora
            </label>
            {nuevo.conCompra && camposCompra(nuevo, (k, v) => setNuevo(n => ({ ...n, [k]: v })), nuevo.unidad)}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!nuevo.nombre.trim() || (nuevo.conCompra && !compraValida(nuevo))}>💾 Guardar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setNuevo(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {comprando && (
        <div className="modal-overlay" onClick={() => setComprando(null)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={guardarCompra} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <p className="modal-title">🛒 Compra de {comprando.material.nombre}</p>
            <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>Viene con los datos de la última compra: cambiá solo lo que sea distinto.</p>
            {camposCompra(comprando, (k, v) => setComprando(c => ({ ...c, [k]: v })), comprando.material.unidad || 'unidad')}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!compraValida(comprando)}>💾 Guardar compra</button>
              <button type="button" className="btn btn-ghost" onClick={() => setComprando(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={guardarEdicion}>
            <p className="modal-title">✏️ Editar material</p>
            <div className="input-group">
              <label className="input-label">Material</label>
              <input className="input" value={editando.nombre} autoFocus onChange={e => setEditando(x => ({ ...x, nombre: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Se cuenta por</label>
              <select className="input" value={editando.unidad} onChange={e => setEditando(x => ({ ...x, unidad: e.target.value }))}>
                {[...new Set([...UNIDADES, editando.unidad])].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!editando.nombre.trim()}>💾 Guardar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {borrar && (
        <div className="modal-overlay" onClick={() => setBorrar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">
              {borrar.tipo === 'material' ? `¿Eliminar ${borrar.item.nombre}?` : `¿Borrar la compra del ${fechaCorta(borrar.item.fecha)}?`}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarBorrar}>Sí, eliminar</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setBorrar(null)}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
