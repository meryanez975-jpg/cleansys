-- ====================================================================
-- CleanSys: sedes de limpieza (paso 1)
--
-- * limpieza_sedes: las crea solo el supervisor general (Comidas rol
--   cleansys o admin). Cada sede tiene su link y su contraseña.
-- * Contraseña inicial de cada sede: limpieza123. La primera vez que
--   entran se pide cambiarla. Contraseñas y sesiones en tablas cerradas.
-- * Cada sede crea sus propias zonas y tareas (limpieza_zonas.sede_id).
--   Una sede no puede tocar las zonas de otra.
-- * Las zonas viejas (sin sede) se desactivan: se empieza de cero.
-- Se puede volver a correr sin problema.
-- ====================================================================

-- ---- Tablas ---------------------------------------------------------
create table if not exists public.limpieza_sedes (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null,
  slug    text not null unique,          -- va en el link; no cambia al renombrar
  activo  boolean not null default true,
  creada  timestamptz not null default now()
);
create unique index if not exists limpieza_sedes_nombre_idx on public.limpieza_sedes (lower(trim(nombre)));

create table if not exists public.limpieza_sede_credenciales (
  sede_id         uuid primary key references public.limpieza_sedes(id) on delete cascade,
  password_hash   text not null,
  debe_cambiar    boolean not null default true,
  intentos        int not null default 0,
  bloqueado_hasta timestamptz,
  actualizado     timestamptz not null default now()
);

create table if not exists public.limpieza_sede_sesiones (
  token_hash  text primary key,
  sede_id     uuid not null references public.limpieza_sedes(id) on delete cascade,
  creada      timestamptz not null default now(),
  ultimo_uso  timestamptz not null default now()
);

alter table public.limpieza_sedes             enable row level security;
alter table public.limpieza_sede_credenciales enable row level security;
alter table public.limpieza_sede_sesiones     enable row level security;
revoke all on public.limpieza_sedes             from anon, authenticated;
revoke all on public.limpieza_sede_credenciales from anon, authenticated;
revoke all on public.limpieza_sede_sesiones     from anon, authenticated;
grant select on public.limpieza_sedes to anon, authenticated;
drop policy if exists "leer sedes limpieza" on public.limpieza_sedes;
create policy "leer sedes limpieza" on public.limpieza_sedes for select using (true);

-- Zonas: cada una pertenece a una sede
alter table public.limpieza_zonas add column if not exists sede_id uuid references public.limpieza_sedes(id);

-- Tareas como lista JSON (las apps las leen igual que antes)
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'limpieza_zonas' and column_name = 'tareas') = 'ARRAY' then
    alter table public.limpieza_zonas alter column tareas drop default;
    alter table public.limpieza_zonas alter column tareas type jsonb using to_jsonb(tareas);
    alter table public.limpieza_zonas alter column tareas set default '[]'::jsonb;
  elsif not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'limpieza_zonas' and column_name = 'tareas') then
    alter table public.limpieza_zonas add column tareas jsonb not null default '[]'::jsonb;
  end if;
end $$;

-- Empezar de cero: las zonas sin sede quedan desactivadas (no se borran)
update public.limpieza_zonas set activo = false where sede_id is null and activo;


-- ---- Ayudantes internos ---------------------------------------------
create or replace function public._limp_slug(p_nombre text)
returns text language sql immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(trim(coalesce(p_nombre, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
    '[^a-z0-9]+', '-', 'g'))
$$;

-- Supervisor general: sesión de Comidas con rol cleansys o admin
create or replace function public._limp_exigir_supervisor(p_token text)
returns public.com_admins language plpgsql security definer
set search_path = public, extensions
as $$
declare v public.com_admins;
begin
  v := _usuario_de_sesion(p_token);
  if v.id is null then raise exception 'Sesión vencida. Volvé a iniciar sesión.'; end if;
  if v.rol not in ('cleansys', 'admin') then raise exception 'Solo el supervisor general puede hacer esto.'; end if;
  return v;
end $$;

-- Sede dueña de una sesión válida (vence al año sin uso)
create or replace function public._limp_sede_de_sesion(p_token text)
returns public.limpieza_sedes language plpgsql security definer
set search_path = public, extensions
as $$
declare v public.limpieza_sedes;
begin
  update limpieza_sede_sesiones set ultimo_uso = now()
  where token_hash = _hash_token(p_token) and ultimo_uso > now() - interval '365 days';
  select s.* into v
  from limpieza_sede_sesiones x join limpieza_sedes s on s.id = x.sede_id
  where x.token_hash = _hash_token(p_token)
    and x.ultimo_uso > now() - interval '365 days'
    and s.activo;
  if v.id is null then raise exception 'Sesión vencida. Volvé a entrar con la contraseña de la sede.'; end if;
  return v;
end $$;


-- ---- Supervisor general: sedes ---------------------------------------
create or replace function public.limp_admin_listar_sedes(p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform _limp_exigir_supervisor(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'nombre', s.nombre, 'slug', s.slug, 'activo', s.activo,
      'debe_cambiar', coalesce(c.debe_cambiar, true),
      'zonas', (select count(*) from limpieza_zonas z where z.sede_id = s.id and z.activo)
    ) order by s.nombre)
    from limpieza_sedes s left join limpieza_sede_credenciales c on c.sede_id = s.id
  ), '[]'::jsonb);
