-- 主持人刪除已結束的場次
--
-- 只能刪 finished 的場次，進行中的要先「結束遊戲」，避免誤刪正在玩的場次。
-- game_players、game_answers 以 on delete cascade 一併刪除。

create or replace function public.delete_game(p_game uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform public.require_admin();
  select g.status into v_status from public.games g where g.id = p_game for update;
  if v_status is null then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_status <> 'finished' then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  delete from public.games where id = p_game;
end;
$$;

revoke all on function public.delete_game(uuid) from public;
revoke execute on function public.delete_game(uuid) from anon;
grant execute on function public.delete_game(uuid) to authenticated;
