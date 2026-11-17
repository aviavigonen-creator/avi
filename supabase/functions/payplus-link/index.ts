// ============================================================
//  Edge Function: payplus-link
//  יוצרת דף תשלום מאובטח ב-PayPlus להזמנה קיימת ומחזירה קישור.
//  נקראת מהאתר: POST { order_id, phone }  →  { url }
//  Secrets: PAYPLUS_API_KEY, PAYPLUS_SECRET_KEY, PAYPLUS_PAGE_UID,
//           PAYPLUS_ENV = production | dev, SITE_URL
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const API = (Deno.env.get("PAYPLUS_ENV") ?? "production") === "dev" ? "https://restapidev.payplus.co.il/api/v1.0" : "https://restapi.payplus.co.il/api/v1.0";
const SITE = (Deno.env.get("SITE_URL") ?? "https://mishlohi.co.il/").replace(/\/?$/, "/");
const FN_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { order_id, phone } = await req.json();
    if (!order_id || !phone) return json({ error: "missing order_id/phone" }, 400);
    const { data: o, error } = await sb.from("orders").select("*").eq("id", order_id).eq("phone", phone).single();
    if (error || !o) return json({ error: "order not found" }, 404);
    if (!["awaiting_payment", "new"].includes(o.status)) return json({ error: "order not payable", status: o.status }, 409);

    const items = (o.items ?? []).map((i: any) => ({ name: String(i.name).slice(0, 80), quantity: Number(i.qty), price: Number(i.price), vat_type: 0 }));
    if (Number(o.discount) > 0) items.push({ name: "הנחת כמות", quantity: 1, price: -Number(o.discount), vat_type: 0 });
    if (Number(o.shipping) > 0) items.push({ name: "משלוח", quantity: 1, price: Number(o.shipping), vat_type: 0 });

    const body = {
      payment_page_uid: Deno.env.get("PAYPLUS_PAGE_UID"),
      charge_method: 1,
      amount: Number(o.total),
      currency_code: "ILS",
      sendEmailApproval: !!o.email,
      sendEmailFailure: false,
      send_failure_callback: true,
      refURL_success: `${SITE}?paid=${encodeURIComponent(o.order_no)}&ph=${encodeURIComponent(o.phone)}`,
      refURL_failure: `${SITE}?failed=${encodeURIComponent(o.order_no)}`,
      refURL_cancel: `${SITE}?failed=${encodeURIComponent(o.order_no)}`,
      refURL_callback: `${FN_BASE}/payplus-callback`,
      more_info: o.order_no,
      more_info_1: String(o.id),
      customer: { customer_name: o.customer_name, email: o.email ?? undefined, phone: o.phone, address: o.city ?? undefined },
      items,
      expiry_datetime: "60",
      language_code: "he",
    };
    const r = await fetch(`${API}/PaymentPages/generateLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": JSON.stringify({ api_key: Deno.env.get("PAYPLUS_API_KEY"), secret_key: Deno.env.get("PAYPLUS_SECRET_KEY") }) },
      body: JSON.stringify(body),
    });
    const res = await r.json().catch(() => ({}));
    const url = res?.data?.payment_page_link;
    if (!r.ok || res?.results?.status !== "success" || !url) {
      console.error("payplus generateLink failed", r.status, JSON.stringify(res).slice(0, 500));
      return json({ error: res?.results?.description || "payment page error" }, 502);
    }
    await sb.from("orders").update({ status: "awaiting_payment", payment_ref: res.data.page_request_uid }).eq("id", o.id);
    return json({ url });
  } catch (e) { console.error(e); return json({ error: String(e) }, 500); }
});
