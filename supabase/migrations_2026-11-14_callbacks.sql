
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
