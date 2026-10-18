-- ====================================================================
-- CleanSys: compras de materiales (paso 4)
--
-- * limpieza_compras: cada vez que una tienda compra un material se guarda
--   la fecha, cuántos paquetes, cuántas unidades trae cada paquete y cuánto
--   costó el paquete. Con eso se calcula el total, el costo por unidad y
--   cuánto dura (días entre una compra y la siguiente).
-- * Solo la tienda dueña del material puede registrar o borrar compras.
-- Se puede volver a correr sin problema.
-- ====================================================================

create table if not exists public.limpieza_compras (
  id                   text primary key default replace(gen_random_uuid()::text, '-', ''),
  sede_id              uuid not null references public.limpieza_sedes(id),
  material_id          text not null,
  fecha                date not null default current_date,
  paquetes             numeric not null default 1 check (paquetes > 0),
  unidades_por_paquete numeric not null default 1 check (unidades_por_paquete > 0),
  precio_paquete       numeric check (precio_paquete is null or precio_paquete >= 0),
  nota                 text,
  creado               timestamptz not null default now()
);
create index if not exists limpieza_compras_material_idx on public.limpieza_compras (material_id, fecha);
create index if not exists limpieza_compras_sede_idx on public.limpieza_compras (sede_id, fecha);

alter table public.limpieza_compras enable row level security;
revoke all on public.limpieza_compras from anon, authenticated;
grant select on public.limpieza_compras to anon, authenticated;
drop policy if exists "leer compras" on public.limpieza_compras;
create policy "leer compras" on public.limpieza_compras for select using (true);

-- Las fechas que ya tenían los materiales de las tiendas pasan a ser su primera compra
insert into public.limpieza_compras (sede_id, material_id, fecha, paquetes)
select m.sede_id, m.id, m."fechaCompra"::date,
       case when m.cantidad ~ '^\d+(\.\d+)?$' and m.cantidad::numeric > 0 then m.cantidad::numeric else 1 end
from public.limpieza_materiales m
where m.sede_id is not null and m.activo and m."fechaCompra" is not null
  and not exists (select 1 from public.limpieza_compras c where c.material_id = m.id);


-- p_datos: { fecha, paquetes, unidades_por_paquete, precio_paquete, nota }
create or replace function public.limp_sede_registrar_compra(p_token text, p_material_id text, p_datos jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  c public.limpieza_compras;
begin
  s := _limp_sede_de_sesion(p_token);
  if not exists (select 1 from limpieza_materiales where id = p_material_id and sede_id = s.id and activo) then
    raise exception 'Ese material no es de esta tienda.';
  end if;
  insert into limpieza_compras (sede_id, material_id, fecha, paquetes, unidades_por_paquete, precio_paquete, nota)
  values (
    s.id, p_material_id,
    coalesce(nullif(p_datos->>'fecha', '')::date, current_date),
    coalesce(nullif(p_datos->>'paquetes', '')::numeric, 1),
    coalesce(nullif(p_datos->>'unidades_por_paquete', '')::numeric, 1),
    nullif(p_datos->>'precio_paquete', '')::numeric,
    nullif(trim(coalesce(p_datos->>'nota', '')), ''))
  returning * into c;
  -- La fecha de la última compra queda también en el material
  update limpieza_materiales set "fechaCompra" = (select max(fecha) from limpieza_compras where material_id = p_material_id)
  where id = p_material_id;
  return to_jsonb(c);
end $$;

create or replace function public.limp_sede_eliminar_compra(p_token text, p_id text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.limpieza_sedes;
  v_material text;
begin
  s := _limp_sede_de_sesion(p_token);
  delete from limpieza_compras where id = p_id and sede_id = s.id returning material_id into v_material;
  if v_material is not null then
    update limpieza_materiales set "fechaCompra" = (select max(fecha) from limpieza_compras where material_id = v_material)
    where id = v_material;
  end if;
end $$;

revoke all on function public.limp_sede_registrar_compra(text, text, jsonb) from public;
revoke all on function public.limp_sede_eliminar_compra(text, text)        from public;
grant execute on function public.limp_sede_registrar_compra(text, text, jsonb) to anon, authenticated;
grant execute on function public.limp_sede_eliminar_compra(text, text)        to anon, authenticated;

notify pgrst, 'reload schema';
