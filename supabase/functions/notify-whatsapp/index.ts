// ============================================================
//  Edge Function: notify-whatsapp
//  שולחת הודעת וואטסאפ לבעל העסק בכל:
//    • פנייה חדשה "חזרו אליי" (טבלת callbacks, INSERT)
//    • הזמנה חדשה (טבלת orders, INSERT)
//  מופעלת על ידי Database Webhooks על שתי הטבלאות.
//
//  שליחה דרך CallMeBot (חינמי לשימוש אישי):
//    1. מהוואטסאפ של בעל העסק שולחים ל-+34 644 71 81 99 את ההודעה:
//       I allow callmebot to send me messages
//    2. מקבלים בחזרה apikey.
//  משתני סביבה (Edge Functions → Secrets):
//    OWNER_WHATSAPP   972548359155   (מספר בינלאומי בלי +)
//    CALLMEBOT_APIKEY  המפתח שהתקבל
//    SITE_URL          https://mishlohi.co.il/
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OWNER = Deno.env.get("OWNER_WHATSAPP") ?? "972548359155";
const KEY = Deno.env.get("CALLMEBOT_APIKEY") ?? "";
const SITE = Deno.env.get("SITE_URL") ?? "https://mishlohi.co.il/";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ils = (n: number) => "₪" + Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });
const il = (d: string) => new Date(d).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

async function sendWhatsApp(text: string) {
  if (!KEY) throw new Error("CALLMEBOT_APIKEY is not set");
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(OWNER)}&apikey=${encodeURIComponent(KEY)}&text=${encodeURIComponent(text)}`;
  const r = await fetch(url);
  const body = await r.text();
  if (!r.ok || /error/i.test(body) && !/queued|sent/i.test(body)) throw new Error(`CallMeBot ${r.status}: ${body.slice(0, 200)}`);
}

Deno.serve(async (req) => {
  try {
    const p = await req.json(); // { type, table, record, old_record }
    if (p.type !== "INSERT" || !p.record) return new Response("skip");
    const r = p.record;
    let text = "";
    if (p.table === "callbacks") {
      text = `📞 *בקשה לחזור ללקוח*\n` +
        `שם: ${r.name}\n` +
        `טלפון: ${r.phone}\n` +
        (r.message ? `הודעה: ${r.message}\n` : "") +
        `מקור: ${r.source === "site" ? "האתר" : r.source}\n` +
        `זמן: ${il(r.created_at)}\n` +
        `לחיוג: https://wa.me/${r.phone.replace(/\D/g, "").replace(/^0/, "972")}\n` +
        `לפאנל: ${SITE}admin.html`;
    } else if (p.table === "orders") {
      const items = (r.items ?? []).map((i: any) => `• ${i.name} × ${i.qty}`).join("\n");
      const pay = ({ card: "אשראי", cash: "מזומן", whatsapp: "לסיכום בוואטסאפ" } as Record<string, string>)[r.payment_method] ?? r.payment_method;
      text = `🛒 *הזמנה חדשה ${r.order_no}*\n` +
        `שם: ${r.customer_name}\nטלפון: ${r.phone}\n` +
        (r.email ? `מייל: ${r.email}\n` : "") +
        `עיר: ${r.city ?? ""} · ${r.delivery === "ship" ? "משלוח" : "איסוף"}\n` +
        `תשלום: ${pay}\n\n${items}\n\n` +
        (Number(r.discount) ? `הנחה: −${ils(r.discount)}\n` : "") +
        (Number(r.shipping) ? `משלוח: ${ils(r.shipping)}\n` : "") +
        `*סה"כ: ${ils(r.total)}*\n` +
        (r.note ? `הערות: ${r.note}\n` : "") +
        `זמן: ${il(r.created_at)}\n` +
        `לאישור/סירוב: ${SITE}admin.html`;
    } else return new Response("skip");

    await sendWhatsApp(text);
    await sb.from(p.table).update({ notified_at: new Date().toISOString() }).eq("id", r.id);
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
