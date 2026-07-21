# Integración CleaSys ↔ Menu Soft

## Contexto general

Ambas apps comparten el **mismo proyecto Supabase**.  
Esto significa que Menu Soft puede leer las tablas de CleaSys directamente, sin APIs intermedias.

| App | URL producción | Carpeta local |
|---|---|---|
| Menu Soft | https://frontend-lovat-three-kjpbrqp3rw.vercel.app | `liz proyectos 2026/Menu soft/frontend` |
| CleaSys | https://cleansys.vercel.app | `liz proyectos 2026/cleansys` |

**Supabase compartido:** `https://zlnvvnfylzlknvexlrvz.supabase.co`

---

## Tablas de CleaSys (ya definidas en supabase_setup.sql)

```
limpieza_personal      → id, nombre, sector, activo
limpieza_zonas         → id, nombre, activo
limpieza_materiales    → id, nombre, cantidad, unidad, fecha_compra, fecha_reposicion
limpieza_asignaciones  → personal_id, zona_id, turno, fecha   [UNIQUE: personal+fecha+turno]
limpieza_registros     → asignacion_id, hora_entrada, hora_salida, completado, notas
```

---

## Qué va a consumir Menu Soft de estas tablas

### 1. Historial de limpiezas (panel Admin)
Ruta: `/admin/historial-limpieza`  
Query necesaria:
```sql
SELECT
  lr.hora_entrada, lr.hora_salida, lr.completado, lr.notas,
  la.turno, la.fecha,
  lp.nombre AS personal_nombre,
  lz.nombre AS zona_nombre
FROM limpieza_registros lr
JOIN limpieza_asignaciones la ON la.id = lr.asignacion_id
JOIN limpieza_personal     lp ON lp.id = la.personal_id
JOIN limpieza_zonas        lz ON lz.id = la.zona_id
WHERE la.fecha = '2026-05-22'   -- filtro por fecha
ORDER BY la.turno, lr.hora_entrada
```

### 2. Resumen del día (posible widget en Admin)
- Cuántas asignaciones tiene cada turno
- Cuántas están `completado = true` vs pendientes
- Base: `limpieza_asignaciones` + `limpieza_registros`

### 3. Inventario de materiales (futuro)
- Tabla `limpieza_materiales` → alertas de reposición próxima

---

## Convenciones importantes

### Prefijo de tablas
- Menu Soft usa prefijo `com_` → `com_personal`, `com_registros`, etc.
- CleaSys usa prefijo `limpieza_` → mantener este prefijo en todas las tablas nuevas

### Funciones en localDB.js (Menu Soft)
Las funciones que lean datos de CleaSys se agregarán en  
`Menu soft/frontend/src/lib/localDB.js` con prefijo `getLimpieza*`:
```js
getLimpiezaHistorial(fecha)
getLimpiezaResumenDia(fecha)
// etc.
```

---

## Regla de oro — no romper ninguna app

- Menu Soft **solo lee** tablas de CleaSys, nunca escribe en ellas.
- CleaSys **solo escribe** en sus propias tablas.
- Si CleaSys necesita agregar una columna nueva, avisar antes para actualizar las queries de Menu Soft.

---

## URLs de CleaSys usadas desde Menu Soft Admin

El componente `Limpieza.jsx` en Menu Soft abre estas páginas en nueva pestaña:

| Botón | URL |
|---|---|
| 📋 Asignación | https://cleansys.vercel.app/asignacion |
| 📝 Registro | https://cleansys.vercel.app/registro |

> ⚠️ No usar `<iframe>` — CleaSys bloquea la carga por X-Frame-Options.  
> Siempre abrir en nueva pestaña con `window.open(url, '_blank')`.

---

## Próximos pasos acordados

- [ ] Historial de limpiezas en panel Admin de Menu Soft
- [ ] Resumen del día (widget o tarjeta en Admin)
- [ ] Revisar si se necesitan columnas extra en `limpieza_registros` (ej: foto, firma)
- [ ] Decidir si materiales se gestiona desde CleaSys o también desde Menu Soft
