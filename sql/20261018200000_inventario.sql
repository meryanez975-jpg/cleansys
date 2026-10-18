-- ====================================================================
-- CleanSys: inventario de cada tienda (paso 5)
--
-- * limpieza_movimientos: entradas (compras) y salidas (lo que se usa).
--   Lo que hay = entradas - salidas, en la unidad del producto
--   (unidad, rollo, litro, kg, ...). Las entradas guardan paquetes,
--   cuánto trae cada paquete y su precio.
-- * limpieza_materiales.minimo: desde cuánto avisar "queda poco" (opcional).
-- * Las compras cargadas antes pasan a ser entradas.
-- * Solo la tienda dueña puede mover su inventario.
-- Se puede volver a correr sin problema.
-- ====================================================================

create table if not exists public.limpieza_movimientos (
  id                   text primary key default replace(gen_random_uuid()::text, '-', ''),
  sede_id              uuid not null references public.limpieza_sedes(id),
  material_id          text not null,
  tipo                 text not null check (tipo in ('entrada', 'salida')),
  fecha                date not null default current_date,
  cantidad             numeric not null check (cantidad > 0),   -- en la unidad del producto
  paquetes             numeric,                                  -- solo entradas
  unidades_por_paquete numeric,
  precio_paquete       numeric check (precio_paquete is null or precio_paquete >= 0),
  nota                 text,
  creado               timestamptz not null default now()
);
create index if not exists limpieza_movimientos_material_idx on public.limpieza_movimientos (material_id, fecha);
create index if not exists limpieza_movimientos_sede_idx on public.limpieza_movimientos (sede_id, fecha);

alter table public.limpieza_movimientos enable row level security;
revoke all on public.limpieza_movimientos from anon, authenticated;
grant select on public.limpieza_movimientos to anon, authenticated;
drop policy if exists "leer movimientos" on public.limpieza_movimientos;
create policy "leer movimientos" on public.limpieza_movimientos for select using (true);

alter table public.limpieza_materiales add column if not exists minimo numeric;

-- Las compras de antes pasan a ser entradas (una sola vez)
insert into public.limpieza_movimientos (id, sede_id, material_id, tipo, fecha, cantidad, paquetes, unidades_por_paquete, precio_paquete, nota, creado)
select c.id, c.sede_id, c.material_id, 'entrada', c.fecha, c.paquetes * c.unidades_por_paquete,
       c.paquetes, c.unidades_por_paquete, c.precio_paquete, c.nota, c.creado
from public.limpieza_compras c
where not exists (select 1 from public.limpieza_movimientos m where m.id = c.id);

-- Cuánto hay de un producto
create or replace function public._limp_stock(p_material_id text)
returns numeric language sql stable
set search_path = public
as $$
  select coalesce(sum(case when tipo = 'entrada' then cantidad else -cantidad end), 0)
  from limpieza_movimientos where material_id = p_material_id
$$;


-- ---- Producto: crear / editar (nombre, unidad, mínimo) ---------------
create or replace function public.limp_sede_guardar_material(p_token text, p_id text, p_datos jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  m public.limpieza_materiales;
  v_nombre text := trim(coalesce(p_datos->>'nombre', ''));
  v_unidad text := coalesce(nullif(trim(p_datos->>'unidad'), ''), 'unidad');
  v_minimo numeric := nullif(p_datos->>'minimo', '')::numeric;
begin
  s := _limp_sede_de_sesion(p_token);
  if v_nombre = '' then raise exception 'Escribí el nombre del producto.'; end if;
  if exists (select 1 from limpieza_materiales where sede_id = s.id and activo
             and lower(trim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya hay un producto con ese nombre en esta tienda.';
  end if;

  if p_id is null then
    insert into limpieza_materiales (id, nombre, sector, cantidad, unidad, activo, sede_id, minimo)
    values (replace(gen_random_uuid()::text, '-', ''), v_nombre, s.nombre, '', v_unidad, true, s.id, v_minimo)
    returning * into m;
  else
    update limpieza_materiales set nombre = v_nombre, unidad = v_unidad, minimo = v_minimo
    where id = p_id and sede_id = s.id and activo
    returning * into m;
    if m.id is null then raise exception 'Producto no encontrado en esta tienda.'; end if;
  end if;
  return to_jsonb(m) - 'foto';
end $$;


-- ---- Movimientos: agregar (entrada) o usar (salida) ------------------
-- p_datos: { tipo, fecha, cantidad (salida) | paquetes + unidades_por_paquete + precio_paquete (entrada), nota }
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

create or replace function public.limp_sede_eliminar_movimiento(p_token text, p_id text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare s public.limpieza_sedes;
begin
  s := _limp_sede_de_sesion(p_token);
  delete from limpieza_movimientos where id = p_id and sede_id = s.id;
end $$;


revoke all on function public._limp_stock(text) from public, anon, authenticated;
revoke all on function public.limp_sede_movimiento(text, text, jsonb)       from public;
revoke all on function public.limp_sede_eliminar_movimiento(text, text)     from public;
grant execute on function public.limp_sede_movimiento(text, text, jsonb)    to anon, authenticated;
grant execute on function public.limp_sede_eliminar_movimiento(text, text)  to anon, authenticated;

notify pgrst, 'reload schema';