end $$;

-- Crear (p_id null), renombrar o activar/desactivar. Al crear: limpieza123
create or replace function public.limp_admin_guardar_sede(
  p_token text, p_id uuid, p_nombre text, p_activo boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v public.limpieza_sedes;
  v_nombre text := trim(coalesce(p_nombre, ''));
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
    update limpieza_sedes set nombre = v_nombre, activo = coalesce(p_activo, activo)
    where id = p_id returning * into v;
    if v.id is null then raise exception 'Sede no encontrada.'; end if;
    if not v.activo then delete from limpieza_sede_sesiones where sede_id = v.id; end if;
  end if;
  return to_jsonb(v);
end $$;

-- Volver la contraseña a limpieza123 (se pide cambiarla al entrar)
create or replace function public.limp_admin_resetear_sede(p_token text, p_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform _limp_exigir_supervisor(p_token);
  insert into limpieza_sede_credenciales (sede_id, password_hash, debe_cambiar)
  values (p_id, extensions.crypt('limpieza123', extensions.gen_salt('bf')), true)
  on conflict (sede_id) do update
    set password_hash = excluded.password_hash, debe_cambiar = true,
        intentos = 0, bloqueado_hasta = null, actualizado = now();
  delete from limpieza_sede_sesiones where sede_id = p_id;
end $$;


-- ---- App de la sede: entrar, sesión, contraseña -----------------------
-- Devuelve { token, sede, debe_cambiar } o { error }
create or replace function public.limp_sede_login(p_slug text, p_password text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v public.limpieza_sedes;
  c public.limpieza_sede_credenciales;
  v_token text;
begin
  select * into v from limpieza_sedes where slug = lower(trim(p_slug)) and activo;
  if v.id is null then return jsonb_build_object('error', 'Esta sede no existe o está desactivada.'); end if;
  select * into c from limpieza_sede_credenciales where sede_id = v.id;
  if c.sede_id is null then return jsonb_build_object('error', 'La sede no tiene contraseña. Pedísela al supervisor.'); end if;
  if c.bloqueado_hasta is not null and c.bloqueado_hasta > now() then
    return jsonb_build_object('error', 'Demasiados intentos. Esperá unos minutos y probá de nuevo.');
  end if;
  if c.password_hash <> extensions.crypt(coalesce(p_password, ''), c.password_hash) then
    update limpieza_sede_credenciales
    set intentos = intentos + 1,
        bloqueado_hasta = case when intentos + 1 >= 5 then now() + interval '5 minutes' end
    where sede_id = v.id;
    perform pg_sleep(1);
    return jsonb_build_object('error', 'Contraseña incorrecta.');
  end if;

  update limpieza_sede_credenciales set intentos = 0, bloqueado_hasta = null where sede_id = v.id;
  delete from limpieza_sede_sesiones where ultimo_uso < now() - interval '365 days';
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into limpieza_sede_sesiones (token_hash, sede_id) values (_hash_token(v_token), v.id);
  return jsonb_build_object('token', v_token, 'sede', to_jsonb(v), 'debe_cambiar', c.debe_cambiar);
end $$;

create or replace function public.limp_sede_sesion(p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare v public.limpieza_sedes;
begin
  v := _limp_sede_de_sesion(p_token);
  return jsonb_build_object('sede', to_jsonb(v),
    'debe_cambiar', (select debe_cambiar from limpieza_sede_credenciales where sede_id = v.id));
end $$;

create or replace function public.limp_sede_cambiar_password(p_token text, p_nueva text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare v public.limpieza_sedes;
begin
  v := _limp_sede_de_sesion(p_token);
  if length(coalesce(p_nueva, '')) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres.'; end if;
  if p_nueva = 'limpieza123' then raise exception 'Elegí una contraseña distinta a la inicial.'; end if;
  update limpieza_sede_credenciales
  set password_hash = extensions.crypt(p_nueva, extensions.gen_salt('bf')), debe_cambiar = false, actualizado = now()
  where sede_id = v.id;
end $$;

create or replace function public.limp_sede_logout(p_token text)
returns void language sql security definer
set search_path = public, extensions
as $$ delete from limpieza_sede_sesiones where token_hash = _hash_token(p_token) $$;


-- ---- App de la sede: zonas y tareas (solo las suyas) -----------------
-- Crear (p_id null) o editar nombre y lista de tareas
create or replace function public.limp_sede_guardar_zona(p_token text, p_id text, p_nombre text, p_tareas jsonb)
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
begin
  s := _limp_sede_de_sesion(p_token);
  if v_nombre = '' then raise exception 'Escribí el nombre de la zona.'; end if;
  if exists (select 1 from limpieza_zonas where sede_id = s.id and activo
             and lower(trim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya hay una zona con ese nombre en esta sede.';
  end if;

  if p_id is null then
    insert into limpieza_zonas (id, nombre, activo, sede_id, tareas)
    values (replace(gen_random_uuid()::text, '-', ''), v_nombre, true, s.id, v_tareas)
    returning * into z;
  else
    update limpieza_zonas set nombre = v_nombre, tareas = v_tareas
    where id = p_id and sede_id = s.id and activo
    returning * into z;
    if z.id is null then raise exception 'Zona no encontrada en esta sede.'; end if;
  end if;
  return to_jsonb(z);
end $$;

-- Eliminar = desactivar (lo ya registrado queda para el historial)
create or replace function public.limp_sede_eliminar_zona(p_token text, p_id text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare s public.limpieza_sedes;
begin
  s := _limp_sede_de_sesion(p_token);
  update limpieza_zonas set activo = false where id = p_id and sede_id = s.id;
end $$;


-- ---- Permisos --------------------------------------------------------
revoke all on function public._limp_slug(text)                  from public, anon, authenticated;
revoke all on function public._limp_exigir_supervisor(text)     from public, anon, authenticated;
revoke all on function public._limp_sede_de_sesion(text)        from public, anon, authenticated;

revoke all on function public.limp_admin_listar_sedes(text)                        from public;
revoke all on function public.limp_admin_guardar_sede(text, uuid, text, boolean)    from public;
revoke all on function public.limp_admin_resetear_sede(text, uuid)                 from public;
revoke all on function public.limp_sede_login(text, text)                          from public;
revoke all on function public.limp_sede_sesion(text)                               from public;
revoke all on function public.limp_sede_cambiar_password(text, text)               from public;
revoke all on function public.limp_sede_logout(text)                               from public;
revoke all on function public.limp_sede_guardar_zona(text, text, text, jsonb)      from public;
revoke all on function public.limp_sede_eliminar_zona(text, text)                  from public;

grant execute on function public.limp_admin_listar_sedes(text)                     to anon, authenticated;
grant execute on function public.limp_admin_guardar_sede(text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.limp_admin_resetear_sede(text, uuid)              to anon, authenticated;
grant execute on function public.limp_sede_login(text, text)                       to anon, authenticated;
grant execute on function public.limp_sede_sesion(text)                            to anon, authenticated;
grant execute on function public.limp_sede_cambiar_password(text, text)            to anon, authenticated;
grant execute on function public.limp_sede_logout(text)                            to anon, authenticated;
grant execute on function public.limp_sede_guardar_zona(text, text, text, jsonb)   to anon, authenticated;
grant execute on function public.limp_sede_eliminar_zona(text, text)               to anon, authenticated;

-- Zonas: leer sigue abierto; escribir solo con las funciones de la sede
revoke insert, update, delete, truncate on public.limpieza_zonas from anon, authenticated;
grant select on public.limpieza_zonas to anon, authenticated;

notify pgrst, 'reload schema';
