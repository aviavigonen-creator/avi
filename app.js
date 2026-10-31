/* ============================================================
   מנות של פורים — לוגיקת החנות
   עובד בשני מצבים:
   • מחובר ל-Supabase: מוצרים והגדרות מהמסד, הזמנות נשמרות, מעקב כניסות, תשלום.
   • לא מחובר: מוצרים מוטבעים, הזמנה דרך וואטסאפ בלבד.
   ============================================================ */
(function(){
"use strict";
const $ = s=>document.querySelector(s);
const CFG = window.SITE_CONFIG||{};
const DB_ON = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
const sb = DB_ON ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
const EMB = window.EMBEDDED_IMAGES||{};

// ---------- ברירות מחדל (נדרסות מהמסד) ----------
let S = {
  store_name:"מנות של פורים", whatsapp:"972500000000", shipping_fee:25, free_shipping_min:null,
  discount_tiers:[{min:10,pct:5},{min:25,pct:10},{min:50,pct:15}],
  cities:["ירושלים","מבשרת ציון","בית שמש","מודיעין","בני ברק","אחר"],
  purim_date:"2027-03-23", last_order_text:"הזמנות אחרונות עד ט' באדר", banner_text:null,
  hero_title:null, hero_sub:null,
  pay_card_enabled:false, pay_provider:"none", pay_terminal:"", pay_link_template:"",
  pay_bit_enabled:true, pay_bit_phone:"", pay_cash_enabled:true, tawk_id:"", ga_id:""
};
let PRODUCTS = [
  {id:"gold",  name:"מארז ממתקים מוזהב",     category:"ילדים", price:35,    tag:"חדש", color:"#e3b252", items:["בקבוק שתייה לילדים עם פיה","כיף כף ומיני ופל Loacker","מרשמלו וחטיפי שוקולד","מטבע שוקולד","קופסת מתנה עם ידית"]},
  {id:"mickey",name:"דלי מיקי מאוס",          category:"ילדים", price:39.9,  tag:"חדש", color:"#e5484d", items:["דלי מיקי לשימוש חוזר","משקה פרי קטיף ובקבוק עם פיה","חטיף אסם ומיני ופל Loacker","ממתקים וסוכריות","עטוף בצלופן וסרטים"]},
  {id:"bag",   name:"שקית הפתעות גדולה",      category:"ילדים", price:29.9,  tag:"חדש", color:"#d94f9b", items:["דוריטוס הריף אש ועוגיות שוקולד","גוגלס חמוץ ושרוך גוגלס","מטבעות שוקולד","כיף כף, מקופלת ומיני ופל Loacker","מרשמלו ומשחק קטן"]},
  {id:"cone",  name:"קונוס ממתקים מוזהב",     category:"ילדים", price:29.9,  tag:"חדש", color:"#c9932b", items:["קונוס מתנה עם חלון שקוף","כיף כף ומיני ופל Loacker","חטיפי שוקולד וסוכריות","חטיף מלוח"]},
  {id:"pyr",   name:"פירמידת ממתקים",         category:"ילדים", price:9.9,   tag:"חדש", color:"#e04a6a", items:["קופסת פירמידה צבעונית","ממתקים וסוכריות","מתאים לחלוקה בגן ובכיתה"]},
  {id:"cone2", name:"שקית קונוס ממתקים",      category:"ילדים", price:15.9,  tag:"חדש", color:"#6ec1e4", items:["כיף כף ומזרק שוקולד Pezzi","גוגלס סוכריות על מקל","שרוך גוגלס חמוץ","וופל Sweet וצעצוע קטן"]},
  {id:"tri",   name:"קונוס סופגנייה אדום",    category:"ילדים", price:11.9,  tag:"חדש", color:"#e03b2e", items:["קונוס קרטון אדום עם הדפס מבריק","ממתקים וסוכריות","מתאים לחלוקה בגן ובכיתה"]},
  {id:"lg",    name:"קונוס ענק חג אורים שמח", category:"ילדים", price:39.99, tag:"חדש", color:"#8cc63f", items:["קונוס קרטון גדול עם ארבע פאות צבעוניות","חלונות סביבונים נ.ג.ה.פ","מלא בממתקים וסוכריות","מתאים למתנה גדולה לילד"]}
];
const ils = n=>"₪"+(Math.round(n*100)/100).toLocaleString("he-IL",{maximumFractionDigits:2,minimumFractionDigits:Number.isInteger(Math.round(n*100)/100)?0:2});
const esc = s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// תמונות: מהמסד, ואם אין — מהקובץ המוטבע
function media(p){
  const e=EMB[p.id]||{};
  return { img:p.image_url||e.img||null, img2:p.image2_url||e.img2||null, video:p.video_url||e.video||null, poster:e.poster||null };
}

// ---------- מזהה מבקר אנונימי ----------
function visitorId(){
  try{ let v=localStorage.getItem("mm-vid"); if(!v){ v=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now()); localStorage.setItem("mm-vid",v);} return v; }catch(e){ return "anon"; }
}
async function trackVisit(){
  if(!DB_ON) return;
  try{
    const k="mm-visit-"+new Date().toISOString().slice(0,13); // פעם בשעה לכל מבקר
    if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k,"1");
    await sb.from("visits").insert({visitor_id:visitorId(), path:location.pathname+location.hash, referrer:document.referrer||null, device:/Mobi|Android/i.test(navigator.userAgent)?"mobile":"desktop"});
  }catch(e){}
}

