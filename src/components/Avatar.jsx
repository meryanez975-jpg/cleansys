// Círculo con la inicial; el color sale del nombre, así cada persona
// tiene siempre el mismo color en todas las pantallas.
const COLORES = [
  ['#E3EDFD', '#1F6FEB'], ['#DFF6E8', '#16804A'], ['#FFF0DB', '#B86A06'],
  ['#F1E8FD', '#7C3AED'], ['#FDE4EC', '#C2185B'], ['#E0F5F7', '#0E7C86'],
]

export function colorDe(nombre = '') {
  let h = 0
  for (const c of nombre.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORES[h % COLORES.length]
}

export default function Avatar({ nombre = '', size = 44, children }) {
  const [fondo, texto] = colorDe(nombre)
  return (
    <span className="avatar" style={{ width: size, height: size, background: fondo, color: texto, fontSize: Math.round(size * 0.4) }}>
      {children ?? (nombre.trim().charAt(0).toUpperCase() || '?')}
    </span>
  )
}
