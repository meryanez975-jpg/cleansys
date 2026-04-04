-- ================================================
-- CleaSys — Setup completo en Supabase
-- Ejecutar en el SQL Editor de Supabase
-- ================================================

-- 1. Personal de limpieza
CREATE TABLE IF NOT EXISTS limpieza_personal (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre    TEXT NOT NULL,
  sector    TEXT DEFAULT '',
  activo    BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================

-- 2. Zonas de limpieza
CREATE TABLE IF NOT EXISTS limpieza_zonas (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre    TEXT NOT NULL,
  activo    BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO limpieza_zonas (nombre) VALUES ('Baño'), ('Tienda')
  ON CONFLICT DO NOTHING;

-- ================================================

-- 3. Materiales de limpieza
CREATE TABLE IF NOT EXISTS limpieza_materiales (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre           TEXT NOT NULL,
  cantidad         TEXT DEFAULT '',
  unidad           TEXT DEFAULT 'unidad',
  fecha_compra     DATE,
  fecha_reposicion DATE,
  activo           BOOLEAN DEFAULT TRUE,
  creado_en        TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================

-- 4. Asignaciones: quién limpia qué zona en qué turno y fecha
CREATE TABLE IF NOT EXISTS limpieza_asignaciones (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  personal_id UUID REFERENCES limpieza_personal(id) ON DELETE CASCADE,
  zona_id     UUID REFERENCES limpieza_zonas(id) ON DELETE CASCADE,
  turno       TEXT CHECK (turno IN ('mañana', 'noche')) NOT NULL,
  fecha       DATE NOT NULL,
  creado_en   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (personal_id, fecha, turno)
);

-- ================================================

-- 5. Registros: hora entrada/salida
CREATE TABLE IF NOT EXISTS limpieza_registros (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asignacion_id UUID REFERENCES limpieza_asignaciones(id) ON DELETE CASCADE UNIQUE,
  hora_entrada  TIMESTAMPTZ,
  hora_salida   TIMESTAMPTZ,
  completado    BOOLEAN DEFAULT FALSE,
  notas         TEXT DEFAULT '',
  creado_en     TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE limpieza_personal      ENABLE ROW LEVEL SECURITY;
ALTER TABLE limpieza_zonas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE limpieza_materiales    ENABLE ROW LEVEL SECURITY;
ALTER TABLE limpieza_asignaciones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE limpieza_registros     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_personal"     ON limpieza_personal     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_zonas"        ON limpieza_zonas        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_materiales"   ON limpieza_materiales   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_asignaciones" ON limpieza_asignaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_registros"    ON limpieza_registros    FOR ALL USING (true) WITH CHECK (true);

-- ================================================
-- FIN DEL SCRIPT
-- ================================================
