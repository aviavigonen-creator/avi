-- הזמנה מהאתר דרך פונקציה בלבד: הלקוח לא קורא מטבלת orders בכלל
drop policy if exists "orders_anon_returning" on orders;

create or replace function place_order(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  perform set_config('app.place_order', '1', true);  -- הטריגר יאמת תמיד, גם אם המזמין מחובר כמנהל
  insert into orders (customer_name, phone, email, city, address, delivery, note, items,
                      subtotal, discount, shipping, total, payment_method, status, visitor_id)
  values (coalesce(p->>'customer_name',''), coalesce(p->>'phone',''), nullif(p->>'email',''), p->>'city', p->>'address',
          coalesce(p->>'delivery','ship'), nullif(p->>'note',''), coalesce(p->'items','[]'::jsonb),
          0, 0, 0, 0, coalesce(p->>'payment_method','cash'),
          case when p->>'payment_method' = 'card' then 'awaiting_payment' else 'new' end, p->>'visitor_id')
  returning * into o;
  return json_build_object('id', o.id, 'order_no', o.order_no, 'total', o.total, 'subtotal', o.subtotal,
                           'discount', o.discount, 'shipping', o.shipping, 'items', o.items);
end $$;
revoke all on function place_order(jsonb) from public;
grant execute on function place_order(jsonb) to anon, authenticated;

-- הטריגר: דילוג על אימות רק לעריכות מהפאנל, לא להזמנות מהאתר
create or replace function orders_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; p record; s record;
  n_items int; qty int; total_qty int := 0;
  sub numeric := 0; disc numeric := 0; ship numeric := 0; rate numeric := 0; t jsonb;
  new_items jsonb := '[]'::jsonb;
  recent int;
begin
  if is_admin() and coalesce(current_setting('app.place_order', true), '') <> '1' then return new; end if;

  select count(*) into recent from orders
   where created_at > now() - interval '10 minutes'
     and (phone = new.phone or (new.visitor_id is not null and visitor_id = new.visitor_id));
  if recent >= 5 then raise exception 'יותר מדי הזמנות בזמן קצר, נסו שוב בעוד כמה דקות' using errcode = '53400'; end if;

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

-- ניקוי הזמנות בדיקה
delete from orders where customer_name like 'בדיקת אבטחה%' or customer_name like '%בדיקה קלוד%' or customer_name like '%onerror%';
