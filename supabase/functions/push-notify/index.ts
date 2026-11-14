// ============================================================
//  Edge Function: push-notify
//  שולחת התראת פוש לטלפון של בעל העסק (אפליקציית הניהול) בכל:
//    • הזמנה חדשה (orders, INSERT)
//    • פנייה חדשה (callbacks, INSERT)
//  מופעלת על ידי Database Webhooks. המנויים נשמרים בטבלת push_subscriptions.
//  Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:<כתובת של בעל העסק>), SITE_URL
// ============================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SITE = Deno.env.get("SITE_URL") ?? "https://mishlohi.co.il/";
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "https://mishlohi.co.il/", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ils = (n: number) => "₪" + Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });

Deno.serve(async (req) => {
  try {
    const p = await req.json();
    if (p.type !== "INSERT" || !p.record) return new Response("skip");
    const r = p.record;
    let payload: any;
    if (p.table === "orders") {
      const n = (r.items ?? []).reduce((a: number, i: any) => a + Number(i.qty || 0), 0);
      payload = { title: `🛒 הזמנה חדשה ${r.order_no} · ${ils(r.total)}`, body: `${r.customer_name} · ${r.phone} · ${n} מארזים · ${r.delivery === "ship" ? "משלוח" : "איסוף"}${r.note ? " · " + r.note : ""}`, tag: "order-" + r.id, url: SITE + "admin.html#orders" };
    } else if (p.table === "callbacks") {
      payload = { title: `📞 ${r.name} מבקש/ת שיחזרו אליו`, body: `${r.phone}${r.message ? " · " + r.message : ""}`, tag: "cb-" + r.id, url: SITE + "admin.html#callbacks" };
    } else return new Response("skip");

    const { data: subs } = await sb.from("push_subscriptions").select("id,endpoint,keys");
    let sent = 0, dead: number[] = [];
    for (const s of subs ?? []) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 3600, urgency: "high" }); sent++; }
      catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.id); else console.error("push failed", e?.statusCode, e?.body); }
    }
    if (dead.length) await sb.from("push_subscriptions").delete().in("id", dead);
    return new Response(JSON.stringify({ sent, removed: dead.length }));
  } catch (e) { console.error(e); return new Response(String(e), { status: 500 }); }
});
