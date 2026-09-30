-- 收回未登入（anon）執行 function 的權限
--
-- Supabase 預設會把新建的 function 直接授權給 anon、authenticated，
-- 之前的 migration 只 revoke from public，收不到這份直接授權。
-- 目前所有功能都需要登入（公開名單直接讀 players 資料表），anon 不需要任何 function。
-- 內部用的輔助 function 也不開放給登入者直接呼叫。

revoke execute on all functions in schema public from anon;

revoke execute on function public.require_uid() from authenticated;
revoke execute on function public.require_admin() from authenticated;
revoke execute on function public.my_player_id() from authenticated;
revoke execute on function public.draw_sync() from authenticated;

-- 之後新建的 function 也不要自動授權給 anon
alter default privileges in schema public revoke execute on functions from anon;
