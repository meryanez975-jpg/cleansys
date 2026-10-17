import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersonal, normalizarNombre } from '../hooks/usePersonal'

// Solo lectura: el personal se da de alta, edita y da de baja en MenuSoft (Comidas).
// Los botones Agregar/Editar/Borrar de antes llamaban funciones que ya no existían.
export default function GestionPersonal() {
  const navigate = useNavigate()
  const { personal, loading, error } = usePersonal()
  const [busqueda, setBusqueda] = useState('')

  const filtrado = personal.filter(p =>
    normalizarNombre(p.nombre).includes(normalizarNombre(busqueda))
  )

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="header">
          <button className="header-back" onClick={() => navigate('/asignacion')}>‹</button>
          <div style={{ flex: 1 }}>
            <p className="header-title">Personal</p>
            <p className="header-sub">{personal.length} persona{personal.length !== 1 ? 's' : ''} registrada{personal.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
          El personal se agrega y edita desde Comidas (MenuSoft).
        </p>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
            {personal.length > 0
              ? '⚠️ Sin conexión — mostrando la última lista guardada'
              : '⚠️ Sin conexión — reintentando cargar el personal…'}
          </p>
        )}

        {/* Buscador */}
        {personal.length > 0 && (
          <input
            className="input"
            placeholder="Buscar persona..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ marginBottom: 12 }}
          />
        )}

        {/* Lista */}
        {loading ? (
          <p className="text-muted text-center" style={{ padding: 20 }}>Cargando personal…</p>
        ) : personal.length === 0 ? (
          <div className="card text-center" style={{ padding: 40 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>👥</p>
            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Sin personal cargado</p>
            <p className="text-muted">Agregá personal desde Comidas (MenuSoft)</p>
          </div>
        ) : filtrado.length === 0 ? (
          <p className="text-muted text-center" style={{ padding: 20 }}>Sin resultados</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtrado.map(p => (
              <div key={p.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--primary)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 17,
                  }}>
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{p.nombre.trim()}</p>
                    {p.sector && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.sector}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
