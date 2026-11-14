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
