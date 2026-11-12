-- ============================================================
--  מנות של פורים — סכמת מסד נתונים (Supabase / PostgreSQL)
--  להריץ פעם אחת ב-Supabase → SQL Editor → New query → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- מוצרים ----------
create table if not exists products (
  id          text primary key,                     -- מזהה קצר באנגלית, למשל "mickey"
  name        text not null,
  category    text not null default 'ילדים',
  price       numeric(10,2) not null check (price >= 0),
  items       text[] not null default '{}',         -- תכולת המארז, שורה לכל פריט
  image_url   text,                                 -- תמונה ראשית (Storage)
  image2_url  text,                                 -- צד ב' (אופציונלי)
  video_url   text,                                 -- סרטון (אופציונלי)
  tag         text,                                 -- "חדש", "הנמכר ביותר"...
  color       text default '#e3b252',               -- צבע רקע לכרטיס
  visible     boolean not null default true,
  sort        int not null default 100,
  stock       int,                                  -- null = ללא מעקב מלאי
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- הזמנות ----------
create table if not exists orders (
  id              bigint generated always as identity primary key,
  order_no        text generated always as ('P' || lpad(id::text, 5, '0')) stored,
  created_at      timestamptz not null default now(),
  customer_name   text not null,
  phone           text not null,
  email           text,
  city            text,
  address         text,
  delivery        text not null default 'ship',     -- ship | pick
  note            text,
  items           jsonb not null,                   -- [{id,name,price,qty}]
  subtotal        numeric(10,2) not null,
  discount        numeric(10,2) not null default 0,
  shipping        numeric(10,2) not null default 0,
  total           numeric(10,2) not null,
  payment_method  text not null default 'whatsapp', -- card | cash | whatsapp
  payment_ref     text,                             -- אסמכתא מחברת הסליקה
  status          text not null default 'new',      -- new | awaiting_payment | paid_pending | paid | preparing | delivered | cancelled
  admin_note      text,
  visitor_id      text,
  email_sent_at   timestamptz
);
create index if not exists orders_created_idx on orders (created_at desc);
create index if not exists orders_status_idx  on orders (status);

-- ---------- כניסות לאתר ----------
create table if not exists visits (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor_id  text not null,                        -- מזהה אנונימי בדפדפן
  path        text,
  referrer    text,
  device      text                                  -- mobile | desktop
);
create index if not exists visits_created_idx on visits (created_at desc);

-- ---------- הגדרות האתר (שורה אחת) ----------
create table if not exists settings (
  id                int primary key default 1 check (id = 1),
  store_name        text not null default 'מנות של פורים',
  whatsapp          text not null default '972500000000',
  contact_email     text,
  shipping_fee      numeric(10,2) not null default 25,
  free_shipping_min numeric(10,2),                  -- משלוח חינם מעל סכום (אופציונלי)
  discount_tiers    jsonb not null default '[{"min":10,"pct":5},{"min":25,"pct":10},{"min":50,"pct":15}]',
  cities            text[] not null default '{ירושלים,מבשרת ציון,בית שמש,מודיעין,בני ברק,אחר}',
  purim_date        date not null default '2027-03-23',
  last_order_text   text default 'הזמנות אחרונות עד ט'' באדר',
  banner_text       text,                           -- פס הודעה עליון (אופציונלי)
  hero_title        text default 'משלוחי מנות בכשרות בד"ץ מהדרין, ארוזים ומוכנים לשליחה',
  hero_sub          text default 'מארזים לכל תקציב: למשפחה, לשכנים, לגננת ולעובדים. כל המוצרים בכשרות מהדרין בלבד, ואנחנו דואגים למשלוח עד הדלת.',
  -- תשלום
  pay_card_enabled  boolean not null default false,
  pay_provider      text default 'none',            -- none | tranzila | link
  pay_terminal      text,                           -- שם מסוף (Tranzila)
  pay_link_template text,                           -- קישור תשלום עם {sum} {order} {name} {phone}
  pay_cash_enabled  boolean not null default true,
  -- צ'אט / אנליטיקה
  tawk_id           text,                           -- Property ID + Widget ID מ-Tawk.to, בפורמט "abc123/1xyz"
  ga_id             text,                           -- Google Analytics G-XXXX (אופציונלי)
  -- מיילים
  receipt_from      text,                           -- כתובת השולח למיילים
  updated_at        timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------- עדכון updated_at אוטומטי ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists products_touch on products;
create trigger products_touch before update on products for each row execute function touch_updated_at();
drop trigger if exists settings_touch on settings;
create trigger settings_touch before update on settings for each row execute function touch_updated_at();

-- ============================================================
--  הרשאות (Row Level Security)
--  גולשים: רואים מוצרים והגדרות, יוצרים הזמנות וכניסות.
--  אדמין (משתמש מחובר): הכול.
-- ============================================================
alter table products enable row level security;
alter table orders   enable row level security;
alter table visits   enable row level security;
alter table settings enable row level security;

drop policy if exists "public read products" on products;
create policy "public read products" on products for select using (true);
drop policy if exists "admin write products" on products;
create policy "admin write products" on products for all to authenticated using (true) with check (true);

drop policy if exists "public read settings" on settings;
create policy "public read settings" on settings for select using (true);
drop policy if exists "admin write settings" on settings;
create policy "admin write settings" on settings for all to authenticated using (true) with check (true);

drop policy if exists "public insert orders" on orders;
create policy "public insert orders" on orders for insert to anon, authenticated with check (true);
drop policy if exists "admin read orders" on orders;
create policy "admin read orders" on orders for select to authenticated using (true);
drop policy if exists "admin update orders" on orders;
create policy "admin update orders" on orders for update to authenticated using (true) with check (true);
drop policy if exists "admin delete orders" on orders;
create policy "admin delete orders" on orders for delete to authenticated using (true);

drop policy if exists "public insert visits" on visits;
create policy "public insert visits" on visits for insert to anon, authenticated with check (true);
drop policy if exists "admin read visits" on visits;
create policy "admin read visits" on visits for select to authenticated using (true);

-- לקוח שחוזר מדף התשלום מסמן את ההזמנה שלו כ"שולם – ממתין לאימות" לפי מספר הזמנה + טלפון
create or replace function mark_paid(p_order_no text, p_phone text, p_ref text default null)
returns boolean language plpgsql security definer as $$
declare n int;
begin
  update orders set status = 'paid_pending', payment_ref = coalesce(p_ref, payment_ref)
   where order_no = p_order_no and phone = p_phone and status in ('new','awaiting_payment');
  get diagnostics n = row_count;
  return n > 0;
end $$;
grant execute on function mark_paid(text,text,text) to anon, authenticated;

-- סטטיסטיקות ללוח הבקרה
create or replace function dashboard_stats(days int default 30)
returns json language sql security definer as $$
  select json_build_object(
    'visits',           (select count(*) from visits where created_at > now() - make_interval(days => days)),
    'unique_visitors',  (select count(distinct visitor_id) from visits where created_at > now() - make_interval(days => days)),
    'orders',           (select count(*) from orders where created_at > now() - make_interval(days => days) and status <> 'cancelled'),
    'revenue',          (select coalesce(sum(total),0) from orders where created_at > now() - make_interval(days => days) and status in ('paid','paid_pending','preparing','delivered')),
    'pending',          (select count(*) from orders where status in ('new','awaiting_payment','paid_pending')),
    'by_day',           (select coalesce(json_agg(d order by d.day), '[]'::json) from (
                           select date_trunc('day', created_at)::date as day, count(*) as visits,
                                  (select count(*) from orders o where o.created_at::date = date_trunc('day', v.created_at)::date and o.status <> 'cancelled') as orders
                             from visits v where created_at > now() - make_interval(days => days)
                            group by 1) d),
    'top_products',     (select coalesce(json_agg(t), '[]'::json) from (
                           select i->>'name' as name, sum((i->>'qty')::int) as qty
                             from orders, jsonb_array_elements(items) i
                            where created_at > now() - make_interval(days => days) and status <> 'cancelled'
                            group by 1 order by 2 desc limit 5) t)
  );
$$;
revoke execute on function dashboard_stats(int) from public, anon;
grant execute on function dashboard_stats(int) to authenticated;

-- ============================================================
--  אחסון תמונות: ליצור bucket ציבורי בשם  product-images
--  Storage → New bucket → name: product-images → Public bucket ✓
--  ואז להריץ:
-- ============================================================
insert into storage.buckets (id, name, public) values ('product-images','product-images', true)
  on conflict (id) do nothing;
drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "admin upload images" on storage.objects;
create policy "admin upload images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
drop policy if exists "admin update images" on storage.objects;
create policy "admin update images" on storage.objects for update to authenticated using (bucket_id = 'product-images');
drop policy if exists "admin delete images" on storage.objects;
create policy "admin delete images" on storage.objects for delete to authenticated using (bucket_id = 'product-images');

-- ============================================================
--  מוצרים ראשוניים (אפשר לערוך אחר כך בפאנל)
-- ============================================================
insert into products (id,name,category,price,items,tag,color,sort) values
 ('gold',  'מארז ממתקים מוזהב',     'מארזים', 35.00, '{"בקבוק שתייה לילדים עם פיה","כיף כף ומיני ופל Loacker","מרשמלו וחטיפי שוקולד","מטבע שוקולד","קופסת מתנה עם ידית"}', 'חדש', '#e3b252', 10),
 ('mickey','דלי מיקי מאוס',          'דליים', 39.90, '{"דלי מיקי לשימוש חוזר","משקה פרי קטיף ובקבוק עם פיה","חטיף אסם ומיני ופל Loacker","ממתקים וסוכריות","עטוף בצלופן וסרטים"}', 'פופולרי', '#e5484d', 20),
 ('bag',   'שקית הפתעות גדולה',      'שקיות', 29.90, '{"דוריטוס הריף אש ועוגיות שוקולד","גוגלס חמוץ ושרוך גוגלס","מטבעות שוקולד","כיף כף, מקופלת ומיני ופל Loacker","מרשמלו ומשחק קטן"}', 'חדש', '#d94f9b', 30),
 ('cone',  'קונוס ממתקים מוזהב',     'קונוסים', 29.90, '{"קונוס מתנה עם חלון שקוף","כיף כף ומיני ופל Loacker","חטיפי שוקולד וסוכריות","חטיף מלוח"}', 'חדש', '#c9932b', 40),
 ('pyr',   'פירמידת ממתקים',         'לגן ולכיתה',  9.90, '{"קופסת פירמידה צבעונית","ממתקים וסוכריות","מתאים לחלוקה בגן ובכיתה"}', 'חדש', '#e04a6a', 50),
 ('cone2', 'שקית קונוס ממתקים',      'קונוסים', 15.90, '{"כיף כף ומזרק שוקולד Pezzi","גוגלס סוכריות על מקל","שרוך גוגלס חמוץ","וופל Sweet וצעצוע קטן"}', 'חדש', '#6ec1e4', 60),
 ('tri',   'קונוס סופגנייה אדום',    'לגן ולכיתה', 11.90, '{"קונוס קרטון אדום עם הדפס מבריק","ממתקים וסוכריות","מתאים לחלוקה בגן ובכיתה"}', 'חדש', '#e03b2e', 70),
 ('lg',    'קונוס ענק חג אורים שמח', 'קונוסים', 39.99, '{"קונוס קרטון גדול עם ארבע פאות צבעוניות","חלונות סביבונים נ.ג.ה.פ","מלא בממתקים וסוכריות","מתאים למתנה גדולה לילד"}', 'חדש', '#8cc63f', 80)
on conflict (id) do nothing;
