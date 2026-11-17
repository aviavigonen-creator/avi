-- ============================================================
--  הקשחת אבטחה (17.11.2026)
--  1. רשימת מנהלים מורשים – רק מי שברשימה יכול לקרוא/לערוך (גם אם מישהו יצליח להירשם)
--  2. ביטול mark_paid (הלקוח לא יכול לסמן לעצמו "שולם" – רק PayPlus דרך ה-callback)
--  3. הזמנה מהאתר: סטטוס מוגבל, מחירים מחושבים מחדש בשרת מטבלת המוצרים
--  4. הגבלת קצב (rate limit) להזמנות, פניות וביקורים + הגבלת אורך שדות
-- ============================================================

-- ---------- 1. מנהלים מורשים ----------
create table if not exists admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);
-- כל המשתמשים שכבר קיימים ב-Auth (שני חשבונות המנהל) נכנסים לרשימה
insert into admin_users(email) select lower(email) from auth.users where email is not null on conflict do nothing;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function is_admin() from public;
grant execute on function is_admin() to anon, authenticated;

alter table admin_users enable row level security;
drop policy if exists "admins read admins" on admin_users;
create policy "admins read admins" on admin_users for select to authenticated using (is_admin());

-- מדיניות: קריאה ציבורית נשארת רק למוצרים ולהגדרות; כל השאר – מנהלים בלבד
drop policy if exists "admin write products" on products;
create policy "admin write products" on products for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admin write settings" on settings;
create policy "admin write settings" on settings for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin read orders" on orders;
create policy "admin read orders" on orders for select to authenticated using (is_admin());
drop policy if exists "admin update orders" on orders;
create policy "admin update orders" on orders for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admin delete orders" on orders;
create policy "admin delete orders" on orders for delete to authenticated using (is_admin());

drop policy if exists "admin read visits" on visits;
create policy "admin read visits" on visits for select to authenticated using (is_admin());

drop policy if exists "admin read callbacks" on callbacks;
create policy "admin read callbacks" on callbacks for select to authenticated using (is_admin());
drop policy if exists "admin update callbacks" on callbacks;
create policy "admin update callbacks" on callbacks for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admin delete callbacks" on callbacks;
create policy "admin delete callbacks" on callbacks for delete to authenticated using (is_admin());

drop policy if exists "admin manage push" on push_subscriptions;
create policy "admin manage push" on push_subscriptions for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin upload images" on storage.objects;
create policy "admin upload images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and is_admin());
drop policy if exists "admin update images" on storage.objects;
create policy "admin update images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and is_admin());
drop policy if exists "admin delete images" on storage.objects;
create policy "admin delete images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and is_admin());

-- dashboard_stats – מנהלים בלבד (הפונקציה עוקפת RLS, לכן בדיקה מפורשת)
create or replace function dashboard_stats_guarded(days int default 30)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return dashboard_stats(days);
end $$;
revoke execute on function dashboard_stats(int) from public, anon, authenticated;
revoke execute on function dashboard_stats_guarded(int) from public, anon;
grant execute on function dashboard_stats_guarded(int) to authenticated;

-- ---------- 2. ביטול mark_paid ----------
drop function if exists mark_paid(text, text, text);

-- ---------- 3. הזמנה מהאתר: סטטוס מוגבל + מחירים מהשרת ----------
drop policy if exists "public insert orders" on orders;
create policy "public insert orders" on orders for insert to anon, authenticated
  with check (
    status in ('new', 'awaiting_payment')
    and payment_ref is null and admin_note is null and deleted_at is null and notified_at is null
  );

create or replace function orders_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; p record; s record;
  n_items int; qty int; total_qty int := 0;
  sub numeric := 0; disc numeric := 0; ship numeric := 0; rate numeric := 0; t jsonb;
  new_items jsonb := '[]'::jsonb;
  recent int;