// ---------- טעינה מהמסד ----------
async function loadData(){
  if(!DB_ON) return;
  try{
    const [{data:st},{data:pr}] = await Promise.all([
      sb.from("settings").select("*").eq("id",1).maybeSingle(),
      sb.from("products").select("*").eq("visible",true).order("sort",{ascending:true})
    ]);
    if(st) S={...S,...st};
    if(pr&&pr.length) PRODUCTS=pr;
  }catch(e){ console.warn("DB load failed, using embedded data",e); }
}

// ---------- רינדור ----------
function applySettings(){
  document.title=S.store_name;
  if(S.hero_title) $("#heroTitle").innerHTML=esc(S.hero_title).replace(/בד"ץ מהדרין/,'<em>בד"ץ מהדרין</em>');
  if(S.hero_sub) $("#heroSub").textContent=S.hero_sub;
  $("#lastOrder").textContent=S.last_order_text||"";
  if(S.banner_text){ $("#banner").textContent=S.banner_text; $("#banner").hidden=false; }
  $("#fCity").innerHTML=(S.cities||[]).map(c=>`<option>${esc(c)}</option>`).join("");
  $("#shipOpt").textContent=`משלוח עד הבית (${ils(S.shipping_fee)})`;
  $("#tiers").innerHTML=`<tr><td>1–${(S.discount_tiers[0]?.min||10)-1}</td><td>מחיר מלא</td></tr>`+S.discount_tiers.map((t,i)=>{const nx=S.discount_tiers[i+1];return `<tr><td>${t.min}${nx?`–${nx.min-1}`:" ומעלה"}</td><td class="off">${t.pct}%</td></tr>`}).join("");
  // אמצעי תשלום
  const pm=$("#fPay"); pm.innerHTML="";
  if(S.pay_card_enabled && S.pay_provider!=="none") pm.innerHTML+=`<option value="card">כרטיס אשראי (מאובטח)</option>`;
  if(S.pay_bit_enabled) pm.innerHTML+=`<option value="bit">ביט / פייבוקס</option>`;
  if(S.pay_cash_enabled) pm.innerHTML+=`<option value="cash">מזומן באיסוף / במסירה</option>`;
  pm.innerHTML+=`<option value="whatsapp">סיכום בוואטסאפ</option>`;
  const days=Math.max(0,Math.ceil((new Date(S.purim_date+"T00:00:00")-new Date())/864e5)); $("#days").textContent=days;
  $("#a11yPhone").textContent="+"+S.whatsapp;
  $("#waFloat").href=`https://wa.me/${S.whatsapp}?text=${encodeURIComponent("שלום, אשמח לפרטים על משלוחי מנות")}`;
  if(S.tawk_id){ const sc=document.createElement("script"); sc.async=true; sc.src="https://embed.tawk.to/"+S.tawk_id+"/default"; sc.charset="UTF-8"; sc.setAttribute("crossorigin","*"); document.body.appendChild(sc); $("#waFloat").hidden=true; }
  if(S.ga_id){ const g=document.createElement("script"); g.async=true; g.src="https://www.googletagmanager.com/gtag/js?id="+S.ga_id; document.head.appendChild(g); window.dataLayer=window.dataLayer||[]; window.gtag=function(){dataLayer.push(arguments)}; gtag("js",new Date()); gtag("config",S.ga_id); }
}
const CATS=()=>["הכל",...new Set(PRODUCTS.map(p=>p.category))];
let activeCat="הכל";
function boxArt(p){const c=p.color||"#e3b252",b="#4d0f2c";return `<svg viewBox="0 0 120 100" role="img" aria-label="איור של ${esc(p.name)}"><rect x="14" y="38" width="92" height="56" rx="6" fill="${b}"/><rect x="8" y="26" width="104" height="18" rx="4" fill="${b}" opacity=".85"/><rect x="54" y="26" width="12" height="68" fill="${c}"/><path d="M60 26 C40 6 26 16 38 24 C44 28 54 27 60 26 Z" fill="${c}"/><path d="M60 26 C80 6 94 16 82 24 C76 28 66 27 60 26 Z" fill="${c}"/><circle cx="60" cy="25" r="5" fill="${c}"/></svg>`;}
function renderFilters(){ $("#filters").innerHTML=CATS().map(c=>`<button class="chip" type="button" aria-pressed="${c===activeCat}" data-cat="${esc(c)}">${esc(c)}</button>`).join(""); }
function renderGrid(){
  const list=PRODUCTS.filter(p=>activeCat==="הכל"||p.category===activeCat);
  $("#grid").innerHTML=list.map(p=>{
    const m=media(p); const out=p.stock!==null&&p.stock!==undefined&&p.stock<=0;
    let vis="";
    if(m.img&&m.video) vis=`<img class="photo" id="ph-${p.id}" src="${m.img}" alt="${esc(p.name)}"><video class="vid" id="vd-${p.id}" src="${m.video}" ${m.poster?`poster="${m.poster}"`:""} muted loop playsinline preload="none" hidden></video><div class="sides" role="group" aria-label="תצוגה"><button type="button" aria-pressed="true" data-view="${p.id}" data-n="1">תמונה</button><button type="button" aria-pressed="false" data-view="${p.id}" data-n="2">סרטון</button></div>`;
    else if(m.img) vis=`<img class="photo" id="ph-${p.id}" src="${m.img}" alt="${esc(p.name)}">`+(m.img2?`<div class="sides" role="group" aria-label="צד"><button type="button" aria-pressed="true" data-side="${p.id}" data-n="1">צד א</button><button type="button" aria-pressed="false" data-side="${p.id}" data-n="2">צד ב</button></div>`:"");
    else vis=boxArt(p);
    return `<article class="card" role="listitem" aria-labelledby="t-${p.id}">
      <div class="art${m.img?" tall":""}" style="background:color-mix(in srgb, ${p.color||"#e3b252"} 22%, var(--surface))">
        ${p.tag?`<span class="badge">${esc(p.tag)}</span>`:""}${vis}<span class="kos" aria-hidden="true">בד"ץ מהדרין</span>
      </div>
      <div class="body"><h3 id="t-${p.id}">${esc(p.name)}</h3><ul>${(p.items||[]).map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
        <div class="row"><div class="price">${ils(p.price)} <small>למארז</small></div>
        ${out?`<span class="soldout">אזל המלאי</span>`:`<button class="add" type="button" data-add="${p.id}" aria-label="הוספת ${esc(p.name)} לעגלה, ${ils(p.price)}">הוספה לעגלה</button>`}</div>
      </div></article>`}).join("") || `<p class="empty">אין מארזים בקטגוריה הזו כרגע.</p>`;
}

// ---------- עגלה ----------
let cart={}; try{ cart=JSON.parse(localStorage.getItem("mm-cart")||"{}") }catch(e){}
const save=()=>{ try{ localStorage.setItem("mm-cart",JSON.stringify(cart)) }catch(e){} };
const P=id=>PRODUCTS.find(p=>p.id===id);
function totals(){
  for(const id of Object.keys(cart)) if(!P(id)) delete cart[id];
  const qty=Object.values(cart).reduce((a,b)=>a+b,0);
  const sub=Object.entries(cart).reduce((a,[id,q])=>a+P(id).price*q,0);
  let rate=0; for(const t of S.discount_tiers) if(qty>=t.min) rate=t.pct/100;
  const disc=sub*rate;
  let ship=qty&&$("#fDelivery").value==="ship"?Number(S.shipping_fee):0;
  if(S.free_shipping_min&&sub-disc>=Number(S.free_shipping_min)) ship=0;
  return {qty,sub,rate,disc,ship,total:sub-disc+ship};
}
function renderCart(){
  const t=totals(); $("#cartCount").textContent=t.qty; $("#cartCount").setAttribute("aria-label",t.qty+" פריטים");
  const ids=Object.keys(cart);
  $("#lines").innerHTML=ids.length?ids.map(id=>{const p=P(id);return `<div class="line"><div class="nm">${esc(p.name)}</div><div>${ils(p.price*cart[id])}</div>
    <div class="qty"><button type="button" data-dec="${id}" aria-label="הפחתת כמות של ${esc(p.name)}">−</button><span aria-live="polite">${cart[id]}</span><button type="button" data-inc="${id}" aria-label="הוספת כמות של ${esc(p.name)}">+</button></div>
    <div class="muted" style="font-size:.85rem">${ils(p.price)} ליחידה</div></div>`}).join(""):`<div class="empty">העגלה ריקה. בחרו מארז מהרשימה.</div>`;
  $("#sum").innerHTML=ids.length?`<div><span>סכום ביניים (${t.qty} מארזים)</span><span>${ils(t.sub)}</span></div>${t.rate?`<div class="disc"><span>הנחת כמות ${t.rate*100}%</span><span>−${ils(t.disc)}</span></div>`:""}<div><span>משלוח</span><span>${t.ship?ils(t.ship):"ללא"}</span></div><div class="tot"><span>לתשלום</span><span>${ils(t.total)}</span></div>`:"";
  $("#orderForm").hidden=!ids.length; if(!ids.length) $("#done").hidden=true; save();
}
function toast(msg){ const el=$("#toast"); el.textContent=msg; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>el.hidden=true,1800); }
function announce(msg){ const a=$("#announce"); a.textContent=""; setTimeout(()=>a.textContent=msg,50); }

