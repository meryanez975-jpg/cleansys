-- ====================================================================
-- CleanSys: horario de limpieza de cada zona (paso 3)
--
-- * limpieza_zonas.horarios: por turno, de qué hora a qué hora se limpia.
--   Ej: {"mañana": {"desde": "08:00", "hasta": "12:00"},
--        "noche":  {"desde": "19:00", "hasta": "22:00"}}
--   Un turno que no está en la lista no se usa en esa zona.
-- * La página donde marca el personal usa ese horario para habilitar la
--   entrada (antes era fijo: 8:00 mañana y 18:00 noche).
-- * Una persona puede tener varias zonas el mismo día (una por zona).
-- Se puede volver a correr sin problema.
-- ====================================================================

alter table public.limpieza_zonas add column if not exists horarios jsonb not null default '{}'::jsonb;

-- Se reemplaza la función para aceptar el horario (p_horarios es opcional:
-- si no se manda, al editar se conserva el que tenía)
drop function if exists public.limp_sede_guardar_zona(text, text, text, jsonb);

create or replace function public.limp_sede_guardar_zona(
  p_token text, p_id text, p_nombre text, p_tareas jsonb, p_horarios jsonb default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  z public.limpieza_zonas;
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_tareas jsonb := coalesce((
    select jsonb_agg(trim(t)) from jsonb_array_elements_text(coalesce(p_tareas, '[]'::jsonb)) t where trim(t) <> ''
  ), '[]'::jsonb);
  v_horarios jsonb := '{}'::jsonb;
  t text;
begin
  s := _limp_sede_de_sesion(p_token);
  if v_nombre = '' then raise exception 'Escribí el nombre de la zona.'; end if;
  if exists (select 1 from limpieza_zonas where sede_id = s.id and activo
             and lower(trim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya hay una zona con ese nombre en esta tienda.';
  end if;

  -- Solo turnos válidos y con horas completas (HH:MM)
  if p_horarios is not null then
    foreach t in array array['mañana', 'noche'] loop
      if p_horarios ? t then
        if coalesce(p_horarios->t->>'desde', '') !~ '^\d{2}:\d{2}$' or coalesce(p_horarios->t->>'hasta', '') !~ '^\d{2}:\d{2}$' then
          raise exception 'Completá el horario de % (desde y hasta).', t;
        end if;
        if p_horarios->t->>'hasta' <= p_horarios->t->>'desde' then
          raise exception 'En el horario de %, la hora de fin tiene que ser después de la de inicio.', t;
        end if;
        v_horarios := v_horarios || jsonb_build_object(t, jsonb_build_object('desde', p_horarios->t->>'desde', 'hasta', p_horarios->t->>'hasta'));
      end if;
    end loop;
  end if;

  if p_id is null then
    insert into limpieza_zonas (id, nombre, activo, sede_id, tareas, horarios)
    values (replace(gen_random_uuid()::text, '-', ''), v_nombre, true, s.id, v_tareas, v_horarios)
    returning * into z;
  else
    update limpieza_zonas
    set nombre = v_nombre, tareas = v_tareas,
        horarios = case when p_horarios is null then horarios else v_horarios end
    where id = p_id and sede_id = s.id and activo
    returning * into z;
    if z.id is null then raise exception 'Zona no encontrada en esta tienda.'; end if;
  end if;
  return to_jsonb(z);
end $$;

revoke all on function public.limp_sede_guardar_zona(text, text, text, jsonb, jsonb) from public;
grant execute on function public.limp_sede_guardar_zona(text, text, text, jsonb, jsonb) to anon, authenticated;


-- ---- Varias zonas por persona el mismo día y turno --------------------
-- Antes: una sola tarea por persona, día y turno. Ahora: una por zona.
-- Si dos zonas se pisan de horario se permite (el Plan avisa) y la persona
-- las hace una por una.
do $$
declare r record;
begin
  -- Quitar la regla vieja (personal_id, fecha, turno), sea restricción o índice
  for r in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.limpieza_asignaciones'::regclass and con.contype = 'u'
      and (select array_agg(att.attname::text order by att.attname)
           from unnest(con.conkey) k join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k)
          = array['fecha', 'personal_id', 'turno']
  loop
    execute format('alter table public.limpieza_asignaciones drop constraint %I', r.conname);
  end loop;
  for r in
    select i.relname as indice
    from pg_index x join pg_class i on i.oid = x.indexrelid
    where x.indrelid = 'public.limpieza_asignaciones'::regclass and x.indisunique and not x.indisprimary
      and (select array_agg(att.attname::text order by att.attname)
           from unnest(x.indkey) k join pg_attribute att on att.attrelid = x.indrelid and att.attnum = k)
          = array['fecha', 'personal_id', 'turno']
  loop
    execute format('drop index public.%I', r.indice);
  end loop;
end $$;

create unique index if not exists limpieza_asignaciones_persona_zona_idx
  on public.limpieza_asignaciones (personal_id, fecha, turno, zona_id);

-- Asignar: ahora se agrega una fila por zona (ya no se mueve de zona)
create or replace function public.limp_sede_asignar(
  p_token text, p_zona_id text, p_personal_id uuid, p_turno text, p_fechas jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  p record;
  f date;
  n_ok int := 0;
begin
  s := _limp_sede_de_sesion(p_token);
  if p_turno not in ('mañana', 'noche') then raise exception 'Turno inválido.'; end if;
  if not exists (select 1 from limpieza_zonas where id = p_zona_id and sede_id = s.id and activo) then
    raise exception 'Esa zona no es de esta tienda.';
  end if;
  select id, nombre, sector into p from com_personal
  where id = p_personal_id and activo is distinct from false and lower(trim(sector)) = lower(trim(s.nombre));
  if p.id is null then raise exception 'Esa persona no es personal de esta tienda.'; end if;

  for f in select (x)::date from jsonb_array_elements_text(coalesce(p_fechas, '[]'::jsonb)) x loop
    insert into limpieza_asignaciones (id, personal_id, zona_id, turno, fecha, "personalNombre", "personalSector", activo)
    values (replace(gen_random_uuid()::text, '-', ''), p.id, p_zona_id, p_turno, f, p.nombre, coalesce(p.sector, ''), true)
    on conflict (personal_id, fecha, turno, zona_id) do update
      set "personalNombre" = excluded."personalNombre", "personalSector" = excluded."personalSector", activo = true;
    n_ok := n_ok + 1;
  end loop;
  return jsonb_build_object('asignadas', n_ok, 'ocupadas', 0);
end $$;

-- Cambiar persona: no puede quedar dos veces en la misma zona, día y turno
create or replace function public.limp_sede_cambiar_persona(p_token text, p_id text, p_personal_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  a record;
  p record;
begin
  s := _limp_sede_de_sesion(p_token);
  select x.* into a from limpieza_asignaciones x join limpieza_zonas z on z.id = x.zona_id
  where x.id = p_id and z.sede_id = s.id;
  if a.id is null then raise exception 'Asignación no encontrada en esta tienda.'; end if;
  select id, nombre, sector into p from com_personal
  where id = p_personal_id and activo is distinct from false and lower(trim(sector)) = lower(trim(s.nombre));
  if p.id is null then raise exception 'Esa persona no es personal de esta tienda.'; end if;
  if exists (select 1 from limpieza_asignaciones where personal_id::text = p.id::text and fecha = a.fecha
             and turno = a.turno and zona_id = a.zona_id and activo and id <> a.id) then
    raise exception '% ya está en esa zona ese día.', p.nombre;
  end if;
  delete from limpieza_asignaciones where personal_id::text = p.id::text and fecha = a.fecha
    and turno = a.turno and zona_id = a.zona_id and not activo;
  update limpieza_asignaciones
  set personal_id = p.id, "personalNombre" = p.nombre, "personalSector" = coalesce(p.sector, ''), activo = true
  where id = a.id;
end $$;

notify pgrst, 'reload schema';