begin
  -- מנהל (מהפאנל) – לא נוגעים
  if is_admin() then return new; end if;

  -- הגבלת קצב: עד 5 הזמנות ב-10 דקות לאותו טלפון / מבקר
  select count(*) into recent from orders
   where created_at > now() - interval '10 minutes'
     and (phone = new.phone or (new.visitor_id is not null and visitor_id = new.visitor_id));
  if recent >= 5 then raise exception 'יותר מדי הזמנות בזמן קצר, נסו שוב בעוד כמה דקות' using errcode = '53400'; end if;

  -- אורך שדות
  new.customer_name := left(btrim(new.customer_name), 100);
  new.phone := left(regexp_replace(new.phone, '[^0-9+]', '', 'g'), 20);
  new.email := nullif(left(btrim(new.email), 120), '');
  new.city := left(new.city, 60);
  new.address := left(new.address, 200);
  new.note := left(new.note, 1000);
  if length(new.customer_name) < 2 or length(new.phone) < 9 then raise exception 'שם או טלפון לא תקינים'; end if;
  if new.email is not null and new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'מייל לא תקין'; end if;
  if new.delivery not in ('ship', 'pick') then new.delivery := 'ship'; end if;
  if new.payment_method not in ('card', 'cash', 'whatsapp') then raise exception 'אופן תשלום לא תקין'; end if;
  new.status := case when new.payment_method = 'card' then 'awaiting_payment' else 'new' end;

  -- פריטים: מחיר ושם מטבלת המוצרים בלבד
  if jsonb_typeof(new.items) <> 'array' then raise exception 'items לא תקין'; end if;
  n_items := jsonb_array_length(new.items);
  if n_items < 1 or n_items > 60 then raise exception 'מספר פריטים לא תקין'; end if;
  for it in select * from jsonb_array_elements(new.items) loop
    qty := coalesce((it ->> 'qty')::int, 0);
    if qty < 1 or qty > 500 then raise exception 'כמות לא תקינה'; end if;
    select id, name, price, visible, stock into p from products where id = it ->> 'id';
    if not found or not p.visible then raise exception 'מוצר לא זמין: %', it ->> 'id'; end if;
    if p.stock is not null and p.stock < qty then raise exception 'אין מספיק מלאי עבור %', p.name; end if;
    new_items := new_items || jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price, 'qty', qty);
    sub := sub + p.price * qty; total_qty := total_qty + qty;
  end loop;
  new.items := new_items;

  -- הנחת כמות ומשלוח לפי ההגדרות בשרת
  select shipping_fee, free_shipping_min, discount_tiers into s from settings where id = 1;
  for t in select * from jsonb_array_elements(coalesce(s.discount_tiers, '[]'::jsonb)) loop
    if total_qty >= (t ->> 'min')::int then rate := greatest(rate, (t ->> 'pct')::numeric / 100); end if;
  end loop;
  disc := round(sub * rate, 2);
  ship := case when new.delivery = 'ship' then coalesce(s.shipping_fee, 0) else 0 end;
  if s.free_shipping_min is not null and sub - disc >= s.free_shipping_min then ship := 0; end if;

  new.subtotal := round(sub, 2); new.discount := disc; new.shipping := ship;
  new.total := round(sub - disc + ship, 2);
  new.payment_ref := null; new.admin_note := null; new.deleted_at := null; new.notified_at := null;
  return new;
end $$;
drop trigger if exists orders_validate_trg on orders;
create trigger orders_validate_trg before insert on orders for each row execute function orders_validate();

-- ---------- 4. פניות וביקורים: הגבלת קצב ואורך ----------
create or replace function callbacks_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if is_admin() then return new; end if;
  select count(*) into recent from callbacks
   where created_at > now() - interval '10 minutes'
     and (phone = new.phone or (new.visitor_id is not null and visitor_id = new.visitor_id));
  if recent >= 3 then raise exception 'יותר מדי פניות בזמן קצר' using errcode = '53400'; end if;
  new.name := left(btrim(new.name), 100);
  new.phone := left(regexp_replace(new.phone, '[^0-9+]', '', 'g'), 20);
  new.message := left(new.message, 1000);
  new.source := left(coalesce(new.source, 'site'), 30);
  if length(new.name) < 2 or length(new.phone) < 9 then raise exception 'שם או טלפון לא תקינים'; end if;
  new.status := 'new'; new.admin_note := null; new.handled_at := null; new.notified_at := null;
  return new;
end $$;
drop trigger if exists callbacks_validate_trg on callbacks;
create trigger callbacks_validate_trg before insert on callbacks for each row execute function callbacks_validate();

create or replace function visits_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from visits where visitor_id = new.visitor_id and created_at > now() - interval '1 minute';
  if recent >= 30 then raise exception 'rate limited' using errcode = '53400'; end if;
  new.visitor_id := left(new.visitor_id, 64);
  new.path := left(new.path, 200);
  new.referrer := left(new.referrer, 300);
  new.device := left(new.device, 20);
  return new;
end $$;
drop trigger if exists visits_validate_trg on visits;
create trigger visits_validate_trg before insert on visits for each row execute function visits_validate();
