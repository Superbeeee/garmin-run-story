-- 主持後台的報名管理：列出所有報名（含登入的 Google email）、改名、刪除
-- 刪除角色會一併移除該角色的遊戲紀錄與籤池資料；本人之後可以用同一個帳號重新報名。

create or replace function public.admin_players()
returns table (id uuid, name text, avatar jsonb, email text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select p.id, p.name, p.avatar, u.email::text, p.created_at
    from public.players p
    left join auth.users u on u.id = p.user_id
    order by p.created_at;
end;
$$;

create or replace function public.admin_rename_player(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.normalize_player_name(p_name);
begin
  perform public.require_admin();
  if char_length(v_name) not between 1 and 20 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  update public.players set name = v_name, updated_at = now() where id = p_id;
  if not found then
    raise exception 'not_registered' using errcode = 'P0001';
  end if;
exception
  when unique_violation then
    raise exception 'name_taken' using errcode = 'P0001';
end;
$$;

create or replace function public.admin_delete_player(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  delete from public.players where id = p_id;
end;
$$;

revoke all on function public.admin_players() from public;
revoke all on function public.admin_rename_player(uuid, text) from public;
revoke all on function public.admin_delete_player(uuid) from public;
grant execute on function public.admin_players() to authenticated;
grant execute on function public.admin_rename_player(uuid, text) to authenticated;
grant execute on function public.admin_delete_player(uuid) to authenticated;
