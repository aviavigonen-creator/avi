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

-- ---------- פניות "חזרו אליי" ----------
create table if not exists callbacks (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null,
  phone       text not null,
  message     text,
  source      text default 'site',          -- site | whatsapp | phone
  status      text not null default 'new',  -- new | handled
  handled_at  timestamptz,
  admin_note  text,
  visitor_id  text,
  notified_at timestamptz
);
alter table callbacks enable row level security;
drop policy if exists "public insert callbacks" on callbacks;
create policy "public insert callbacks" on callbacks for insert to anon, authenticated with check (true);
drop policy if exists "admin read callbacks" on callbacks;
create policy "admin read callbacks" on callbacks for select to authenticated using (true);
drop policy if exists "admin update callbacks" on callbacks;
create policy "admin update callbacks" on callbacks for update to authenticated using (true) with check (true);
drop policy if exists "admin delete callbacks" on callbacks;
create policy "admin delete callbacks" on callbacks for delete to authenticated using (true);

alter table orders add column if not exists notified_at timestamptz;
-- מנויי התראות פוש של אפליקציית הניהול
create table if not exists push_subscriptions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  endpoint    text not null unique,
  keys        jsonb not null,            -- {p256dh, auth}
  user_email  text,
  device      text
);
alter table push_subscriptions enable row level security;
drop policy if exists "admin manage push" on push_subscriptions;
create policy "admin manage push" on push_subscriptions for all to authenticated using (true) with check (true);
-- PayPlus: הפעלת תשלום באשראי
update settings set pay_card_enabled = true, pay_provider = 'payplus' where id = 1;
