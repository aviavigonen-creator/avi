// ============================================================
//  Edge Function: order-email
//  נשלחת אוטומטית בכל הזמנה חדשה (Database Webhook על טבלת orders, אירוע INSERT)
//  ובכל מעבר לסטטוס "שולם" (אירוע UPDATE).
//  שולחת: אישור הזמנה ללקוח (אם השאיר מייל) + התראה לבעל העסק.
//  שליחת המיילים דרך Resend (resend.com) — חינם עד 3,000 מיילים בחודש.
//
//  משתני סביבה (Edge Functions → Secrets):
//    RESEND_API_KEY   מפתח מ-resend.com
//    MAIL_FROM        כתובת שולח מאומתת ב-Resend, למשל "מנות של פורים <orders@yourdomain.co.il>"
//    OWNER_EMAIL      המייל שלך להתראות
//    SITE_URL         כתובת האתר (לקישור במייל)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const RESEND = Deno.env.get("RESEND_API_KEY")!;
const FROM = Deno.env.get("MAIL_FROM") ?? "onboarding@resend.dev";
const OWNER = Deno.env.get("OWNER_EMAIL");
const SITE = Deno.env.get("SITE_URL") ?? "";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ils = (n: number) => "₪" + Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const PAY: Record<string, string> = { card: "כרטיס אשראי", cash: "מזומן", whatsapp: "לסיכום בוואטסאפ" };

async function send(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

function orderHtml(o: any, store: any, title: string, intro: string) {
  const rows = o.items.map((i: any) => `<tr><td style="padding:6px 0">${esc(i.name)}</td><td style="padding:6px 8px">× ${i.qty}</td><td style="padding:6px 0;text-align:left">${ils(i.price * i.qty)}</td></tr>`).join("");
  return `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f6f3f7;font-family:Arial,sans-serif;color:#241522">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5dbe3">
    <div style="background:#4d0f2c;color:#fff;padding:22px 24px"><div style="font-size:22px;font-weight:bold">${esc(store.store_name)}</div><div style="color:#e3b252;margin-top:4px">${title}</div></div>
    <div style="padding:22px 24px;line-height:1.6">
      <p style="margin:0 0 14px">${intro}</p>
      <div style="background:#fbf8fb;border-radius:10px;padding:14px 16px;margin-bottom:14px">
        <b>הזמנה מס' ${o.order_no}</b><br>${esc(o.customer_name)} · <span dir="ltr">${esc(o.phone)}</span><br>${esc(o.city ?? "")} · ${o.delivery === "ship" ? "משלוח עד הבית" : "איסוף עצמי"}<br>תשלום: ${PAY[o.payment_method] ?? o.payment_method}
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}
        <tr><td colspan="2" style="padding:8px 0;border-top:1px solid #e5dbe3">סכום ביניים</td><td style="text-align:left;border-top:1px solid #e5dbe3">${ils(o.subtotal)}</td></tr>
        ${+o.discount ? `<tr><td colspan="2" style="color:#1f7a5c">הנחת כמות</td><td style="text-align:left;color:#1f7a5c">−${ils(o.discount)}</td></tr>` : ""}
        <tr><td colspan="2">משלוח</td><td style="text-align:left">${+o.shipping ? ils(o.shipping) : "ללא"}</td></tr>
        <tr><td colspan="2" style="padding-top:10px;font-size:18px"><b>סה"כ לתשלום</b></td><td style="text-align:left;padding-top:10px;font-size:18px"><b>${ils(o.total)}</b></td></tr>
      </table>
      ${o.note ? `<p style="margin-top:14px"><b>הערות:</b> ${esc(o.note)}</p>` : ""}
      <p style="margin-top:20px;color:#6e5868;font-size:13px">שאלות? כתבו לנו בוואטסאפ: <a href="https://wa.me/${store.whatsapp}" style="color:#7a1846">+${store.whatsapp}</a>${SITE ? ` · <a href="${SITE}" style="color:#7a1846">לאתר</a>` : ""}</p>
    </div></div></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();            // { type: "INSERT"|"UPDATE", record, old_record }
    const o = payload.record;
    if (!o) return new Response("no record", { status: 400 });
    const isNew = payload.type === "INSERT";
    const becamePaid = payload.type === "UPDATE" && o.status === "paid" && payload.old_record?.status !== "paid";
    if (!isNew && !becamePaid) return new Response("skip");

    const { data: store } = await sb.from("settings").select("store_name,whatsapp,contact_email").eq("id", 1).single();
    const s = store ?? { store_name: "מנות של פורים", whatsapp: "", contact_email: null };

    // ללקוח
    if (o.email) {
      const title = isNew ? "אישור הזמנה" : "התשלום התקבל";
      const intro = isNew
        ? `שלום ${esc(o.customer_name)}, תודה על ההזמנה! קיבלנו אותה ונחזור אליכם לאישור סופי. ${o.payment_method === "card" && o.status !== "paid" ? "אם עדיין לא השלמתם את התשלום, אפשר לעשות זאת דרך הקישור שקיבלתם באתר." : ""}`
        : `שלום ${esc(o.customer_name)}, התשלום על ההזמנה שלכם התקבל בהצלחה. המארזים בהכנה ונעדכן לקראת המשלוח. חג פורים שמח!`;
      await send(o.email, `${title} · ${s.store_name} · ${o.order_no}`, orderHtml(o, s, title, intro));
      await sb.from("orders").update({ email_sent_at: new Date().toISOString() }).eq("id", o.id);
    }
    // לבעל העסק
    const owner = OWNER ?? s.contact_email;
    if (owner && isNew) {
      await send(owner, `הזמנה חדשה ${o.order_no} · ${ils(o.total)} · ${esc(o.customer_name)}`, orderHtml(o, s, "הזמנה חדשה באתר", `נכנסה הזמנה חדשה. <a href="${SITE}admin.html" style="color:#7a1846">לפאנל הניהול</a>`));
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
