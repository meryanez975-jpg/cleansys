-- ====================================================================
-- CleanSys: horario de limpieza de cada zona (paso 3)
--
-- * limpieza_zonas.horarios: por turno, de qué hora a qué hora se limpia.
--   Ej: {"mañana": {"desde": "08:00", "hasta": "12:00"},
--        "noche":  {"desde": "19:00", "hasta": "22:00"}}
--   Un turno que no está en la lista no se usa en esa zona.
-- * La página donde marca el personal usa ese horario para habilitar la
--   entrada (antes era fijo: 8:00 mañana y 18:00 noche).
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

notify pgrst, 'reload schema';
