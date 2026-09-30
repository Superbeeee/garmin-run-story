-- 改用 Google 登入：一個帳號報名一個角色，用同一個帳號在任何裝置都能修改
--
-- 權限設計：
--   * 報名、取回、修改都必須登入（authenticated），以 auth.uid() 找自己的那筆
--   * 移除 edit_token 與以 token 驗證的舊 function
--   * 舊資料的 user_id 為 null，沒有人能修改（上線前的測試資料可直接刪除）

drop function if exists public.register_player(text, jsonb);
drop function if exists public.get_my_player(uuid, uuid);
drop function if exists public.update_player(uuid, uuid, text, jsonb);

alter table public.players drop column edit_token;
alter table public.players
  add column user_id uuid references auth.users (id) on delete cascade,
  add constraint players_user_id_key unique (user_id);

-- 沒登入時丟出 not_signed_in
create or replace function public.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

-- ---------- 報名 ----------
create or replace function public.register_player(p_name text, p_avatar jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_name text := public.normalize_player_name(p_name);
  v_id uuid;
  v_constraint text;
begin
  if char_length(v_name) not between 1 and 20 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if not public.is_valid_avatar(p_avatar) then
    raise exception 'invalid_avatar' using errcode = 'P0001';
  end if;

  insert into public.players (name, avatar, user_id)
  values (v_name, p_avatar, v_uid)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'players_user_id_key' then
      raise exception 'already_registered' using errcode = 'P0001';
    end if;
    raise exception 'name_taken' using errcode = 'P0001';
end;
$$;

-- ---------- 取回自己的資料 ----------
create or replace function public.get_my_player()
returns table (id uuid, name text, avatar jsonb, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  return query
    select p.id, p.name, p.avatar, p.created_at
    from public.players p
    where p.user_id = v_uid;
end;
$$;

-- ---------- 修改造型（與名字） ----------
create or replace function public.update_player(p_name text, p_avatar jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
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
  where p.user_id = v_uid;

  if not found then
    raise exception 'not_registered' using errcode = 'P0001';
  end if;
exception
  when unique_violation then
    raise exception 'name_taken' using errcode = 'P0001';
end;
$$;

-- 只開放給已登入的使用者；function 內仍會再檢查 auth.uid()
revoke all on function public.require_uid() from public;
revoke all on function public.register_player(text, jsonb) from public;
revoke all on function public.get_my_player() from public;
revoke all on function public.update_player(text, jsonb) from public;
grant execute on function public.register_player(text, jsonb) to authenticated;
grant execute on function public.get_my_player() to authenticated;
grant execute on function public.update_player(text, jsonb) to authenticated;
