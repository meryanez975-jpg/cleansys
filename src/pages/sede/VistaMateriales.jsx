import { useState, useEffect } from 'react'
import { materialesDeSede, guardarMaterial, eliminarMaterial } from '../../lib/sedes'
import { hoyIso, diasEntre, fechaCorta } from './fechas'

const UNIDADES = ['unidad', 'litros', 'kg', 'paquete', 'rollo', 'caja']
const VACIO = { nombre: '', cantidad: '1', unidad: 'unidad', fechaCompra: '', fechaFin: '', fechaReposicion: '' }

// Estado de un material según sus fechas
function estado(m) {
  const hoy = hoyIso()
  if (m.fechaReposicion && m.fechaReposicion <= hoy) return { txt: '⚠️ Reponer', color: '#b91c1c', bg: '#fee2e2' }
  if (m.fechaFin) return { txt: '✓ Terminado', color: '#475569', bg: '#e2e8f0' }
  if (m.fechaCompra) return { txt: '🟢 En uso', color: '#15803d', bg: '#dcfce7' }
  return { txt: 'Sin fechas', color: '#64748b', bg: '#f1f5f9' }
}

// Materiales de la sede: qué tienen, cuánto, cuánto les dura y la reposición
export default function VistaMateriales({ sesion }) {
  const [lista, setLista]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm]         = useState(null)   // { id, ...datos }
  const [borrar, setBorrar]     = useState(null)
  const [error, setError]       = useState('')

  async function cargar() {
    try { setLista(await materialesDeSede(sesion.sede.id)); setError('') }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  async function guardar(e) {
    e.preventDefault()
    if (form.fechaFin && form.fechaCompra && form.fechaFin < form.fechaCompra) { setError('La fecha de fin no puede ser antes del inicio.'); return }
    const { id, ...datos } = form
    setError('')
    try { await guardarMaterial(sesion.token, id || null, datos); setForm(null); await cargar() }
    catch (err) { setError(err.message) }
  }

  async function confirmarBorrar() {
    const m = borrar
    setBorrar(null)
    try { await eliminarMaterial(sesion.token, m.id); await cargar() }
    catch (err) { setError(err.message) }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>⚠️ {error}</p>}

      {!form && (
        <button className="btn btn-primary btn-block" style={{ marginBottom: 14 }} onClick={() => setForm({ ...VACIO, fechaCompra: hoyIso() })}>
          ➕ Agregar material
        </button>
      )}

      {form && (
        <form className="card" onSubmit={guardar} style={{ marginBottom: 14 }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{form.id ? '✏️ Editar material' : '➕ Nuevo material'}</p>
          <div className="input-group">
            <label className="input-label">Material</label>
            <input className="input" placeholder="Ej: Jabón líquido" value={form.nombre} autoFocus onChange={e => set('nombre', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Cantidad</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} />
              <select className="input" style={{ flex: 1, minWidth: 0 }} value={form.unidad} onChange={e => set('unidad', e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Inicio (cuándo se empezó a usar)</label>
            <input type="date" className="input" value={form.fechaCompra || ''} onChange={e => set('fechaCompra', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Fin (cuándo se terminó) — opcional</label>
            <input type="date" className="input" min={form.fechaCompra || undefined} value={form.fechaFin || ''} onChange={e => set('fechaFin', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Próxima reposición — opcional</label>
            <input type="date" className="input" value={form.fechaReposicion || ''} onChange={e => set('fechaReposicion', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!form.nombre.trim()}>Guardar</button>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {cargando ? (
        [1, 2].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12, marginBottom: 10 }} />)
      ) : lista.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 16 }}>Todavía no hay materiales cargados.</p>
      ) : lista.map(m => {
        const e = estado(m)
        const duro = m.fechaCompra && m.fechaFin ? diasEntre(m.fechaCompra, m.fechaFin) : null
        const enUso = m.fechaCompra && !m.fechaFin ? diasEntre(m.fechaCompra, hoyIso()) : null
        return (
          <div key={m.id} className="card" style={{ marginBottom: 10 }}>
            <div className="flex-between" style={{ marginBottom: 6 }}>
              <p style={{ fontWeight: 800, fontSize: 15 }}>🧴 {m.nombre} <span className="text-muted" style={{ fontWeight: 600, fontSize: 13 }}>· {m.cantidad} {m.unidad}</span></p>
              <span style={{ fontSize: 11, fontWeight: 700, color: e.color, background: e.bg, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>{e.txt}</span>
            </div>
            <p style={{ fontSize: 13 }}>▶️ Inicio: {m.fechaCompra ? fechaCorta(m.fechaCompra) : '—'}</p>
            <p style={{ fontSize: 13 }}>⏹️ Fin: {m.fechaFin ? fechaCorta(m.fechaFin) : '—'}</p>
            {duro !== null && <p style={{ fontSize: 13, fontWeight: 700 }}>⏱️ Duró {duro} día{duro !== 1 ? 's' : ''}</p>}
            {enUso !== null && <p style={{ fontSize: 13 }}>⏱️ En uso hace {enUso} día{enUso !== 1 ? 's' : ''}</p>}
            <p style={{ fontSize: 13 }}>🔁 Reposición: {m.fechaReposicion ? fechaCorta(m.fechaReposicion) : '—'}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setForm({ ...VACIO, ...m })}>✏️ Editar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setBorrar(m)}>🗑️ Eliminar</button>
            </div>
          </div>
        )
      })}

      {borrar && (
        <div className="modal-overlay" onClick={() => setBorrar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">¿Eliminar {borrar.nombre}?</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarBorrar}>Sí, eliminar</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setBorrar(null)}>No</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
