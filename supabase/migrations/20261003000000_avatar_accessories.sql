-- 造型新增帽子與眼鏡：hat、hatColor、glasses、glassesColor
--
-- 原本的 15 個欄位仍必填；新欄位可省略（舊資料沒有，前端讀取時補預設值）。
-- 只能出現已知的欄位，每個值都是 1～32 字的字串。

create or replace function public.is_valid_avatar(a jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(a) = 'object'
    and a ?& array['gender', 'build', 'head', 'skin', 'eye', 'face', 'hair', 'hairColor',
                   'top', 'topColor', 'legs', 'legsColor', 'shoesColor', 'band', 'bandColor']
    and not exists (
      select 1 from jsonb_object_keys(a) k
      where k not in ('gender', 'build', 'head', 'skin', 'eye', 'face', 'hair', 'hairColor',
                      'top', 'topColor', 'legs', 'legsColor', 'shoesColor', 'band', 'bandColor',
                      'hat', 'hatColor', 'glasses', 'glassesColor')
    )
    and not exists (
      select 1 from jsonb_each(a) e
      where jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') not between 1 and 32
    )
    and a ->> 'gender' in ('male', 'female')
    and a ->> 'band' in ('none', 'thick')
$$;
