import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase/client'
import { pullFromSupabase } from '../hooks/useAsignaciones'
import { pullRegistros } from '../hooks/useRegistros'

function formatMesLargo(anio, mes) {
  return new Date(anio, mes, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}
function formatFecha(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}
function formatHora(isoStr) {
  if (!isoStr) return null
  return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
function duracion(entrada, salida) {
  if (!entrada || !salida) return null
  const mins = Math.round((new Date(salida) - new Date(entrada)) / 60000)
  if (mins <= 0) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
function fechaISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function getLunesDeHoy() {
  const hoy = new Date(); const d = hoy.getDay()
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() + (d === 0 ? -6 : 1 - d)); lunes.setHours(0,0,0,0)
  return lunes
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function getPrimerLunesDeMes(anio, mes) {
  const primero = new Date(anio, mes, 1)
  const dia = primero.getDay()
  const offset = dia === 0 ? 1 : dia === 1 ? 0 : 8 - dia
  const lunes = new Date(anio, mes, 1 + offset)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}
function formatSemana(lunes) {
  const dom = addDays(lunes, 6)
  const opts = { day: 'numeric', month: 'short' }
  return `${lunes.toLocaleDateString('es-AR', opts)} — ${dom.toLocaleDateString('es-AR', opts)}`
}

export default function HistorialPersonal() {
  const navigate = useNavigate()
  const now = new Date()

  const [histMes, setHistMes]   = useState(now.getMonth())
  const [histAnio, setHistAnio] = useState(now.getFullYear())
  const [lunesSemana, setLunesSemana] = useState(getLunesDeHoy)
  const [selId, setSelId]           = useState(null)
  const [categoriaFiltro, setCategoriaFiltro] = useState(null)
  const [filtroZona, setFiltroZona] = useState(null)
  const [personalSupabase, setPersonalSupabase] = useState([])
  const [loadingPersonal, setLoadingPersonal]   = useState(true)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deletingZona, setDeletingZona] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1))

    const id = setInterval(() => {
      Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1))
    }, 30_000)

    function handleVisibilidad() {
      if (!document.hidden) {
        Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilidad)

    const channel = supabase
      .channel('historial-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'limpieza_asignaciones' },
        () => { Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1)) }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'limpieza_registros' },
        () => { Promise.all([pullFromSupabase(), pullRegistros()]).then(() => setTick(t => t + 1)) }
      )
      .subscribe()

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', handleVisibilidad)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    supabase.from('com_personal').select('id, nombre, sector, turno').neq('activo', false).order('nombre')
      .then(({ data, error }) => {
        if (error) console.error('HistorialPersonal personal:', error)
        else if (data) setPersonalSupabase(data)
      })
      .catch(err => console.error('HistorialPersonal personal:', err))
      .finally(() => setLoadingPersonal(false))
  }, [])

  function mesAnterior() {
    if (histMes === 0) { setHistMes(11); setHistAnio(y => y - 1) }
    else setHistMes(m => m - 1)
    setSelId(null)
  }
  function mesSiguiente() {
    if (histMes === 11) { setHistMes(0); setHistAnio(y => y + 1) }
    else setHistMes(m => m + 1)
    setSelId(null)
  }

  const { allAsigs, allRegs, allZonas } = useMemo(() => {
    try {
      return {
        allAsigs: JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]').filter(a => a.activo !== false),
        allRegs:  JSON.parse(localStorage.getItem('cleansys_registros') || '[]'),
        allZonas: JSON.parse(localStorage.getItem('cleansys_zonas') || '[]'),
      }
    } catch { return { allAsigs: [], allRegs: [], allZonas: [] } }
  }, [histMes, histAnio, tick])

  function eliminarTodo() {
    localStorage.removeItem('cleansys_asignaciones')
    localStorage.removeItem('cleansys_registros')
    setTick(t => t + 1)
    setSelId(null)
    setShowConfirmDelete(false)
  }

  async function eliminarZona() {
    if (!filtroZona) return
    setDeletingZona(true)
    try {
      const asigIds = allAsigs
        .filter(a => a.zona_id === filtroZona)
        .map(a => a.id)

      if (asigIds.length > 0) {
        await supabase.from('limpieza_registros').delete().in('asignacion_id', asigIds)
        await supabase.from('limpieza_asignaciones').update({ activo: false }).in('id', asigIds)
      }

      const nuevasAsigs = JSON.parse(localStorage.getItem('cleansys_asignaciones') || '[]')
        .map(a => a.zona_id === filtroZona ? { ...a, activo: false } : a)
      localStorage.setItem('cleansys_asignaciones', JSON.stringify(nuevasAsigs))

      const nuevosRegs = JSON.parse(localStorage.getItem('cleansys_registros') || '[]')
        .filter(r => !asigIds.includes(r.asignacion_id))
      localStorage.setItem('cleansys_registros', JSON.stringify(nuevosRegs))

      setTick(t => t + 1)
      setShowConfirmDelete(false)
    } catch (e) {
      console.error('eliminarZona error:', e)
    } finally {
      setDeletingZona(false)
    }
  }

  const fechasSemana = Array.from({ length: 7 }, (_, i) => fechaISO(addDays(lunesSemana, i)))

  function enPeriodo(fecha) {
    if (filtroZona) return fechasSemana.includes(fecha)
    return fecha.startsWith(`${histAnio}-${String(histMes + 1).padStart(2, '0')}-`)
  }

  function asigsFiltradas(personal_id) {
    return allAsigs
      .filter(a => {
        if (a.personal_id !== personal_id) return false
        if (!enPeriodo(a.fecha)) return false
        if (filtroZona && a.zona_id !== filtroZona) return false
        return true
      })
      .map(a => ({
        ...a,
        zona: allZonas.find(z => z.id === a.zona_id) || null,
        registro: allRegs.find(r => r.asignacion_id === a.id) || null,
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }

  function categoriaDe(p) {
    const asigs = asigsFiltradas(p.id)
    if (asigs.length === 0) return 'sinAsignacion'
    return asigs.some(a => a.registro?.completado) ? 'cumplieron' : 'noCumplieron'
  }

  const personalFiltrado = personalSupabase.filter(p => {
    if (categoriaFiltro && categoriaDe(p) !== categoriaFiltro) return false
    if (filtroZona) {
      const tieneZona = allAsigs.some(a => a.personal_id === p.id && a.zona_id === filtroZona && enPeriodo(a.fecha))
      if (!tieneZona) return false
    }
    return true
  })

  const labelPeriodo = filtroZona ? formatSemana(lunesSemana) : formatMesLargo(histAnio, histMes)

  return (
    <>
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>←</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Historial del personal</p>
            <p className="header-sub" style={{ textTransform: 'capitalize' }}>{labelPeriodo}</p>
          </div>
        </div>

        {/* Navegador — mes si no hay zona, semana si hay zona */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card)', border: '1.5px solid var(--border)',
          borderRadius: 12, padding: '10px 8px', marginBottom: 12,
        }}>
          <button
            onClick={() => { filtroZona ? setLunesSemana(d => addDays(d, -7)) : mesAnterior(); setSelId(null) }}
            style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 20 }}
          >‹</button>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', textTransform: 'capitalize' }}>
              {labelPeriodo}
            </span>
            {filtroZona && (
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>📆 Vista por semana</p>
            )}
          </div>
          <button
            onClick={() => { filtroZona ? setLunesSemana(d => addDays(d, 7)) : mesSiguiente(); setSelId(null) }}
            style={{ background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', color: 'var(--primary-dark)', fontWeight: 700, fontSize: 20 }}
          >›</button>
        </div>

        {/* Selector de zona */}
        {/* Selector de zona como dropdown */}
        <select
          value={filtroZona || ''}
          onChange={e => { setFiltroZona(e.target.value || null); setSelId(null); setCategoriaFiltro(null); setLunesSemana(getPrimerLunesDeMes(histAnio, histMes)) }}
          style={{
            width: '100%', padding: '12px 14px', marginBottom: 12,
            borderRadius: 10, border: '1.5px solid var(--border)',
            background: 'var(--bg-card)', color: 'var(--text)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            appearance: 'none', WebkitAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
          }}
        >
          <option value=''>🏢 Filtrar por zona...</option>
          {allZonas.filter(z => z.activo !== false).map(z => (
            <option key={z.id} value={z.id}>🏢 {z.nombre}</option>
          ))}
        </select>

        {/* Chips de categoría — solo visibles si hay zona seleccionada */}
        {filtroZona && <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[
            { key: 'cumplieron',   label: '✅ Cumplieron',    color: '#15803d', bg: '#dcfce7', border: '#86efac' },
            { key: 'noCumplieron', label: '❌ No cumplieron', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
          ].map(({ key, label, color, bg, border }) => {
            const activo = categoriaFiltro === key
            return (
              <button
                key={key}
                onClick={() => { setCategoriaFiltro(activo ? null : key); setSelId(null) }}
                style={{
                  flex: 1, padding: '9px 4px', borderRadius: 10, cursor: 'pointer',
                  fontWeight: 700, fontSize: 11, lineHeight: 1.3,
                  border: `2px solid ${activo ? border : 'var(--border)'}`,
                  background: activo ? bg : 'var(--bg-card)',
                  color: activo ? color : 'var(--text)',
                  transition: 'all 0.15s',
                }}
              >{label}</button>
            )
          })}
        </div>}

        {/* Lista plana */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingPersonal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12, opacity: 1 - i * 0.1 }} />
              ))}
            </div>
          )}
          {!loadingPersonal && !filtroZona && (
            <div style={{
              textAlign: 'center', padding: '40px 24px',
              background: 'var(--bg-card)', borderRadius: 16,
              border: '1.5px dashed var(--border)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, margin: '0 auto 16px',
              }}>📋</div>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
                Elegí una zona
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Seleccioná una zona arriba para ver quién limpió.<br />Después podés filtrar por ✅ ❌ ➖
              </p>
            </div>
          )}
          {!loadingPersonal && filtroZona && (() => {
            const DIAS_NOMBRE = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
            const dias = fechasSemana.map((fecha, i) => {
              const asigsDia = allAsigs
                .filter(a => a.fecha === fecha && a.zona_id === filtroZona && a.activo !== false)
                .map(a => ({
                  ...a,
                  persona:  personalSupabase.find(p => p.id === a.personal_id) || null,
                  registro: allRegs.find(r => r.asignacion_id === a.id) || null,
                }))
              return {
                nombre: DIAS_NOMBRE[i],
                fecha,
                manana: asigsDia.find(a => a.turno === 'mañana') || null,
                noche:  asigsDia.find(a => a.turno !== 'mañana') || null,
              }
            })

            function slotOk(asig) {
              if (!categoriaFiltro) return true
              if (!asig) return false
              return categoriaFiltro === 'cumplieron' ? !!asig.registro?.completado : !asig.registro?.completado
            }

            function Slot({ asig, label, emoji }) {
              if (!asig) {
                if (categoriaFiltro) return null
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--bg)', border: '1.5px dashed var(--border)',
                    borderRadius: 8, padding: '8px 12px', opacity: 0.45,
                  }}>
                    <span style={{ fontSize: 14 }}>{emoji}</span>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label} · sin asignación</p>
                  </div>
                )
              }
              if (!slotOk(asig)) return null
              const completado = asig.registro?.completado
              const entrada = asig.registro?.hora_entrada
              const salida  = asig.registro?.hora_salida
              const tiempo  = duracion(entrada, salida)
              const notas   = asig.registro?.notas
              return (
                <div style={{
                  background: completado ? '#f0fdf4' : '#fff1f2',
                  border: `1.5px solid ${completado ? '#bbf7d0' : '#fecdd3'}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{completado ? '✅' : '❌'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                        {asig.persona?.nombre || '—'}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {emoji} {label}{asig.persona?.sector ? ` · ${asig.persona.sector}` : ''}
                      </p>
                    </div>
                    {entrada && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: completado ? '#15803d' : '#64748b' }}>
                          {formatHora(entrada)} → {salida ? formatHora(salida) : '…'}
                        </p>
                        {tiempo && (
                          <p style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginTop: 1 }}>
                            ⏱ {tiempo}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {notas && (
                    <p style={{
                      fontSize: 11, color: '#475569', marginTop: 8,
                      paddingTop: 7, borderTop: `1px solid ${completado ? '#bbf7d0' : '#fecdd3'}`,
                    }}>
                      📝 {notas}
                    </p>
                  )}
                </div>
              )
            }

            const diasVisibles = dias.filter(d => !categoriaFiltro || slotOk(d.manana) || slotOk(d.noche))

            if (diasVisibles.length === 0) return (
              <p className="text-muted text-center" style={{ padding: 20 }}>Sin resultados</p>
            )

            const zonaSeleccionada = allZonas.find(z => z.id === filtroZona)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {diasVisibles.map(dia => (
                  <div key={dia.fecha}>
                    <p style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--text)',
                      textTransform: 'capitalize', marginBottom: 6,
                      paddingBottom: 5, borderBottom: '1.5px solid var(--border)',
                    }}>
                      {dia.nombre} · {new Date(dia.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Slot asig={dia.manana} label="Mañana" emoji="☀️" />
                      <Slot asig={dia.noche}  label="Noche"  emoji="🌙" />
                    </div>
                  </div>
                ))}

                {/* Botón eliminar solo esta zona */}
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  style={{
                    marginTop: 8, width: '100%', padding: '11px 0',
                    borderRadius: 10, border: '1.5px solid #fecaca',
                    background: '#fff1f2', color: '#dc2626',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  🗑️ Eliminar datos de {zonaSeleccionada?.nombre || 'esta zona'}
                </button>
              </div>
            )
          })()}
        </div>

      </div>
    </div>

    {/* Modal confirmar eliminar zona */}
    {showConfirmDelete && (() => {
      const zonaSeleccionada = allZonas.find(z => z.id === filtroZona)
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(30,58,95,0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setShowConfirmDelete(false)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 16, padding: '28px 24px',
            width: '100%', maxWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginBottom: 8 }}>
              Eliminar datos de {zonaSeleccionada?.nombre || 'esta zona'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Se borrarán todas las asignaciones y registros de limpieza de la zona <strong>{zonaSeleccionada?.nombre}</strong>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={eliminarZona}
                disabled={deletingZona}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 10,
                  cursor: deletingZona ? 'not-allowed' : 'pointer',
                  background: deletingZona ? '#fca5a5' : '#dc2626', border: 'none',
                  color: '#fff', fontWeight: 700, fontSize: 15,
                }}
              >
                {deletingZona ? '⏳ Eliminando...' : `Sí, eliminar ${zonaSeleccionada?.nombre || ''}`}
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                  background: 'var(--bg)', border: '1.5px solid var(--border)',
                  color: 'var(--text)', fontWeight: 700, fontSize: 14,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )
    })()}
    </>
  )
}
