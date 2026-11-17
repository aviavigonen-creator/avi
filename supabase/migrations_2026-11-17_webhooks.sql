-- Webhooks: שליחת התראת פוש לאפליקציית הניהול על כל הזמנה/פנייה חדשה
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_push_webhook()
returns trigger language plpgsql security definer as $$
begin
  perform net.http_post(
    url := 'https://zkfgcreyortjanoskmya.supabase.co/functions/v1/push-notify',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA, 'record', to_jsonb(NEW), 'old_record', null),
    timeout_milliseconds := 5000
  );
  return NEW;
end $$;

drop trigger if exists orders_push_webhook on public.orders;
create trigger orders_push_webhook after insert on public.orders
  for each row execute function public.notify_push_webhook();

drop trigger if exists callbacks_push_webhook on public.callbacks;
create trigger callbacks_push_webhook after insert on public.callbacks
  for each row execute function public.notify_push_webhook();
