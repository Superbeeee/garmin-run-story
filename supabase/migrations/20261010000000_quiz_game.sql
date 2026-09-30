-- 活動專區第一個遊戲：搶答跑位（是非題／選擇題，移動角色到答案區）
--
-- 資料表：
--   admins          主持人名單（以 Google email 比對）
--   quiz_questions  題庫，只有主持人能讀寫（含正確答案）
--   games           場次與目前題目的公開狀態；正確答案在公布時才寫入 q_answer
--   game_players    加入場次的角色
--   game_answers    每人每題目前站的區域（不開放讀取，只能透過 function 寫入）
--
-- 流程：主持人 create_game(代碼) → 玩家 join_game(代碼) → 主持人 next_question → 玩家移動時 set_answer
--       → 時間到主持人 reveal_question（計分）→ next_question … → finish_game
-- 角色位置用 Realtime broadcast 傳給主持畫面，不經過資料庫。

-- ---------- 主持人 ----------
create table public.admins (
  email text primary key check (email = lower(email))
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.email = lower(auth.jwt() ->> 'email'))
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
end;
$$;

-- 目前登入者的角色 id；還沒報名丟出 not_registered
create or replace function public.my_player_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select p.id into v_id from public.players p where p.user_id = public.require_uid();
  if v_id is null then
    raise exception 'not_registered' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

-- 用來校正手機時鐘
create or replace function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now()
$$;

-- ---------- 題庫 ----------
create or replace function public.is_valid_choices(c text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(c, 1), 0) between 2 and 4
    and array_ndims(c) = 1
    and not exists (select 1 from unnest(c) x where x is null or char_length(btrim(x)) not between 1 and 40)
$$;

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 200),
  choices text[] not null check (public.is_valid_choices(choices)),
  answer smallint not null,
  seconds smallint not null default 15 check (seconds between 5 and 120),
  created_at timestamptz not null default now(),
  constraint quiz_questions_answer_valid check (answer >= 0 and answer < array_length(choices, 1))
);
create index quiz_questions_order_idx on public.quiz_questions (position, created_at);

alter table public.quiz_questions enable row level security;
revoke all on public.quiz_questions from anon, authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;
create policy "主持人管理題庫" on public.quiz_questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- 場次 ----------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9]{2,12}$'),
  status text not null default 'waiting' check (status in ('waiting', 'question', 'reveal', 'finished')),
  -- 建立場次時題庫的順序（之後改題庫不影響進行中的場次題序）
  question_ids uuid[] not null,
  q_index integer not null default -1,
  q_prompt text,
  q_choices text[],
  q_ends_at timestamptz,
  q_answer smallint,
  created_at timestamptz not null default now()
);
-- 進行中的場次代碼不可重複
create unique index games_active_code_key on public.games (code) where status <> 'finished';

alter table public.games enable row level security;
revoke all on public.games from anon, authenticated;
grant select on public.games to authenticated;
create policy "登入者可讀場次" on public.games for select to authenticated using (true);

create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, player_id)
);
alter table public.game_players enable row level security;
revoke all on public.game_players from anon, authenticated;
grant select on public.game_players to authenticated;
create policy "登入者可讀參加者" on public.game_players for select to authenticated using (true);

create table public.game_answers (
  game_id uuid not null,
  q_index integer not null,
  player_id uuid not null,
  choice smallint not null,
  correct boolean,
  updated_at timestamptz not null default now(),
  primary key (game_id, q_index, player_id),
  foreign key (game_id, player_id) references public.game_players (game_id, player_id) on delete cascade
);
alter table public.game_answers enable row level security;
revoke all on public.game_answers from anon, authenticated;

-- 主持畫面與手機透過 Realtime 收到場次狀態與新加入的人
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.games, public.game_players;
  end if;
end;
$$;