// ---------- תשלום ----------
function paymentUrl(order){
  const sum=order.total.toFixed(2), name=encodeURIComponent(order.customer_name), phone=encodeURIComponent(order.phone);
  const back=encodeURIComponent((CFG.SITE_URL||location.href.split("?")[0])+`?paid=${order.order_no}&ph=${order.phone}`);
  const fail=encodeURIComponent((CFG.SITE_URL||location.href.split("?")[0])+`?failed=${order.order_no}`);
  if(S.pay_provider==="tranzila" && S.pay_terminal)
    return `https://direct.tranzila.com/${encodeURIComponent(S.pay_terminal)}/iframenew.php?sum=${sum}&currency=1&cred_type=1&lang=il&contact=${name}&phone=${phone}&pdesc=${encodeURIComponent("הזמנה "+order.order_no)}&myorder=${order.order_no}&success_url_address=${back}&fail_url_address=${fail}`;
  if(S.pay_provider==="link" && S.pay_link_template)
    return S.pay_link_template.replace("{sum}",sum).replace("{order}",order.order_no).replace("{name}",name).replace("{phone}",phone);
  return null;
}
function orderText(o){
  const lines=o.items.map(i=>`• ${i.name} × ${i.qty}`).join("\n");
  const pay={card:"כרטיס אשראי",bit:"ביט / פייבוקס",cash:"מזומן",whatsapp:"לסיכום"}[o.payment_method];
  return `הזמנת משלוחי מנות${o.order_no?` מס' ${o.order_no}`:""}\nשם: ${o.customer_name}\nטלפון: ${o.phone}${o.email?`\nמייל: ${o.email}`:""}\nעיר: ${o.city}\nקבלה: ${o.delivery==="ship"?"משלוח עד הבית":"איסוף עצמי"}\nתשלום: ${pay}\n\n${lines}\n\n${o.discount?`הנחת כמות: −${ils(o.discount)}\n`:""}${o.shipping?`משלוח: ${ils(o.shipping)}\n`:""}סה"כ לתשלום: ${ils(o.total)}${o.note?`\n\nהערות: ${o.note}`:""}`;
}
async function submitOrder(e){
  e.preventDefault();
  const name=$("#fName").value.trim(), phone=$("#fPhone").value.replace(/[^\d+]/g,""), email=$("#fEmail").value.trim();
  if(!name||phone.length<9){ toast("נא למלא שם וטלפון תקין"); (name?$("#fPhone"):$("#fName")).focus(); return; }
  if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ toast("כתובת מייל לא תקינה"); $("#fEmail").focus(); return; }
  const t=totals();
  const order={customer_name:name, phone, email:email||null, city:$("#fCity").value, delivery:$("#fDelivery").value, note:$("#fNote").value.trim()||null,
    items:Object.entries(cart).map(([id,q])=>({id,name:P(id).name,price:P(id).price,qty:q})),
    subtotal:+t.sub.toFixed(2), discount:+t.disc.toFixed(2), shipping:+t.ship.toFixed(2), total:+t.total.toFixed(2),
    payment_method:$("#fPay").value, status:$("#fPay").value==="card"?"awaiting_payment":"new", visitor_id:visitorId()};
  const btn=$("#submitBtn"); btn.disabled=true; btn.textContent="שולח…";
  let saved=null;
  if(DB_ON){ try{ const {data,error}=await sb.from("orders").insert(order).select("order_no,id").single(); if(error) throw error; saved=data; }catch(err){ console.warn(err); } }
  order.order_no=saved?.order_no||null;
  btn.disabled=false; btn.textContent="שליחת הזמנה";
  const text=orderText(order);
  $("#summary").textContent=text;
  $("#waLink").href=`https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
  $("#phoneShow").textContent="+"+S.whatsapp;
  const d=$("#done"); d.hidden=false;
  const h=$("#doneHead"), payBox=$("#payBox"); payBox.innerHTML="";
  if(order.payment_method==="card"){
    const url=paymentUrl(order);
    h.textContent=order.order_no?`הזמנה ${order.order_no} נקלטה. עכשיו לתשלום מאובטח:`:"ההזמנה מוכנה. עכשיו לתשלום מאובטח:";
    if(url){ payBox.innerHTML=`<a class="paybtn" href="${url}">מעבר לתשלום בכרטיס אשראי ${ils(order.total)}</a><small>התשלום מתבצע בדף מאובטח של חברת הסליקה. בסיום תוחזרו לאתר.</small>`; }
    else payBox.innerHTML=`<small>תשלום באשראי עדיין לא הופעל. שלחו את ההזמנה בוואטסאפ ונחזור אליכם עם קישור לתשלום.</small>`;
  } else if(order.payment_method==="bit"){
    h.textContent=order.order_no?`הזמנה ${order.order_no} נקלטה.`:"ההזמנה מוכנה.";
    payBox.innerHTML=`<div class="bitbox"><b>לתשלום בביט / פייבוקס:</b> העבירו ${ils(order.total)} למספר <span class="num">${esc(S.pay_bit_phone||"+"+S.whatsapp)}</span>${order.order_no?` וציינו בהערה "${order.order_no}"`:""}. לאחר ההעברה שלחו לנו צילום מסך בוואטסאפ.</div>`;
  } else if(order.payment_method==="cash"){
    h.textContent=order.order_no?`הזמנה ${order.order_no} נקלטה. התשלום במזומן ${order.delivery==="ship"?"במסירה":"באיסוף"}.`:"ההזמנה מוכנה.";
  } else h.textContent=order.order_no?`הזמנה ${order.order_no} נקלטה. שלחו אותה אלינו בוואטסאפ כדי שנאשר:`:"ההזמנה מוכנה. שלחו אותה אלינו בוואטסאפ כדי שנאשר:";
  announce(h.textContent);
  if(saved){ try{ cart={}; save(); }catch(e){} }
  d.scrollIntoView({behavior:"smooth",block:"start"});
}

// חזרה מדף התשלום
async function handleReturn(){
  const q=new URLSearchParams(location.search);
  if(q.get("paid")){
    let ok=false;
    if(DB_ON){ try{ const {data}=await sb.rpc("mark_paid",{p_order_no:q.get("paid"),p_phone:q.get("ph")||"",p_ref:q.get("ref")||null}); ok=!!data; }catch(e){} }
    $("#banner").textContent=`תודה! התשלום על הזמנה ${q.get("paid")} התקבל${ok?"":" (ממתין לאימות)"}. נשלח לכם אישור ונעדכן על המשלוח.`; $("#banner").hidden=false; $("#banner").focus?.();
    cart={}; save(); history.replaceState(null,"",location.pathname);
  } else if(q.get("failed")){
    $("#banner").textContent=`התשלום על הזמנה ${q.get("failed")} לא הושלם. אפשר לנסות שוב או לשלוח לנו הודעה בוואטסאפ.`; $("#banner").hidden=false; history.replaceState(null,"",location.pathname);
  }
}

// ---------- אירועים ----------
document.addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b) return;
  if(b.dataset.view){ const id=b.dataset.view, v=$("#vd-"+id), im=$("#ph-"+id), vid=b.dataset.n==="2"; v.hidden=!vid; im.hidden=vid; if(vid) v.play().catch(()=>{}); else v.pause(); b.parentElement.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); return; }
  if(b.dataset.side){ const p=P(b.dataset.side), m=media(p); $("#ph-"+p.id).src=b.dataset.n==="2"?m.img2:m.img; b.parentElement.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); return; }
  if(b.dataset.cat){ activeCat=b.dataset.cat; renderFilters(); renderGrid(); }
  if(b.dataset.add){ cart[b.dataset.add]=(cart[b.dataset.add]||0)+1; renderCart(); toast("נוסף לעגלה"); announce(P(b.dataset.add).name+" נוסף לעגלה. בעגלה כעת "+totals().qty+" פריטים"); }
  if(b.dataset.inc){ cart[b.dataset.inc]++; renderCart(); }
  if(b.dataset.dec){ if(--cart[b.dataset.dec]<=0) delete cart[b.dataset.dec]; renderCart(); }
});
let lastFocus=null;
function openDrawer(){ lastFocus=document.activeElement; $("#drawer").hidden=false; $("#openCart").setAttribute("aria-expanded","true"); document.body.style.overflow="hidden"; setTimeout(()=>$("#closeCart").focus(),30); }
function closeDrawer(){ if($("#drawer").hidden) return; $("#drawer").hidden=true; $("#openCart").setAttribute("aria-expanded","false"); document.body.style.overflow=""; (lastFocus||$("#openCart")).focus(); }
$("#openCart").onclick=openDrawer; $("#closeCart").onclick=closeDrawer;
$("#drawer").addEventListener("click",e=>{ if(e.target.id==="drawer") closeDrawer(); });
$("#drawer").addEventListener("keydown",e=>{ if(e.key!=="Tab") return; const f=[...$("#drawer").querySelectorAll('button,[href],input,select,textarea')].filter(x=>!x.hidden&&x.offsetParent!==null); if(!f.length) return; const a=f[0],z=f[f.length-1]; if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();} else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();} });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ closeDrawer(); closeA11y(); } });
$("#fDelivery").onchange=renderCart;
$("#orderForm").addEventListener("submit",submitOrder);
$("#copyBtn").onclick=()=>{ const text=$("#summary").textContent; navigator.clipboard.writeText(text).then(()=>toast("הועתק")).catch(()=>{ const r=document.createRange(); r.selectNodeContents($("#summary")); const s=getSelection(); s.removeAllRanges(); s.addRange(r); toast("סמנו והעתיקו ידנית"); }); };

// ---------- נגישות ----------
const A11Y_KEYS=["big","bigger","contrast","links","motion","font","gray","cursor"];
let a11y={}; try{ a11y=JSON.parse(localStorage.getItem("mm-a11y")||"{}") }catch(e){}
function applyA11y(){ A11Y_KEYS.forEach(k=>document.documentElement.classList.toggle("a-"+k,!!a11y[k])); document.querySelectorAll("#a11yMenu .opt").forEach(b=>{ const on=!!a11y[b.dataset.a]; b.setAttribute("aria-pressed",on); const st=b.querySelector(".st"); if(st&&!/A\+/.test(st.textContent)) st.textContent=on?"פעיל":"כבוי"; }); try{ localStorage.setItem("mm-a11y",JSON.stringify(a11y)) }catch(e){} }
function openA11y(){ $("#a11yMenu").hidden=false; $("#a11yBtn").setAttribute("aria-expanded","true"); $("#a11yClose").focus(); }
function closeA11y(){ if($("#a11yMenu").hidden) return; $("#a11yMenu").hidden=true; $("#a11yBtn").setAttribute("aria-expanded","false"); $("#a11yBtn").focus(); }
$("#a11yBtn").onclick=()=>$("#a11yMenu").hidden?openA11y():closeA11y(); $("#a11yClose").onclick=closeA11y;
$("#a11yStmt").onclick=()=>{ closeA11y(); setTimeout(()=>$("#accessibility").focus(),50); };
document.querySelectorAll("#a11yMenu .opt").forEach(b=>b.onclick=()=>{ const k=b.dataset.a; if(k==="big"){a11y.big=!a11y.big; if(a11y.big)a11y.bigger=false;} else if(k==="bigger"){a11y.bigger=!a11y.bigger; if(a11y.bigger)a11y.big=false;} else a11y[k]=!a11y[k]; applyA11y(); announce(b.firstChild.textContent.trim()+(a11y[k]?" הופעל":" כובה")); });
$("#a11yReset").onclick=()=>{ a11y={}; applyA11y(); announce("הגדרות הנגישות אופסו"); };
document.querySelector(".skip").addEventListener("click",e=>{ e.preventDefault(); $("#shop").focus(); $("#shop").scrollIntoView(); });

// ---------- הפעלה ----------
(async function init(){
  applyA11y();
  await loadData();
  applySettings(); renderFilters(); renderGrid(); renderCart();
  await handleReturn();
  trackVisit();
})();
})();
