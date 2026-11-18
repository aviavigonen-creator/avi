-- פנייה בצ'אט → גם פוש לאפליקציה וגם וואטסאפ לבעל העסק
create or replace function public.notify_push_webhook()
returns trigger language plpgsql security definer as $$
declare body jsonb;
begin
  body := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA, 'record', to_jsonb(NEW),
                             'old_record', case when TG_OP='UPDATE' then to_jsonb(OLD) else null end);
  perform net.http_post(url := 'https://zkfgcreyortjanoskmya.supabase.co/functions/v1/push-notify',
                        headers := '{"Content-Type":"application/json"}'::jsonb, body := body, timeout_milliseconds := 5000);
  if TG_TABLE_NAME = 'callbacks' and TG_OP = 'INSERT' then
    perform net.http_post(url := 'https://zkfgcreyortjanoskmya.supabase.co/functions/v1/notify-whatsapp',
                          headers := '{"Content-Type":"application/json"}'::jsonb, body := body, timeout_milliseconds := 8000);
  end if;
  return NEW;
end $$;
