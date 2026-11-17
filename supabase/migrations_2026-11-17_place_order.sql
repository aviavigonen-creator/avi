-- הזמנה מהאתר דרך פונקציה בלבד: הלקוח לא קורא מטבלת orders בכלל
drop policy if exists "orders_anon_returning" on orders;

create or replace function place_order(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare o orders;
begin
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
