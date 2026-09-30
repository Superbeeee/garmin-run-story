-- 活動專區第二個遊戲：接力抽禮物
--
-- 籤池 draw_entries：所有報名的角色（自動同步）加上主持人手動加入的名字。
--   excluded    不列入籤池
--   draw_order  第幾位被抽出（null 為還沒抽）
-- 抽籤結果在伺服器隨機決定；draw_state 只有一列，記錄最新一次抽出的人，
-- 用 Realtime 推給手機（reveal_at 之後才顯示，讓主持畫面的拉霸動畫先跑完）。
-- 除了 draw_state 的最新結果，其餘只有主持人能讀寫。

create table public.draw_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid unique references public.players (id) on delete cascade,
  manual_name text check (char_length(btrim(manual_name)) between 1 and 20),
  excluded boolean not null default false,
  draw_order integer unique,
  drawn_at timestamptz,
  created_at timestamptz not null default now(),
  constraint draw_entries_one_source check ((player_id is null) <> (manual_name is null))
);
alter table public.draw_entries enable row level security;
revoke all on public.draw_entries from anon, authenticated;

create table public.draw_state (
  id integer primary key default 1 check (id = 1),
  seq integer not null default 0,
  entry_id uuid,
  player_id uuid,
  name text,
  avatar jsonb,
  draw_order integer,
  reveal_at timestamptz
);
insert into public.draw_state (id) values (1);
alter table public.draw_state enable row level security;
revoke all on public.draw_state from anon, authenticated;
grant select on public.draw_state to authenticated;
create policy "登入者可讀最新抽籤結果" on public.draw_state for select to authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.draw_state;
  end if;
end;
$$;

-- 新報名的角色補進籤池
create or replace function public.draw_sync()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.draw_entries (player_id)
  select p.id from public.players p
  where not exists (select 1 from public.draw_entries e where e.player_id = p.id)
$$;

-- 籤池全部內容（主持後台與抽籤畫面）
create or replace function public.draw_pool()
returns table (id uuid, player_id uuid, name text, avatar jsonb, excluded boolean, draw_order integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.draw_sync();
  return query
    select e.id, e.player_id, coalesce(p.name, e.manual_name), p.avatar, e.excluded, e.draw_order
    from public.draw_entries e
    left join public.players p on p.id = e.player_id
    order by e.draw_order nulls last, coalesce(p.created_at, e.created_at);
end;
$$;

-- 抽出下一位；spin_ms 為主持畫面動畫長度，手機在動畫結束後才顯示
create or replace function public.draw_next(p_spin_ms integer default 6000)
returns table (id uuid, player_id uuid, name text, avatar jsonb, draw_order integer, reveal_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.draw_entries;
  v_order integer;
  v_name text;
  v_avatar jsonb;
  v_reveal timestamptz := now() + make_interval(secs => least(greatest(p_spin_ms, 0), 20000) / 1000.0);
begin
  perform public.require_admin();
  perform public.draw_sync();
  -- 同時按兩次也只會一個一個抽
  lock table public.draw_entries in share row exclusive mode;
  select * into v_entry from public.draw_entries e
  where not e.excluded and e.draw_order is null
  order by random() limit 1;
  if v_entry.id is null then
    raise exception 'pool_empty' using errcode = 'P0001';
  end if;
  select coalesce(max(e.draw_order), 0) + 1 into v_order from public.draw_entries e;
  update public.draw_entries set draw_order = v_order, drawn_at = now() where draw_entries.id = v_entry.id;
  select coalesce(p.name, v_entry.manual_name), p.avatar into v_name, v_avatar
  from (select 1) x left join public.players p on p.id = v_entry.player_id;
  update public.draw_state
  set seq = seq + 1, entry_id = v_entry.id, player_id = v_entry.player_id, name = v_name, avatar = v_avatar,
      draw_order = v_order, reveal_at = v_reveal
  where draw_state.id = 1;
  return query select v_entry.id, v_entry.player_id, v_name, v_avatar, v_order, v_reveal;
end;
$$;

create or replace function public.draw_set_excluded(p_entry uuid, p_excluded boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.draw_entries set excluded = p_excluded where id = p_entry;
end;
$$;

create or replace function public.draw_add_name(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.normalize_player_name(p_name);
  v_id uuid;
begin
  perform public.require_admin();
  if char_length(v_name) not between 1 and 20 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  insert into public.draw_entries (manual_name) values (v_name) returning id into v_id;
  return v_id;
end;
$$;

-- 只能刪手動加入的名字（報名的角色用 excluded 排除）
create or replace function public.draw_remove_name(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  delete from public.draw_entries where id = p_entry and player_id is null;
end;
$$;

-- 放回籤池（之後的順序往前補）
create or replace function public.draw_put_back(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order integer;
begin
  perform public.require_admin();
  select e.draw_order into v_order from public.draw_entries e where e.id = p_entry for update;
  if v_order is null then
    return;
  end if;
  update public.draw_entries set draw_order = null, drawn_at = null where id = p_entry;
  -- unique 約束逐列檢查，先移到負數再移回來
  update public.draw_entries set draw_order = -draw_order where draw_order > v_order;
  update public.draw_entries set draw_order = -draw_order - 1 where draw_order < 0;
end;
$$;

create or replace function public.draw_reset()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.draw_entries set draw_order = null, drawn_at = null where draw_order is not null;
  update public.draw_state
  set seq = seq + 1, entry_id = null, player_id = null, name = null, avatar = null, draw_order = null, reveal_at = null
  where id = 1;
end;
$$;

revoke all on function public.draw_sync() from public;
revoke all on function public.draw_pool() from public;
revoke all on function public.draw_next(integer) from public;
revoke all on function public.draw_set_excluded(uuid, boolean) from public;
revoke all on function public.draw_add_name(text) from public;
revoke all on function public.draw_remove_name(uuid) from public;
revoke all on function public.draw_put_back(uuid) from public;
revoke all on function public.draw_reset() from public;
grant execute on function public.draw_pool() to authenticated;
grant execute on function public.draw_next(integer) to authenticated;
grant execute on function public.draw_set_excluded(uuid, boolean) to authenticated;
grant execute on function public.draw_add_name(text) to authenticated;
grant execute on function public.draw_remove_name(uuid) to authenticated;
grant execute on function public.draw_put_back(uuid) to authenticated;
grant execute on function public.draw_reset() to authenticated;
