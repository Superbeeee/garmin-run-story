-- 聖誕跑者報名：players 資料表與報名／修改用的 function
--
-- 權限設計：
--   * anon 只能讀 id、name、avatar、created_at（edit_token 讀不到）
--   * 不開放直接 insert / update / delete，一律透過 security definer function
--   * 修改必須帶正確的 edit_token

-- ---------- 造型格式檢查 ----------
-- 只檢查形狀（15 個欄位、皆為短字串、gender 與 band 為固定值）；
-- 各欄位的可選清單由前端 src/avatar/validate.ts 檢查。
create or replace function public.is_valid_avatar(a jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(a) = 'object'
    and (select count(*) from jsonb_object_keys(a)) = 15
    and a ?& array['gender', 'build', 'head', 'skin', 'eye', 'face', 'hair', 'hairColor',
                   'top', 'topColor', 'legs', 'legsColor', 'shoesColor', 'band', 'bandColor']
    and not exists (
      select 1 from jsonb_each(a) e
      where jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') not between 1 and 32
    )
    and a ->> 'gender' in ('male', 'female')
    and a ->> 'band' in ('none', 'thick')
$$;

-- 名字正規化：去頭尾空白、連續空白合併（與前端 src/lib/name.ts 一致）
create or replace function public.normalize_player_name(n text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(btrim(coalesce(n, '')), '\s+', ' ', 'g')
$$;

-- ---------- 資料表 ----------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  avatar jsonb not null,
  edit_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_name_valid check (
    char_length(name) between 1 and 20 and name = public.normalize_player_name(name)
  ),
  constraint players_avatar_valid check (public.is_valid_avatar(avatar))
);

-- 名字不分大小寫不可重複
create unique index players_name_lower_key on public.players (lower(name));
create index players_created_at_idx on public.players (created_at);

-- ---------- 權限與 RLS ----------
alter table public.players enable row level security;

-- Supabase 預設會把新表的所有權限給 anon / authenticated，先全部收回
revoke all on public.players from anon, authenticated;
grant select (id, name, avatar, created_at) on public.players to anon, authenticated;

create policy "任何人可讀名單" on public.players
  for select to anon, authenticated
  using (true);
-- 沒有 insert / update / delete 的 policy 與權限：只能透過下面的 function 寫入

-- ---------- 報名 ----------
create or replace function public.register_player(p_name text, p_avatar jsonb)
returns table (id uuid, edit_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.normalize_player_name(p_name);
begin
  if char_length(v_name) not between 1 and 20 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if not public.is_valid_avatar(p_avatar) then
    raise exception 'invalid_avatar' using errcode = 'P0001';
  end if;

  return query
    insert into public.players as p (name, avatar)
    values (v_name, p_avatar)
    returning p.id, p.edit_token;
exception
  when unique_violation then
    raise exception 'name_taken' using errcode = 'P0001';
end;
$$;

-- ---------- 取回自己的資料 ----------
create or replace function public.get_my_player(p_id uuid, p_token uuid)
returns table (id uuid, name text, avatar jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.avatar, p.created_at
  from public.players p
  where p.id = p_id and p.edit_token = p_token
$$;

-- ---------- 修改造型（與名字） ----------
create or replace function public.update_player(p_id uuid, p_token uuid, p_name text, p_avatar jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.normalize_player_name(p_name);
begin
  if char_length(v_name) not between 1 and 20 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if not public.is_valid_avatar(p_avatar) then
    raise exception 'invalid_avatar' using errcode = 'P0001';
  end if;

  update public.players p
  set name = v_name, avatar = p_avatar, updated_at = now()
  where p.id = p_id and p.edit_token = p_token;

  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
exception
  when unique_violation then
    raise exception 'name_taken' using errcode = 'P0001';
end;
$$;

-- function 預設任何人可執行，先收回再只開放給 anon / authenticated
revoke all on function public.register_player(text, jsonb) from public;
revoke all on function public.get_my_player(uuid, uuid) from public;
revoke all on function public.update_player(uuid, uuid, text, jsonb) from public;
grant execute on function public.register_player(text, jsonb) to anon, authenticated;
grant execute on function public.get_my_player(uuid, uuid) to anon, authenticated;
grant execute on function public.update_player(uuid, uuid, text, jsonb) to anon, authenticated;
