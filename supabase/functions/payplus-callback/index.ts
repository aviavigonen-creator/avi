// ============================================================
//  Edge Function: payplus-callback  (IPN מ-PayPlus)
//  PayPlus שולחת לכאן POST אחרי כל ניסיון תשלום. מאמתים חתימה (HMAC-SHA256
//  עם ה-secret key על גוף הבקשה), ומעדכנים את ההזמנה ל"שולם" או משאירים ממתינה.
//  Secrets: PAYPLUS_SECRET_KEY
//  חשוב: בהגדרות הפונקציה ב-Supabase לכבות "Verify JWT" (PayPlus לא שולחת JWT).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SECRET = Deno.env.get("PAYPLUS_SECRET_KEY") ?? "";

async function hmac(body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

Deno.serve(async (req) => {
  try {
    const raw = await req.text();
    const given = req.headers.get("hash") ?? "";
    const ua = req.headers.get("user-agent") ?? "";
    if (SECRET && given && given !== await hmac(raw)) { console.warn("bad hash", ua); return new Response("bad signature", { status: 401 }); }
    const p = JSON.parse(raw || "{}");
    const t = p.transaction ?? p;                                   // תומך בשני פורמטים של PayPlus
    const status = String(t.status_code ?? p.status_code ?? "");
    const orderNo = t.more_info ?? p.more_info ?? null;
    const pageUid = t.payment_page_request_uid ?? p.page_request_uid ?? p.payment_page_request_uid ?? null;
    const txUid = t.uid ?? p.transaction_uid ?? null;
    const approval = t.approval_num ?? p.approval_num ?? null;
    const amount = Number(t.amount ?? p.amount ?? 0);
    if (!orderNo && !pageUid) return new Response("no order ref", { status: 400 });

    let q = sb.from("orders").select("id,total,status,payment_ref");
    q = orderNo ? q.eq("order_no", orderNo) : q.eq("payment_ref", pageUid);
    const { data: o } = await q.maybeSingle();
    if (!o) return new Response("order not found", { status: 404 });

    const ref = [txUid && `tx:${txUid}`, approval && `אישור:${approval}`, pageUid && `page:${pageUid}`].filter(Boolean).join(" | ");
    if (status === "000") {
      const ok = Math.abs(amount - Number(o.total)) < 0.5;
      await sb.from("orders").update({ status: ok ? "paid" : "paid_pending", payment_ref: ref || o.payment_ref, admin_note: ok ? undefined : `סכום ששולם ${amount} שונה מסכום ההזמנה ${o.total}` }).eq("id", o.id);
    } else {
      await sb.from("orders").update({ payment_ref: ref ? `${ref} | נכשל ${status}` : o.payment_ref }).eq("id", o.id);
    }
    return new Response("ok");
  } catch (e) { console.error(e); return new Response(String(e), { status: 500 }); }
});
