-- ====================================================================
-- CleanSys: sedes de limpieza (paso 2)
--
-- * El sector de cada persona (Comidas -> Agregar personal) es su sede.
--   Al renombrar una sede, el personal de esa sede se actualiza solo.
-- * Materiales por sede: cada sede maneja los suyos.
-- * Plan semanal de cada sede: asigna su personal a sus zonas.
-- Todo pasa por funciones; una sede no puede tocar lo de otra.
-- Se puede volver a correr sin problema.
-- ====================================================================

-- ---- Renombrar sede: también el sector de su personal ---------------
create or replace function public.limp_admin_guardar_sede(
  p_token text, p_id uuid, p_nombre text, p_activo boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v public.limpieza_sedes;
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_viejo text;
  v_slug text;
  n int := 1;
begin
  perform _limp_exigir_supervisor(p_token);
  if v_nombre = '' then raise exception 'Escribí el nombre de la sede.'; end if;
  if exists (select 1 from limpieza_sedes where lower(trim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya existe una sede con ese nombre.';
  end if;

  if p_id is null then
    v_slug := nullif(_limp_slug(v_nombre), '');
    if v_slug is null then v_slug := 'sede'; end if;
    while exists (select 1 from limpieza_sedes where slug = case when n = 1 then v_slug else v_slug || '-' || n end) loop
      n := n + 1;
    end loop;
    if n > 1 then v_slug := v_slug || '-' || n; end if;
    insert into limpieza_sedes (nombre, slug, activo) values (v_nombre, v_slug, coalesce(p_activo, true))
    returning * into v;
    insert into limpieza_sede_credenciales (sede_id, password_hash, debe_cambiar)
    values (v.id, extensions.crypt('limpieza123', extensions.gen_salt('bf')), true);
  else
    select nombre into v_viejo from limpieza_sedes where id = p_id;
    if v_viejo is null then raise exception 'Sede no encontrada.'; end if;
    update limpieza_sedes set nombre = v_nombre, activo = coalesce(p_activo, activo)
    where id = p_id returning * into v;
    if lower(trim(v_viejo)) <> lower(v_nombre) then
      update com_personal set sector = v_nombre where lower(trim(sector)) = lower(trim(v_viejo));
      update limpieza_materiales set sector = v_nombre where sede_id = v.id;
    end if;
    if not v.activo then delete from limpieza_sede_sesiones where sede_id = v.id; end if;
  end if;
  return to_jsonb(v);
end $$;


-- ---- Materiales por sede ---------------------------------------------
alter table public.limpieza_materiales add column if not exists sede_id uuid references public.limpieza_sedes(id);
alter table public.limpieza_materiales add column if not exists "fechaFin" date;

-- p_datos: { nombre, cantidad, unidad, fechaCompra (inicio), fechaFin, fechaReposicion }
create or replace function public.limp_sede_guardar_material(p_token text, p_id text, p_datos jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  m public.limpieza_materiales;
  v_nombre text := trim(coalesce(p_datos->>'nombre', ''));
begin
  s := _limp_sede_de_sesion(p_token);
  if v_nombre = '' then raise exception 'Escribí el nombre del material.'; end if;

  if p_id is null then
    insert into limpieza_materiales (id, nombre, sector, cantidad, unidad, "fechaCompra", "fechaFin", "fechaReposicion", activo, sede_id)
    values (
      replace(gen_random_uuid()::text, '-', ''), v_nombre, s.nombre,
      coalesce(p_datos->>'cantidad', ''), coalesce(nullif(p_datos->>'unidad', ''), 'unidad'),
      nullif(p_datos->>'fechaCompra', '')::date, nullif(p_datos->>'fechaFin', '')::date,
      nullif(p_datos->>'fechaReposicion', '')::date, true, s.id)
    returning * into m;
  else
    update limpieza_materiales set
      nombre = v_nombre,
      cantidad = coalesce(p_datos->>'cantidad', ''),
      unidad = coalesce(nullif(p_datos->>'unidad', ''), 'unidad'),
      "fechaCompra" = nullif(p_datos->>'fechaCompra', '')::date,
      "fechaFin" = nullif(p_datos->>'fechaFin', '')::date,
      "fechaReposicion" = nullif(p_datos->>'fechaReposicion', '')::date
    where id = p_id and sede_id = s.id and activo
    returning * into m;
    if m.id is null then raise exception 'Material no encontrado en esta sede.'; end if;
  end if;
  return to_jsonb(m) - 'foto';
end $$;

create or replace function public.limp_sede_eliminar_material(p_token text, p_id text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare s public.limpieza_sedes;
begin
  s := _limp_sede_de_sesion(p_token);
  update limpieza_materiales set activo = false where id = p_id and sede_id = s.id;
end $$;


-- ---- Plan semanal de la sede -----------------------------------------
-- Asigna una persona de la sede a una zona de la sede en varias fechas.
-- Si esa persona ya tiene tarea ese día y turno en esta sede, se cambia
-- la zona; si la tiene en otra sede, ese día se salta.
-- Devuelve { asignadas, ocupadas }
create or replace function public.limp_sede_asignar(
  p_token text, p_zona_id text, p_personal_id uuid, p_turno text, p_fechas jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  p record;
  f date;
  v_existente record;
  n_ok int := 0;
  n_ocupadas int := 0;
begin
  s := _limp_sede_de_sesion(p_token);
  if p_turno not in ('mañana', 'noche') then raise exception 'Turno inválido.'; end if;
  if not exists (select 1 from limpieza_zonas where id = p_zona_id and sede_id = s.id and activo) then
    raise exception 'Esa zona no es de esta sede.';
  end if;
  select id, nombre, sector into p from com_personal
  where id = p_personal_id and activo is distinct from false and lower(trim(sector)) = lower(trim(s.nombre));
  if p.id is null then raise exception 'Esa persona no es personal de esta sede.'; end if;

  for f in select (x)::date from jsonb_array_elements_text(coalesce(p_fechas, '[]'::jsonb)) x loop
    select a.id, z.sede_id into v_existente
    from limpieza_asignaciones a left join limpieza_zonas z on z.id = a.zona_id
    where a.personal_id::text = p.id::text and a.fecha::date = f and a.turno = p_turno;

    if v_existente.id is not null and v_existente.sede_id is distinct from s.id
       and exists (select 1 from limpieza_asignaciones where id = v_existente.id and activo) then
      n_ocupadas := n_ocupadas + 1;
      continue;
    end if;

    insert into limpieza_asignaciones (id, personal_id, zona_id, turno, fecha, "personalNombre", "personalSector", activo)
    values (replace(gen_random_uuid()::text, '-', ''), p.id, p_zona_id, p_turno, f, p.nombre, coalesce(p.sector, ''), true)
    on conflict (personal_id, fecha, turno) do update
      set zona_id = excluded.zona_id, "personalNombre" = excluded."personalNombre",
          "personalSector" = excluded."personalSector", activo = true;
    n_ok := n_ok + 1;
  end loop;
  return jsonb_build_object('asignadas', n_ok, 'ocupadas', n_ocupadas);
end $$;

-- Quitar una asignación de la sede
create or replace function public.limp_sede_quitar_asignacion(p_token text, p_id text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare s public.limpieza_sedes;
begin
  s := _limp_sede_de_sesion(p_token);
  update limpieza_asignaciones a set activo = false
  from limpieza_zonas z
  where a.id = p_id and z.id = a.zona_id and z.sede_id = s.id;
end $$;

-- Poner otra persona en una asignación (ej: la anterior ya no está)
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
  if a.id is null then raise exception 'Asignación no encontrada en esta sede.'; end if;
  select id, nombre, sector into p from com_personal
  where id = p_personal_id and activo is distinct from false and lower(trim(sector)) = lower(trim(s.nombre));
  if p.id is null then raise exception 'Esa persona no es personal de esta sede.'; end if;
  if exists (select 1 from limpieza_asignaciones where personal_id::text = p.id::text and fecha = a.fecha and turno = a.turno and activo and id <> a.id) then
    raise exception '% ya tiene una tarea ese día y turno.', p.nombre;
  end if;
  delete from limpieza_asignaciones where personal_id::text = p.id::text and fecha = a.fecha and turno = a.turno and not activo;
  update limpieza_asignaciones
  set personal_id = p.id, "personalNombre" = p.nombre, "personalSector" = coalesce(p.sector, ''), activo = true
  where id = a.id;
end $$;


-- ---- Permisos --------------------------------------------------------
revoke all on function public.limp_sede_guardar_material(text, text, jsonb)          from public;
revoke all on function public.limp_sede_eliminar_material(text, text)               from public;
revoke all on function public.limp_sede_asignar(text, text, uuid, text, jsonb)       from public;
revoke all on function public.limp_sede_quitar_asignacion(text, text)               from public;
revoke all on function public.limp_sede_cambiar_persona(text, text, uuid)           from public;
grant execute on function public.limp_sede_guardar_material(text, text, jsonb)      to anon, authenticated;
grant execute on function public.limp_sede_eliminar_material(text, text)            to anon, authenticated;
grant execute on function public.limp_sede_asignar(text, text, uuid, text, jsonb)   to anon, authenticated;
grant execute on function public.limp_sede_quitar_asignacion(text, text)            to anon, authenticated;
grant execute on function public.limp_sede_cambiar_persona(text, text, uuid)        to anon, authenticated;

notify pgrst, 'reload schema';
