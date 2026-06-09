import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase/client'

export default function Inicio() {
  const navigate = useNavigate()
  const [zonas, setZonas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('limpieza_zonas').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => { if (data) setZonas(data); setLoading(false) })
  }, [])

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <div className="container">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 76, height: 76, background: 'var(--primary-light)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: 36,
          }}>🧼</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>CleaSys</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sistema de Limpieza — Turno Mañana &amp; Noche</p>
        </div>

        {/* Registro Personal — acción principal */}
        <Card
          icon="👤"
          iconBg="rgba(255,255,255,0.2)"
          title="Registro Personal"
          sub="Marcá tu entrada y tareas de limpieza"
          arrow="#fff"
          style={{
            background: 'var(--primary)',
            boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
            border: 'none',
            marginBottom: 28,
          }}
          titleColor="#fff"
          subColor="rgba(255,255,255,0.75)"
          onClick={() => navigate('/registro')}
        />

        {/* Zonas — dinámicas desde Supabase */}
        <SectionLabel>Zonas</SectionLabel>
        {loading ? (
          [1, 2].map(i => (
            <div key={i} className="skeleton" style={{ height: 78, borderRadius: 12, marginBottom: 12 }} />
          ))
        ) : zonas.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0 16px' }}>
            Sin zonas activas
          </p>
        ) : (
          zonas.map(zona => (
            <Card
              key={zona.id}
              icon="🏢"
              iconBg="var(--primary-light)"
              title={zona.nombre}
              sub="Ver semana de esta zona"
              onClick={() => navigate(`/semana?zona=${zona.id}`)}
            />
          ))
        )}

        {/* Inventario */}
        <SectionLabel>Inventario</SectionLabel>
        <Card
          icon="🧴"
          iconBg="#FEF3C7"
          title="Material de limpieza"
          sub="Stock, compras y reposición"
          onClick={() => navigate('/materiales')}
        />

        {/* Gestión */}
        <SectionLabel>Gestión</SectionLabel>
        <Card
          icon="🏢"
          iconBg="var(--primary-light)"
          title="Zonas de limpieza"
          sub="Agregar, editar y gestionar zonas"
          onClick={() => navigate('/zonas')}
        />
        <Card
          icon="📋"
          iconBg="var(--primary-light)"
          title="Plan semanal"
          sub="Asignaciones y conteo de la semana"
          onClick={() => navigate('/login-supervisor')}
        />

        <p style={{ marginTop: 36, fontSize: 11, color: 'var(--text-light)', textAlign: 'center' }}>
          CleaSys v1.0
        </p>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      marginBottom: 10, marginTop: 4,
    }}>
      {children}
    </p>
  )
}

function Card({ icon, iconBg, title, sub, onClick, style = {}, titleColor = 'var(--text)', subColor = 'var(--text-muted)', arrow = 'var(--primary)' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', border: '1.5px solid var(--border)',
        borderRadius: 12, padding: '16px 14px',
        cursor: 'pointer', textAlign: 'left', marginBottom: 12,
        background: 'var(--bg-card)', boxShadow: 'var(--shadow)',
        transition: 'transform 100ms ease-out',
        ...style,
      }}
      onMouseEnter={e => { if (!style.background?.includes('primary')) e.currentTarget.style.borderColor = 'var(--primary)' }}
      onMouseLeave={e => { if (!style.background?.includes('primary')) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{
        width: 46, height: 46, background: iconBg, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 15, color: titleColor, marginBottom: 3 }}>{title}</p>
        <p style={{ fontSize: 12, color: subColor, lineHeight: 1.4 }}>{sub}</p>
      </div>
      <span style={{ color: arrow, fontSize: 20, flexShrink: 0 }}>›</span>
    </button>
  )
}
