-- מינימום יחידות להזמנה (סך כל המארזים בעגלה)
alter table public.settings add column if not exists min_order_qty int not null default 20;
update public.settings set min_order_qty = 20 where id = 1;

create or replace function orders_min_qty() returns trigger
language plpgsql security definer set search_path = public as $$
declare q int; m int;
begin
  if is_admin() and coalesce(current_setting('app.place_order', true), '') <> '1' then return new; end if;
  select coalesce(sum((i->>'qty')::int),0) into q from jsonb_array_elements(new.items) i;
  select coalesce(min_order_qty, 1) into m from settings where id = 1;
  if q < m then raise exception 'מינימום הזמנה הוא % יחידות (בעגלה: %)', m, q; end if;
  return new;
end $$;
drop trigger if exists orders_min_qty_trg on orders;
-- רץ אחרי orders_validate_trg (סדר אלפביתי של שמות הטריגרים)
create trigger orders_min_qty_trg before insert on orders for each row execute function orders_min_qty();
