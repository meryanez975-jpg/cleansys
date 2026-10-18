-- ====================================================================
-- CleanSys: corregir el historial del inventario (paso 6)
--
-- * Editar un movimiento guarda lo que tenía antes (columna "cambios").
-- * Eliminar NO borra: lo marca como eliminado (fecha y hora). Ya no se ve
--   en la app ni cuenta en el inventario, pero queda para el Excel.
-- * No se puede eliminar ni achicar algo si el inventario queda en negativo.
-- Se puede volver a correr sin problema.
-- ====================================================================

alter table public.limpieza_movimientos add column if not exists eliminado_en timestamptz;
alter table public.limpieza_movimientos add column if not exists editado_en timestamptz;
alter table public.limpieza_movimientos add column if not exists cambios jsonb not null default '[]'::jsonb;

-- Cuánto hay (sin lo eliminado). p_sin: un movimiento a no contar (al editarlo)
create or replace function public._limp_stock(p_material_id text, p_sin text default null)
returns numeric language sql stable
set search_path = public
as $$
  select coalesce(sum(case when tipo = 'entrada' then cantidad else -cantidad end), 0)
  from limpieza_movimientos
  where material_id = p_material_id and eliminado_en is null and id is distinct from p_sin
$$;
drop function if exists public._limp_stock(text);
revoke all on function public._limp_stock(text, text) from public, anon, authenticated;

-- Usar: no más de lo que hay (sin contar lo eliminado)
create or replace function public.limp_sede_movimiento(p_token text, p_material_id text, p_datos jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  mv public.limpieza_movimientos;
  v_tipo text := p_datos->>'tipo';
  v_paquetes numeric := nullif(p_datos->>'paquetes', '')::numeric;
  v_upp numeric := nullif(p_datos->>'unidades_por_paquete', '')::numeric;
  v_cantidad numeric := nullif(p_datos->>'cantidad', '')::numeric;
  v_hay numeric;
  v_unidad text;
begin
  s := _limp_sede_de_sesion(p_token);
  select unidad into v_unidad from limpieza_materiales where id = p_material_id and sede_id = s.id and activo;
  if v_unidad is null then raise exception 'Ese producto no es de esta tienda.'; end if;
  if v_tipo not in ('entrada', 'salida') then raise exception 'Movimiento inválido.'; end if;

  if v_tipo = 'entrada' then
    if coalesce(v_paquetes, 0) <= 0 or coalesce(v_upp, 0) <= 0 then raise exception 'Poné cuántos paquetes y cuánto trae cada uno.'; end if;
    v_cantidad := v_paquetes * v_upp;
  else
    if coalesce(v_cantidad, 0) <= 0 then raise exception 'Poné cuánto se usó.'; end if;
    v_hay := _limp_stock(p_material_id);
    if v_cantidad > v_hay then
      raise exception 'Solo hay % %. No se puede usar más de lo que hay.', trim(to_char(v_hay, 'FM999999990.##')), v_unidad;
    end if;
    v_paquetes := null; v_upp := null;
  end if;

  insert into limpieza_movimientos (sede_id, material_id, tipo, fecha, cantidad, paquetes, unidades_por_paquete, precio_paquete, nota)
  values (s.id, p_material_id, v_tipo, coalesce(nullif(p_datos->>'fecha', '')::date, current_date), v_cantidad,
          v_paquetes, v_upp,
          case when v_tipo = 'entrada' then nullif(p_datos->>'precio_paquete', '')::numeric end,
          nullif(trim(coalesce(p_datos->>'nota', '')), ''))
  returning * into mv;
  return to_jsonb(mv);
end $$;

-- Editar: se guarda lo anterior en "cambios"
create or replace function public.limp_sede_editar_movimiento(p_token text, p_id text, p_datos jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  mv public.limpieza_movimientos;
  v_paquetes numeric := nullif(p_datos->>'paquetes', '')::numeric;
  v_upp numeric := nullif(p_datos->>'unidades_por_paquete', '')::numeric;
  v_cantidad numeric := nullif(p_datos->>'cantidad', '')::numeric;
  v_quedaria numeric;
  v_unidad text;
begin
  s := _limp_sede_de_sesion(p_token);
  select * into mv from limpieza_movimientos where id = p_id and sede_id = s.id and eliminado_en is null;
  if mv.id is null then raise exception 'Movimiento no encontrado.'; end if;
  select unidad into v_unidad from limpieza_materiales where id = mv.material_id;

  if mv.tipo = 'entrada' then
    if coalesce(v_paquetes, 0) <= 0 or coalesce(v_upp, 0) <= 0 then raise exception 'Poné cuántos paquetes y cuánto trae cada uno.'; end if;
    v_cantidad := v_paquetes * v_upp;
    v_quedaria := _limp_stock(mv.material_id, mv.id) + v_cantidad;
  else
    if coalesce(v_cantidad, 0) <= 0 then raise exception 'Poné cuánto se usó.'; end if;
    v_paquetes := null; v_upp := null;
    v_quedaria := _limp_stock(mv.material_id, mv.id) - v_cantidad;
  end if;
  if v_quedaria < 0 then
    raise exception 'Con ese cambio el inventario quedaría en % %. Revisá los usos de este producto.', trim(to_char(v_quedaria, 'FM999999990.##')), v_unidad;
  end if;

  update limpieza_movimientos set
    cambios = cambios || jsonb_build_array(jsonb_build_object(
      'cambiado_en', now(), 'fecha', mv.fecha, 'cantidad', mv.cantidad, 'paquetes', mv.paquetes,
      'unidades_por_paquete', mv.unidades_por_paquete, 'precio_paquete', mv.precio_paquete, 'nota', mv.nota)),
    fecha = coalesce(nullif(p_datos->>'fecha', '')::date, mv.fecha),
    cantidad = v_cantidad, paquetes = v_paquetes, unidades_por_paquete = v_upp,
    precio_paquete = case when mv.tipo = 'entrada' then nullif(p_datos->>'precio_paquete', '')::numeric end,
    nota = nullif(trim(coalesce(p_datos->>'nota', '')), ''),
    editado_en = now()
  where id = mv.id
  returning * into mv;
  return to_jsonb(mv);
end $$;

-- Eliminar: queda marcado (no se borra)
create or replace function public.limp_sede_eliminar_movimiento(p_token text, p_id text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  mv public.limpieza_movimientos;
  v_unidad text;
begin
  s := _limp_sede_de_sesion(p_token);
  select * into mv from limpieza_movimientos where id = p_id and sede_id = s.id and eliminado_en is null;
  if mv.id is null then return; end if;
  if mv.tipo = 'entrada' and _limp_stock(mv.material_id, mv.id) < 0 then
    select unidad into v_unidad from limpieza_materiales where id = mv.material_id;
    raise exception 'No se puede eliminar esta compra: ya se usó parte. Primero corregí o eliminá los usos de este producto.';
  end if;
  update limpieza_movimientos set eliminado_en = now() where id = mv.id;
end $$;

revoke all on function public.limp_sede_editar_movimiento(text, text, jsonb) from public;
grant execute on function public.limp_sede_editar_movimiento(text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
