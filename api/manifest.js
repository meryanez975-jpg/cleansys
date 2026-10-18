// Manifiesto de cada tienda, para instalarla como app con su propio nombre:
//   /api/manifest?slug=majoli&tipo=marcar  → app para marcar la limpieza (/marcar/majoli)
//   /api/manifest?slug=majoli              → app de la encargada (/tienda/majoli)
// Las dos rutas no se pisan, así cada una se instala como app separada.
export default function handler(req, res) {
  const slug = String(req.query.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60)
  const marcar = req.query.tipo === 'marcar'
  const nombre = slug.replace(/-/g, ' ').toUpperCase() || 'TIENDA'

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).json({
    id: `cleansys-${slug}-${marcar ? 'marcar' : 'tienda'}`,
    name: marcar ? `Limpieza ${nombre} — Marcar` : `CleaSys ${nombre}`,
    short_name: marcar ? `Marcar ${nombre}` : `CleaSys ${nombre}`,
    description: marcar ? 'Marcar entrada, tareas y salida de limpieza' : 'Zonas, plan semanal e inventario de la tienda',
    start_url: marcar ? `/marcar/${slug}` : `/tienda/${slug}`,
    scope: marcar ? `/marcar/${slug}` : `/tienda/${slug}`,
    display: 'standalone',
    background_color: '#f0f4ff',
    theme_color: '#3B82F6',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  })
}
