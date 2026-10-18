-- ====================================================================
-- CleanSys: arreglo de mayúsculas en el sector (QA 2026-10-18)
--
-- * Al renombrar una tienda cambiando solo mayúsculas ("majoli" → "MAJOLI")
--   el sector del personal no se actualizaba y quedaban dos sectores.
-- * Se corrige la función y se dejan iguales los sectores que ya quedaron
--   distintos (mismo nombre con otras mayúsculas o espacios).
-- Se puede volver a correr sin problema.
-- ====================================================================

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
  if v_nombre = '' then raise exception 'Escribí el nombre de la tienda.'; end if;
  if exists (select 1 from limpieza_sedes where lower(trim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya existe una tienda con ese nombre.';
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
    if v_viejo is null then raise exception 'Tienda no encontrada.'; end if;
    update limpieza_sedes set nombre = v_nombre, activo = coalesce(p_activo, activo)
    where id = p_id returning * into v;
    -- También si solo cambian mayúsculas (ej. "majoli" → "MAJOLI")
    if v_viejo <> v_nombre then
      update com_personal set sector = v_nombre where lower(trim(sector)) = lower(trim(v_viejo));
      update limpieza_materiales set sector = v_nombre where sede_id = v.id;
    end if;
    if not v.activo then delete from limpieza_sede_sesiones where sede_id = v.id; end if;
  end if;
  return to_jsonb(v);
end $$;

-- Personal cuyo sector es una tienda pero escrito distinto: se iguala al nombre de la tienda
update public.com_personal p
set sector = s.nombre
from public.limpieza_sedes s
where lower(trim(p.sector)) = lower(trim(s.nombre)) and p.sector <> s.nombre;

notify pgrst, 'reload schema';
