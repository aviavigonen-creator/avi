-- עדכון סטטיסטיקות: סטטוסים confirmed/rejected
-- סטטיסטיקות ללוח הבקרה
create or replace function dashboard_stats(days int default 30)
returns json language sql security definer as $$
  select json_build_object(
    'visits',           (select count(*) from visits where created_at > now() - make_interval(days => days)),
    'unique_visitors',  (select count(distinct visitor_id) from visits where created_at > now() - make_interval(days => days)),
    'orders',           (select count(*) from orders where created_at > now() - make_interval(days => days) and status not in ('cancelled','rejected')),
    'revenue',          (select coalesce(sum(total),0) from orders where created_at > now() - make_interval(days => days) and status in ('confirmed','paid','paid_pending','preparing','delivered')),
    'pending',          (select count(*) from orders where status in ('new','awaiting_payment','paid_pending')),
    'by_day',           (select coalesce(json_agg(d order by d.day), '[]'::json) from (
                           select v.day, v.visits, coalesce(o.orders, 0) as orders
                             from (select created_at::date as day, count(*) as visits
                                     from visits where created_at > now() - make_interval(days => days) group by 1) v
                             left join (select created_at::date as day, count(*) as orders
                                          from orders where created_at > now() - make_interval(days => days) and status not in ('cancelled','rejected') group by 1) o
                               on o.day = v.day) d),
    'top_products',     (select coalesce(json_agg(t), '[]'::json) from (
                           select i->>'name' as name, sum((i->>'qty')::int) as qty
                             from orders, jsonb_array_elements(items) i
                            where created_at > now() - make_interval(days => days) and status not in ('cancelled','rejected')
                            group by 1 order by 2 desc limit 5) t)
  );
$$;
revoke execute on function dashboard_stats(int) from public, anon;
grant execute on function dashboard_stats(int) to authenticated;