-- ---------- 玩家 ----------
create or replace function public.join_game(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := public.my_player_id();
  v_game uuid;
begin
  select g.id into v_game from public.games g
  where g.code = upper(btrim(p_code)) and g.status <> 'finished';
  if v_game is null then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  insert into public.game_players (game_id, player_id) values (v_game, v_player)
  on conflict do nothing;
  return v_game;
end;
$$;

-- 玩家目前站在第幾個答案區；只在作答時間內有效，最後一次為準
create or replace function public.set_answer(p_game uuid, p_index integer, p_choice smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := public.my_player_id();
  g public.games;
begin
  -- 與 reveal_question 的 update 互斥：公布答案後就不會再寫入
  select * into g from public.games where id = p_game for share;
  if g.id is null or g.status <> 'question' or g.q_index <> p_index or now() > g.q_ends_at + interval '1 second' then
    raise exception 'too_late' using errcode = 'P0001';
  end if;
  if p_choice < 0 or p_choice >= array_length(g.q_choices, 1) then
    raise exception 'invalid_choice' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.game_players gp where gp.game_id = p_game and gp.player_id = v_player) then
    raise exception 'not_joined' using errcode = 'P0001';
  end if;
  insert into public.game_answers as a (game_id, q_index, player_id, choice)
  values (p_game, p_index, v_player, p_choice)
  on conflict (game_id, q_index, player_id) do update set choice = excluded.choice, updated_at = now();
end;
$$;

-- 自己在這題選了哪個（重新整理頁面後還原用）
create or replace function public.my_answer(p_game uuid, p_index integer)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select a.choice from public.game_answers a
  where a.game_id = p_game and a.q_index = p_index and a.player_id = public.my_player_id()
$$;

-- 排名：只計已公布的題目；同分同名次
create or replace function public.game_leaderboard(p_game uuid)
returns table (player_id uuid, name text, avatar jsonb, score integer, rank integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.player_id, p.name, p.avatar, s.score, (rank() over (order by s.score desc))::integer
  from (
    select gp.player_id, gp.joined_at, count(*) filter (where a.correct)::integer as score
    from public.game_players gp
    left join public.game_answers a on a.game_id = gp.game_id and a.player_id = gp.player_id
    where gp.game_id = p_game
    group by gp.player_id, gp.joined_at
  ) s
  join public.players p on p.id = s.player_id
  order by s.score desc, s.joined_at
$$;

-- ---------- 主持人 ----------
create or replace function public.create_game(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(p_code));
  v_ids uuid[];
  v_id uuid;
begin
  perform public.require_admin();
  if v_code !~ '^[A-Z0-9]{2,12}$' then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;
  select array_agg(q.id order by q.position, q.created_at) into v_ids from public.quiz_questions q;
  if v_ids is null then
    raise exception 'no_questions' using errcode = 'P0001';
  end if;
  insert into public.games (code, question_ids) values (v_code, v_ids) returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'code_taken' using errcode = 'P0001';
end;
$$;

-- 開始下一題（等待中或公布答案後）；最後一題之後結束場次
create or replace function public.next_question(p_game uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  q public.quiz_questions;
begin
  perform public.require_admin();
  select * into g from public.games where id = p_game for update;
  if g.id is null or g.status not in ('waiting', 'reveal') then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  if g.q_index + 1 >= array_length(g.question_ids, 1) then
    update public.games set status = 'finished' where id = p_game;
    return;
  end if;
  select * into q from public.quiz_questions where id = g.question_ids[g.q_index + 2];
  if q.id is null then
    raise exception 'question_missing' using errcode = 'P0001';
  end if;
  update public.games
  set status = 'question', q_index = g.q_index + 1, q_prompt = q.prompt, q_choices = q.choices,
      q_ends_at = now() + make_interval(secs => q.seconds), q_answer = null
  where id = p_game;
end;
$$;

-- 公布答案並計分（提早公布會截止作答）
create or replace function public.reveal_question(p_game uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  v_answer smallint;
begin
  perform public.require_admin();
  select * into g from public.games where id = p_game for update;
  if g.id is null or g.status <> 'question' then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  select q.answer into v_answer from public.quiz_questions q where q.id = g.question_ids[g.q_index + 1];
  if v_answer is null then
    raise exception 'question_missing' using errcode = 'P0001';
  end if;
  update public.game_answers set correct = (choice = v_answer)
  where game_id = p_game and q_index = g.q_index;
  update public.games
  set status = 'reveal', q_answer = v_answer, q_ends_at = least(q_ends_at, now())
  where id = p_game;
end;
$$;

create or replace function public.finish_game(p_game uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.games set status = 'finished' where id = p_game;
end;
$$;

-- ---------- 權限 ----------
revoke all on function public.is_admin() from public;
revoke all on function public.require_admin() from public;
revoke all on function public.my_player_id() from public;
revoke all on function public.server_now() from public;
revoke all on function public.join_game(text) from public;
revoke all on function public.set_answer(uuid, integer, smallint) from public;
revoke all on function public.my_answer(uuid, integer) from public;
revoke all on function public.game_leaderboard(uuid) from public;
revoke all on function public.create_game(text) from public;
revoke all on function public.next_question(uuid) from public;
revoke all on function public.reveal_question(uuid) from public;
revoke all on function public.finish_game(uuid) from public;
-- is_admin 給 RLS policy 與前端判斷是否顯示主持後台
grant execute on function public.is_admin() to authenticated;
grant execute on function public.server_now() to authenticated;
grant execute on function public.join_game(text) to authenticated;
grant execute on function public.set_answer(uuid, integer, smallint) to authenticated;
grant execute on function public.my_answer(uuid, integer) to authenticated;
grant execute on function public.game_leaderboard(uuid) to authenticated;
grant execute on function public.create_game(text) to authenticated;
grant execute on function public.next_question(uuid) to authenticated;
grant execute on function public.reveal_question(uuid) to authenticated;
grant execute on function public.finish_game(uuid) to authenticated;
