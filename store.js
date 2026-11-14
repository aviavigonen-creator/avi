/* ============================================================
   מנות של פורים — חנות ב-React (ללא build: React UMD + htm)
   שומר על אותו מסד נתונים, הזמנות, תשלום ונגישות כמו קודם.
   ============================================================ */
(function(){
"use strict";
const {useState,useEffect,useMemo,useRef,useCallback}=React;
const html=htm.bind(React.createElement);
const CFG=window.SITE_CONFIG||{};
const DB_ON=!!(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY&&window.supabase);
const sb=DB_ON?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;
const EMB=window.EMBEDDED_IMAGES||{};

const DEFAULT_S={store_name:"מנות של פורים",whatsapp:"972500000000",shipping_fee:25,free_shipping_min:null,
  discount_tiers:[{min:10,pct:5},{min:25,pct:10},{min:50,pct:15}],cities:["ירושלים","מבשרת ציון","בית שמש","מודיעין","בני ברק","אחר"],
  purim_date:"2027-03-23",last_order_text:"הזמנות אחרונות עד ט' באדר",banner_text:null,hero_title:null,hero_sub:null,
  pay_card_enabled:false,pay_provider:"none",pay_terminal:"",pay_link_template:"",pay_cash_enabled:true,tawk_id:"",ga_id:""};
const DEFAULT_P=[
  {id:"gold",  name:"מארז ממתקים מוזהב",     category:"מארזים",  price:35,    tag:"חדש", color:"#e3b252", items:["בקבוק שתייה לילדים עם פיה","כיף כף ומיני ופל Loacker","מרשמלו וחטיפי שוקולד","מטבע שוקולד","קופסת מתנה עם ידית"]},
  {id:"mickey",name:"דלי מיקי מאוס",          category:"דליים",   price:39.9,  tag:"פופולרי", color:"#e5484d", items:["דלי מיקי לשימוש חוזר","משקה פרי קטיף ובקבוק עם פיה","חטיף אסם ומיני ופל Loacker","ממתקים וסוכריות","עטוף בצלופן וסרטים"]},
  {id:"bag",   name:"שקית הפתעות גדולה",      category:"שקיות",   price:29.9,  tag:"חדש", color:"#d94f9b", items:["דוריטוס הריף אש ועוגיות שוקולד","גוגלס חמוץ ושרוך גוגלס","מטבעות שוקולד","כיף כף, מקופלת ומיני ופל Loacker","מרשמלו ומשחק קטן"]},
  {id:"cone",  name:"קונוס ממתקים מוזהב",     category:"קונוסים", price:29.9,  tag:"חדש", color:"#c9932b", items:["קונוס מתנה עם חלון שקוף","כיף כף ומיני ופל Loacker","חטיפי שוקולד וסוכריות","חטיף מלוח"]},
  {id:"pyr",   name:"פירמידת ממתקים",         category:"לגן ולכיתה", price:9.9, tag:"חדש", color:"#e04a6a", items:["קופסת פירמידה צבעונית","ממתקים וסוכריות","מתאים לחלוקה בגן ובכיתה"]},
  {id:"cone2", name:"שקית קונוס ממתקים",      category:"קונוסים", price:15.9,  tag:"חדש", color:"#6ec1e4", items:["כיף כף ומזרק שוקולד Pezzi","גוגלס סוכריות על מקל","שרוך גוגלס חמוץ","וופל Sweet וצעצוע קטן"]},
  {id:"tri",   name:"קונוס סופגנייה אדום",    category:"לגן ולכיתה", price:11.9, tag:"חדש", color:"#e03b2e", items:["קונוס קרטון אדום עם הדפס מבריק","ממתקים וסוכריות","מתאים לחלוקה בגן ובכיתה"]},
  {id:"lg",    name:"קונוס ענק חג אורים שמח", category:"קונוסים", price:39.99, tag:"חדש", color:"#8cc63f", items:["קונוס קרטון גדול עם ארבע פאות צבעוניות","חלונות סביבונים נ.ג.ה.פ","מלא בממתקים וסוכריות","מתאים למתנה גדולה לילד"]}
];
const CAT_ICON={"הכל":"🍬","מארזים":"🎁","דליים":"🪣","שקיות":"🛍️","קונוסים":"🍦","לגן ולכיתה":"🏫","ילדים":"🧒","מוסדות":"🕍","יוקרה":"✨","קלאסי":"🍷"};
const ils=n=>"₪"+(Math.round(n*100)/100).toLocaleString("he-IL",{maximumFractionDigits:2,minimumFractionDigits:Number.isInteger(Math.round(n*100)/100)?0:2});
const media=p=>{const e=EMB[p.id]||{};return {img:p.image_url||e.img||null,img2:p.image2_url||e.img2||null,video:p.video_url||e.video||null,poster:e.poster||null};};
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
function visitorId(){try{let v=localStorage.getItem("mm-vid");if(!v){v=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now());localStorage.setItem("mm-vid",v);}return v;}catch(e){return "anon"}}

// ---------- אייקונים ----------
const I={
  cart:html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>`,
  search:html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  menu:html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>`,
  phone:html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>`,
  wa:html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>`,
  a11y:html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="4" r="2"/><path d="M19 8.5c-2.3.6-4.6.9-7 .9s-4.7-.3-7-.9l-.5 1.9c1.7.5 3.4.8 5.1.9v3.2l-2.3 7.1 1.9.6 2.6-6.9h.4l2.6 6.9 1.9-.6-2.3-7.1v-3.2c1.7-.1 3.4-.4 5.1-.9z"/></svg>`
};
const Drip=()=>html`<svg class="drip" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><path fill="#5a2a16" d="M0 0h1440v38c-40 0-50 60-90 60s-40-40-80-40-50 30-90 30-30-55-70-55-50 40-90 40-40-25-80-25-45 45-85 45-40-70-80-70-50 30-90 30-35-20-75-20-50 50-90 50-45-35-85-35-40 20-80 20-50-60-90-60-40 35-80 35-40-20-80-20-55 47-95 47-40-33-80-33V0z"/><path fill="#7a3d22" opacity=".9" d="M0 0h1440v22c-60 0-60 30-120 30s-60-20-120-20-60 25-120 25-60-30-120-30-60 20-120 20-60-25-120-25-60 30-120 30-60-20-120-20-60 25-120 25-60-30-120-30-60 20-120 20-60-22-120-22V0z"/></svg>`;

// ---------- האפליקציה ----------
function App(){
  const [S,setS]=useState(DEFAULT_S);
  const [P,setP]=useState(DEFAULT_P);
  const [cart,setCart]=useState(()=>ls.get("mm-cart",{}));
  const [cat,setCat]=useState("הכל");
  const [q,setQ]=useState("");
  const [open,setOpen]=useState(false);
  const [view,setView]=useState(null);       // מוצר לפרטים
  const [notice,setNotice]=useState(null);   // {title,ok,cancel,resolve}
  const [cb,setCb]=useState(false);          // טופס "חזרו אליי"
  const [banner,setBanner]=useState(null);
  const [toastMsg,setToastS]=useState(null);const toastT=useRef(null);
  const [a11yOpen,setA11yOpen]=useState(false);
  const [a11y,setA11y]=useState(()=>ls.get("mm-a11y",{}));
  const [sides,setSides]=useState({});
  const liveRef=useRef(null);
  const toast=useCallback(m=>{setToastS(m);clearTimeout(toastT.current);toastT.current=setTimeout(()=>setToastS(null),1800)},[]);
  const announce=useCallback(m=>{const a=liveRef.current;if(!a)return;a.textContent="";setTimeout(()=>a.textContent=m,50)},[]);
  const showNotice=useCallback(o=>new Promise(res=>setNotice({...o,resolve:res})),[]);
  const closeNotice=v=>{if(!notice)return;const r=notice.resolve;setNotice(null);r(v)};

  // טעינה מהמסד + חזרה מתשלום + מעקב כניסה + פופאפ
  useEffect(()=>{(async()=>{
    if(DB_ON){try{const [{data:st},{data:pr}]=await Promise.all([sb.from("settings").select("*").eq("id",1).maybeSingle(),sb.from("products").select("*").eq("visible",true).order("sort")]);if(st)setS({...DEFAULT_S,...st});if(pr&&pr.length)setP(pr);}catch(e){}}
    const u=new URLSearchParams(location.search);
    if(u.get("paid")){let ok=false;if(DB_ON){try{const {data}=await sb.rpc("mark_paid",{p_order_no:u.get("paid"),p_phone:u.get("ph")||"",p_ref:u.get("ref")||null});ok=!!data}catch(e){}}
      setBanner(`תודה! התשלום על הזמנה ${u.get("paid")} התקבל${ok?"":" (ממתין לאימות)"}. נשלח לכם אישור ונעדכן על המשלוח.`);setCart({});history.replaceState(null,"",location.pathname);}
    else if(u.get("failed")){setBanner(`התשלום על הזמנה ${u.get("failed")} לא הושלם. אפשר לנסות שוב או לכתוב לנו בוואטסאפ.`);history.replaceState(null,"",location.pathname);}
    else{let seen=false;try{seen=sessionStorage.getItem("mm-notice")==="1"}catch(e){} if(!seen){await showNotice({});try{sessionStorage.setItem("mm-notice","1")}catch(e){}}}
    if(DB_ON){try{const k="mm-visit-"+new Date().toISOString().slice(0,13);if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,"1");await sb.from("visits").insert({visitor_id:visitorId(),path:location.pathname,referrer:document.referrer||null,device:/Mobi|Android/i.test(navigator.userAgent)?"mobile":"desktop"})}}catch(e){}}
  })()},[]);
  useEffect(()=>{document.title=S.store_name;if(S.tawk_id){const sc=document.createElement("script");sc.async=true;sc.src="https://embed.tawk.to/"+S.tawk_id+"/default";sc.charset="UTF-8";sc.setAttribute("crossorigin","*");document.body.appendChild(sc);}
    if(S.ga_id){const g=document.createElement("script");g.async=true;g.src="https://www.googletagmanager.com/gtag/js?id="+S.ga_id;document.head.appendChild(g);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag("js",new Date());gtag("config",S.ga_id);}},[S.tawk_id,S.ga_id,S.store_name]);
  useEffect(()=>ls.set("mm-cart",cart),[cart]);
  useEffect(()=>{["big","bigger","contrast","links","motion","font","gray","cursor"].forEach(k=>document.documentElement.classList.toggle("a-"+k,!!a11y[k]));ls.set("mm-a11y",a11y)},[a11y]);
  useEffect(()=>{document.body.style.overflow=(open||view||notice)?"hidden":""},[open,view,notice]);
  useEffect(()=>{const h=e=>{if(e.key==="Escape"){if(notice)closeNotice(false);else if(view)setView(null);else if(open)setOpen(false);else if(a11yOpen)setA11yOpen(false);}};document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h)});

  const byId=id=>P.find(p=>p.id===id);
  const cats=useMemo(()=>["הכל",...new Set(P.map(p=>p.category))],[P]);
  const list=useMemo(()=>P.filter(p=>(cat==="הכל"||p.category===cat)&&(!q||(p.name+" "+(p.items||[]).join(" ")).includes(q))),[P,cat,q]);
  const newest=useMemo(()=>P.filter(p=>p.tag==="חדש").slice(0,8),[P]);
  const qty=Object.values(cart).reduce((a,b)=>a+b,0);
  const add=p=>{if(p.stock!=null&&p.stock<=0)return;setCart(c=>({...c,[p.id]:(c[p.id]||0)+1}));toast("נוסף לעגלה");announce(p.name+" נוסף לעגלה. בעגלה כעת "+(qty+1)+" פריטים");};
  const days=Math.max(0,Math.ceil((new Date(S.purim_date+"T00:00:00")-new Date())/864e5));
  const wa=`https://wa.me/${S.whatsapp}?text=${encodeURIComponent("שלום, אשמח לפרטים על משלוחי מנות")}`;

  return html`
    <a class="skip" href="#shop" onClick=${e=>{e.preventDefault();document.getElementById("shop").focus();document.getElementById("shop").scrollIntoView()}}>דלג לתוכן הראשי</a>
    <div class="ticker" aria-label="הודעות"><div class="ticker-in"><span>🚚 משלוחים לכל הארץ עד 5 ימי עסקים</span><span>✡️ כל המוצרים בכשרות בד"ץ מהדרין</span><span>🎉 הנחות כמות לבתי כנסת, גנים וחברות</span><span>⏳ עד פורים נשארו ${days} ימים</span></div></div>
    ${banner&&html`<div class="banner" role="status">${banner}</div>`}
    <header class="hdr" role="banner"><div class="wrap">
      <div class="side l">
        <button class="pill-btn teal" onClick=${()=>setOpen(true)} aria-haspopup="dialog" aria-expanded=${open}>${I.cart}<span class="hide-m">העגלה</span><span class="cart-n" aria-label=${qty+" פריטים"}>${qty}</span></button>
        <a class="pill-btn hide-m" href=${wa} target="_blank" rel="noopener" aria-label="וואטסאפ">${I.phone}</a>
      </div>
      <a class="logo" href="#" onClick=${e=>{e.preventDefault();window.scrollTo({top:0,behavior:"smooth"})}}><b>${S.store_name}</b><small>בד"ץ מהדרין · משלוח עד הבית</small></a>
      <div class="side r">
        <div class="search" role="search"><input id="q" placeholder="חיפוש" aria-label="חיפוש מארז" value=${q} onInput=${e=>{setQ(e.target.value);if(e.target.value)document.getElementById("shop").scrollIntoView({behavior:"smooth"})}}/><button type="button" aria-label="חפש" onClick=${()=>document.getElementById("shop").scrollIntoView({behavior:"smooth"})}>${I.search}</button></div>
        <a class="pill-btn hide-m" href="#bulk">${I.menu}<span>תפריט</span></a>
      </div>
    </div></header>

    <nav class="cats" aria-label="קטגוריות"><div class="wrap">
      ${cats.map(c=>html`<button key=${c} class="cat" aria-pressed=${c===cat} onClick=${()=>{setCat(c);document.getElementById("shop").scrollIntoView({behavior:"smooth"})}}><i>${CAT_ICON[c]||"🍭"}</i><span>${c}</span></button>`)}
    </div></nav>

    <div class="hero"><${Drip}/><div class="wrap">
      <div>
        <h1>ברוכים הבאים לעולם של <em>${S.store_name}</em></h1>
        <p>${S.hero_sub||"מארזי משלוח מנות לכל תקציב: למשפחה, לשכנים, לגננת ולעובדים. כל המוצרים בכשרות מהדרין בלבד, ואנחנו דואגים למשלוח עד הדלת."}</p>
        <div class="hero-cta"><a class="btn yellow" href="#shop">לכל המארזים</a><a class="btn ghost" href="#bulk">הזמנה למוסדות</a><button class="btn ghost" type="button" onClick=${()=>setCb(true)}>חזרו אליי</button></div>
      </div>
      <div class="seal" role="img" aria-label=${"חותמת: כל המוצרים בהשגחת בד״ץ מהדרין. עד פורים נשארו "+days+" ימים"}><div><small>כל המוצרים</small><strong>בד"ץ<br/>מהדרין</strong><span class="cnt">עד פורים <b>${days}</b> ימים</span></div></div>
    </div></div>

    <main id="main">
      ${newest.length>0&&!q&&cat==="הכל"&&html`<section class="wrap" aria-labelledby="newT"><div class="sec-h"><h2 id="newT">חדש ב-<span>${S.store_name}</span></h2></div>
        <${Grid} items=${newest} add=${add} view=${setView} sides=${sides} setSides=${setSides}/></section>`}
      <section class="wrap" id="shop" tabindex="-1" aria-labelledby="shopT"><div class="sec-h"><h2 id="shopT">${q?`תוצאות עבור "${q}"`:cat==="הכל"?html`עוד ב-<span>${S.store_name}</span>`:cat}</h2></div>
        ${list.length?html`<${Grid} items=${list} add=${add} view=${setView} sides=${sides} setSides=${setSides}/>`:html`<p class="empty">לא נמצאו מארזים.</p>`}
        ${(q||cat!=="הכל")&&html`<div class="center"><button class="btn teal" onClick=${()=>{setQ("");setCat("הכל")}}>לכל המארזים</button></div>`}
      </section>

      <section class="wrap" id="bulk" aria-label="מבצעים"><div class="promos">
        <a class="promo p1" href="#shop"><h3>משלוח מנות מוכן לשליחה</h3><p>אורזים, מוסיפים כרטיס ברכה ושולחים עד הדלת.</p><span class="emo">🎁</span></a>
        <a class="promo p2" href="#tiers"><h3>הזמנה לבתי כנסת, גנים וחברות</h3><p>הנחות כמות מ-10 מארזים, אפשרות למיתוג.</p><span class="emo">🕍</span></a>
        <a class="promo p3" href=${wa} target="_blank" rel="noopener"><h3>מארז בהתאמה אישית?</h3><p>כתבו לנו בוואטסאפ ונרכיב יחד.</p><span class="emo">💬</span></a>
      </div></section>

      <section class="wrap" id="tiers" aria-labelledby="tT"><div class="sec-h"><h2 id="tT">מזמינים בכמות? <span>משלמים פחות</span></h2></div>
        <div class="tiers">${S.discount_tiers.map((t,i)=>{const nx=S.discount_tiers[i+1];return html`<div class="tier" key=${t.min}><b>${t.pct}%</b><span>${t.min}${nx?`–${nx.min-1}`:"+"} מארזים</span></div>`})}</div>
        <p class="ex">ההנחה מחושבת אוטומטית בעגלה. אפשר לשלב סוגים שונים.</p></section>

      <section class="wrap" aria-labelledby="qT"><div class="sec-h"><h2 id="qT">עשו לנו <span>מתוק על הלב</span></h2></div>
        <div class="quotes">
          <div class="quote">"הזמנתי 40 מארזים לבית הכנסת, הגיעו ארוזים מושלם ובזמן. תודה!" <small>בתיה, ירושלים</small></div>
          <div class="quote">"הילדים השתגעו על דלי מיקי. כבר הזמנתי שוב לגן." <small>אפרת, מבשרת ציון</small></div>
          <div class="quote">"שירות מהיר, כשרות ברורה, מחיר הוגן. מה עוד צריך?" <small>יוסי, בית שמש</small></div>
        </div><p class="ex">דוגמאות להמלצות. יוחלפו בהמלצות אמיתיות של לקוחות.</p></section>

      <section class="wrap" aria-labelledby="bT"><div class="sec-h"><h2 id="bT">מה יש <span>בפנים</span></h2></div>
        <div class="brands">${["עלית","אסם","Loacker","כרמית","פרי קטיף","שטראוס","טעמן","מרשמלו","גוגלס","כיף כף","מקופלת","דוריטוס"].map(b=>html`<span class="brand" key=${b}>${b}</span>`)}</div></section>

      <section class="wrap a11y-page" id="accessibility" tabindex="-1" aria-labelledby="a11yT"><div class="sec-h"><h2 id="a11yT">הצהרת נגישות</h2></div>
        <p>אנו רואים חשיבות רבה במתן שירות שוויוני לכלל הלקוחות, ובכלל זה אנשים עם מוגבלות. אתר זה נבנה בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג–2013, ולתקן הישראלי ת"י 5568 ברמה AA.</p>
        <ul><li>תפריט נגישות (הכפתור הכחול) עם הגדלת טקסט, ניגודיות, הדגשת קישורים, עצירת אנימציות, גופן קריא, גווני אפור וסמן מוגדל.</li><li>ניווט מלא במקלדת, קישור "דלג לתוכן", Esc סוגר חלונות.</li><li>תמיכה בקוראי מסך: כותרות, תיאורי תמונה, תוויות לשדות, הודעות קוליות.</li></ul>
        <p>נתקלתם בקושי? פנו לרכז הנגישות בוואטסאפ או בטלפון <span dir="ltr">+${S.whatsapp}</span>, או בכתובת רחוב הברזל, עטרות, ירושלים. נשיב בתוך 3 ימי עסקים.</p></section>
    </main>

    <footer><div class="wrap">
      <div><h3>${S.store_name}</h3><p>משלוחי מנות בכשרות בד"ץ מהדרין. ${S.last_order_text}.</p><p><b>כתובת:</b> רחוב הברזל, עטרות, ירושלים</p>
        <div class="socials"><a href=${wa} target="_blank" rel="noopener" aria-label="וואטסאפ">${I.wa}</a></div></div>
      <nav aria-label="קישורים"><h3>מידע</h3><a href="#shop">כל המארזים</a><a href="#tiers">הנחות כמות</a><a href="#accessibility">הצהרת נגישות</a><a href="terms.html">תקנון ומדיניות ביטול</a><a href=${wa} target="_blank" rel="noopener">צרו קשר</a><a href="#" onClick=${e=>{e.preventDefault();setCb(true)}}>בקשה שנחזור אליכם</a></nav>
    </div><div class="copy">© ${new Date().getFullYear()} ${S.store_name} · כל הזכויות שמורות</div></footer>

    <a class="wa-float" href=${wa} target="_blank" rel="noopener" aria-label="צ'אט בוואטסאפ" hidden=${!!S.tawk_id}>${I.wa}</a>
    <button class="a11y-btn" type="button" aria-label="פתיחת תפריט נגישות" aria-expanded=${a11yOpen} onClick=${()=>setA11yOpen(o=>!o)}>${I.a11y}</button>
    ${a11yOpen&&html`<${A11yMenu} a11y=${a11y} setA11y=${setA11y} close=${()=>setA11yOpen(false)} announce=${announce}/>`}
    ${open&&html`<${Cart} S=${S} P=${P} cart=${cart} setCart=${setCart} close=${()=>setOpen(false)} toast=${toast} announce=${announce} showNotice=${showNotice}/>`}
    ${view&&html`<${ProductModal} p=${view} add=${add} close=${()=>setView(null)}/>`}
    ${cb&&html`<${Callback} S=${S} close=${()=>setCb(false)} toast=${toast} announce=${announce}/>`}
    ${notice&&html`<${Notice} n=${notice} onOk=${()=>closeNotice(true)} onCancel=${()=>closeNotice(false)}/>`}
    ${toastMsg&&html`<div class="toast" role="status">${toastMsg}</div>`}
    <div class="sr" ref=${liveRef} aria-live="polite" aria-atomic="true"></div>`;
}

function Grid({items,add,view,sides,setSides}){
  return html`<div class="grid" role="list">${items.map(p=>{const m=media(p);const out=p.stock!=null&&p.stock<=0;const side=sides[p.id]||1;
    return html`<article class="card" role="listitem" key=${p.id} aria-labelledby=${"t-"+p.id}>
      <div class="img" style=${{background:`color-mix(in srgb, ${p.color||"#e3b252"} 18%, #fff)`}}>
        ${p.tag&&html`<span class="badge">${p.tag}</span>`}
        ${m.img?html`<img src=${side===2&&m.img2?m.img2:m.img} alt=${p.name} loading="lazy"/>`:html`<span style=${{fontSize:"4rem"}} role="img" aria-label=${p.name}>🎁</span>`}
        ${m.img2&&html`<div class="sides" role="group" aria-label="צד"><button type="button" aria-pressed=${side===1} onClick=${()=>setSides(s=>({...s,[p.id]:1}))}>צד א</button><button type="button" aria-pressed=${side===2} onClick=${()=>setSides(s=>({...s,[p.id]:2}))}>צד ב</button></div>`}
        <span class="badge kos" aria-hidden="true">בד"ץ מהדרין</span>
      </div>
      <div class="b"><h3 id=${"t-"+p.id}>${p.name}</h3><div class="price">${ils(p.price)}</div>
        <div class="act">${out?html`<span class="soldout">אזל המלאי</span>`:html`<button class="more" type="button" onClick=${()=>view(p)}>לפרטים ולהזמנה</button><button class="plus" type="button" aria-label=${"הוספת "+p.name+" לעגלה, "+ils(p.price)} onClick=${()=>add(p)}>+</button>`}</div>
      </div></article>`})}</div>`;
}

function Callback({S,close,toast,announce}){
  const [f,setF]=useState({name:"",phone:"",message:""});const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);
  const ref=useRef(null);useEffect(()=>{ref.current?.focus()},[]);
  const set=k=>e=>setF(o=>({...o,[k]:e.target.value}));
  const submit=async e=>{e.preventDefault();const name=f.name.trim(),phone=f.phone.replace(/[^\d+]/g,"");
    if(!name||phone.length<9){toast("נא למלא שם וטלפון תקין");return}
    setBusy(true);let ok=false;
    if(DB_ON){try{const {error}=await sb.from("callbacks").insert({name,phone,message:f.message.trim()||null,source:"site",visitor_id:visitorId()});ok=!error;if(error)console.warn(error)}catch(e){}}
    setBusy(false);setDone(true);announce("הבקשה נשלחה. נחזור אליך בהקדם.");
    if(!ok){/* גיבוי: פתיחת וואטסאפ עם הפרטים */ window.open(`https://wa.me/${S.whatsapp}?text=${encodeURIComponent(`שלום, אשמח שתחזרו אליי.\nשם: ${name}\nטלפון: ${phone}${f.message.trim()?`\n${f.message.trim()}`:""}`)}`,"_blank");}
  };
  return html`<div class="modal" onClick=${e=>{if(e.target.classList.contains("modal"))close()}}><div class="modal-in" role="dialog" aria-modal="true" aria-labelledby="cbT" style=${{textAlign:"right"}}>
    <h2 id="cbT" style=${{textAlign:"center"}}>${done?"קיבלנו!":"רוצים שנחזור אליכם?"}</h2>
    ${done?html`<p style=${{textAlign:"center"}}>תודה ${f.name.trim()}, נחזור אליך בהקדם למספר <span dir="ltr">${f.phone}</span>.</p><div class="modal-actions"><button class="submit" type="button" onClick=${close}>סגירה</button></div>`
    :html`<p style=${{textAlign:"center",color:"var(--muted)",fontSize:".95rem"}}>השאירו פרטים ונחזור אליכם בהקדם, בוואטסאפ או בטלפון.</p>
    <form onSubmit=${submit} noValidate>
      <label>שם<input ref=${ref} value=${f.name} onInput=${set("name")} required autocomplete="name"/></label>
      <label>טלפון<input value=${f.phone} onInput=${set("phone")} required type="tel" inputmode="tel" autocomplete="tel"/></label>
      <label>במה נוכל לעזור? (לא חובה)<textarea rows="3" value=${f.message} onInput=${set("message")} placeholder="למשל: הזמנה של 40 מארזים לבית הכנסת"></textarea></label>
      <button class="submit" type="submit" disabled=${busy}>${busy?"שולח…":"שלחו לי הודעה"}</button>
      <button class="x-text" type="button" onClick=${close}>ביטול</button></form>`}
  </div></div>`;
}

function ProductModal({p,add,close}){
  const m=media(p);const ref=useRef(null);useEffect(()=>{ref.current?.focus()},[]);
  return html`<div class="modal" onClick=${e=>{if(e.target.classList.contains("modal"))close()}}><div class="modal-in" role="dialog" aria-modal="true" aria-labelledby="pmT">
    ${m.video?html`<video class="pm-img" src=${m.video} poster=${m.poster} muted autoplay loop playsinline style=${{borderRadius:"14px"}} aria-label=${p.name}></video>`:m.img?html`<img class="pm-img" src=${m.img} alt=${p.name}/>`:null}
    <h2 id="pmT">${p.name}</h2>
    <ul class="pm-list">${(p.items||[]).map((i,k)=>html`<li key=${k}>${i}</li>`)}</ul>
    <div class="price" style=${{fontSize:"1.5rem"}}>${ils(p.price)}</div>
    <div class="modal-actions"><button class="submit" ref=${ref} type="button" onClick=${()=>{add(p);close()}}>הוספה לעגלה</button><button class="x-text" type="button" onClick=${close}>סגירה</button></div>
  </div></div>`;
}

function Notice({n,onOk,onCancel}){
  const ref=useRef(null);useEffect(()=>{ref.current?.focus()},[]);
  return html`<div class="modal"><div class="modal-in" role="alertdialog" aria-modal="true" aria-labelledby="nT" aria-describedby="nX">
    <div class="modal-ico" aria-hidden="true">🚚</div><h2 id="nT">${n.title||"זמני אספקה"}</h2>
    <p id="nX">כל הזמנה מגיעה ללקוח <b>עד חמישה ימי עסקים</b> ממועד אישור ההזמנה. מומלץ להזמין מוקדם לקראת פורים.</p>
    <div class="modal-actions"><button class="submit" ref=${ref} type="button" onClick=${onOk}>${n.ok||"הבנתי"}</button>${n.cancel&&html`<button class="x-text" type="button" onClick=${onCancel}>חזרה לעגלה</button>`}</div>
  </div></div>`;
}

function A11yMenu({a11y,setA11y,close,announce}){
  const ref=useRef(null);useEffect(()=>{ref.current?.focus()},[]);
  const T=(k,label,st)=>{const on=!!a11y[k];return html`<button class="opt" type="button" aria-pressed=${on} onClick=${()=>{setA11y(a=>{const n={...a,[k]:!a[k]};if(k==="big"&&n.big)n.bigger=false;if(k==="bigger"&&n.bigger)n.big=false;return n});announce(label+(on?" כובה":" הופעל"))}}>${label} <span class="st">${st||(on?"פעיל":"כבוי")}</span></button>`};
  return html`<div class="a11y" role="dialog" aria-label="תפריט נגישות">
    <h2>נגישות <button class="x" ref=${ref} type="button" aria-label="סגירה" onClick=${close}>×</button></h2>
    <div class="row2">${T("big","הגדלת טקסט","A+")}${T("bigger","טקסט גדול מאוד","A++")}</div>
    ${T("contrast","ניגודיות גבוהה")}${T("links","הדגשת קישורים וכפתורים")}${T("motion","עצירת אנימציות")}${T("font","גופן קריא")}${T("gray","גווני אפור")}${T("cursor","סמן עכבר מוגדל")}
    <button class="cp" type="button" onClick=${()=>{setA11y({});announce("הגדרות הנגישות אופסו")}}>איפוס הגדרות</button>
    <a href="#accessibility" onClick=${close}>הצהרת נגישות</a></div>`;
}

function paymentUrl(S,order){
  const sum=order.total.toFixed(2),name=encodeURIComponent(order.customer_name),phone=encodeURIComponent(order.phone);
  const base=(CFG.SITE_URL||location.href.split("?")[0]);
  const back=encodeURIComponent(base+`?paid=${order.order_no}&ph=${order.phone}`),fail=encodeURIComponent(base+`?failed=${order.order_no}`);
  if(S.pay_card_enabled&&S.pay_provider==="tranzila"&&S.pay_terminal) return `https://direct.tranzila.com/${encodeURIComponent(S.pay_terminal)}/iframenew.php?sum=${sum}&currency=1&cred_type=1&lang=il&contact=${name}&phone=${phone}&pdesc=${encodeURIComponent("הזמנה "+order.order_no)}&myorder=${order.order_no}&success_url_address=${back}&fail_url_address=${fail}`;
  if(S.pay_card_enabled&&S.pay_provider==="link"&&S.pay_link_template) return S.pay_link_template.replace("{sum}",sum).replace("{order}",order.order_no).replace("{name}",name).replace("{phone}",phone);
  return null;
}
function orderText(o){
  const pay={card:"כרטיס אשראי",cash:"מזומן",whatsapp:"לסיכום"}[o.payment_method];
  return `הזמנת משלוחי מנות${o.order_no?` מס' ${o.order_no}`:""}\nשם: ${o.customer_name}\nטלפון: ${o.phone}${o.email?`\nמייל: ${o.email}`:""}\nעיר: ${o.city}\nקבלה: ${o.delivery==="ship"?"משלוח עד הבית":"איסוף עצמי"}\nתשלום: ${pay}\n\n${o.items.map(i=>`• ${i.name} × ${i.qty}`).join("\n")}\n\n${o.discount?`הנחת כמות: −${ils(o.discount)}\n`:""}${o.shipping?`משלוח: ${ils(o.shipping)}\n`:""}סה"כ לתשלום: ${ils(o.total)}${o.note?`\n\nהערות: ${o.note}`:""}`;
}

function Cart({S,P,cart,setCart,close,toast,announce,showNotice}){
  const [f,setF]=useState({name:"",phone:"",email:"",city:S.cities[0]||"",delivery:"ship",pay:S.pay_cash_enabled?"cash":"whatsapp",note:""});
  const [busy,setBusy]=useState(false);const [done,setDone]=useState(null);
  const panel=useRef(null),first=useRef(null);
  useEffect(()=>{first.current?.focus()},[]);
  const byId=id=>P.find(p=>p.id===id);
  const ids=Object.keys(cart).filter(byId);
  const qty=ids.reduce((a,id)=>a+cart[id],0),sub=ids.reduce((a,id)=>a+byId(id).price*cart[id],0);
  let rate=0;for(const t of S.discount_tiers)if(qty>=t.min)rate=t.pct/100;
  const disc=sub*rate;let ship=qty&&f.delivery==="ship"?Number(S.shipping_fee):0;if(S.free_shipping_min&&sub-disc>=Number(S.free_shipping_min))ship=0;
  const total=sub-disc+ship;
  const set=k=>e=>setF(o=>({...o,[k]:e.target.value}));
  const trap=e=>{if(e.key!=="Tab")return;const els=[...panel.current.querySelectorAll('button,[href],input,select,textarea')].filter(x=>!x.hidden&&x.offsetParent!==null);if(!els.length)return;const a=els[0],z=els[els.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}};
  const submit=async e=>{e.preventDefault();
    const name=f.name.trim(),phone=f.phone.replace(/[^\d+]/g,""),email=f.email.trim();
    if(!name||phone.length<9){toast("נא למלא שם וטלפון תקין");return}
    if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){toast("כתובת מייל לא תקינה");return}
    const go=await showNotice({title:"לפני שמסיימים: זמני אספקה",ok:"אישור ושליחת ההזמנה",cancel:true});if(!go)return;
    const order={customer_name:name,phone,email:email||null,city:f.city,delivery:f.delivery,note:f.note.trim()||null,items:ids.map(id=>({id,name:byId(id).name,price:byId(id).price,qty:cart[id]})),subtotal:+sub.toFixed(2),discount:+disc.toFixed(2),shipping:+ship.toFixed(2),total:+total.toFixed(2),payment_method:f.pay,status:f.pay==="card"?"awaiting_payment":"new",visitor_id:visitorId()};
    setBusy(true);let saved=null;
    if(DB_ON){try{const {data,error}=await sb.from("orders").insert(order).select("order_no,id").single();if(error)throw error;saved=data}catch(err){console.warn(err)}}
    setBusy(false);order.order_no=saved?.order_no||null;
    const url=paymentUrl(S,order);
    const head=order.payment_method==="card"?(order.order_no?`הזמנה ${order.order_no} נקלטה. עכשיו לתשלום מאובטח:`:"ההזמנה מוכנה. עכשיו לתשלום מאובטח:"):order.payment_method==="cash"?(order.order_no?`הזמנה ${order.order_no} נקלטה. התשלום במזומן ${order.delivery==="ship"?"במסירה":"באיסוף"}.`:"ההזמנה מוכנה."):(order.order_no?`הזמנה ${order.order_no} נקלטה.`:"ההזמנה מוכנה.");
    setDone({head,text:orderText(order),url,total:order.total});announce(head);if(saved)setCart({});
  };
  const copy=()=>navigator.clipboard.writeText(done.text).then(()=>toast("הועתק")).catch(()=>toast("סמנו והעתיקו ידנית"));
  return html`<div class="drawer" onClick=${e=>{if(e.target.classList.contains("drawer"))close()}}><div class="panel" ref=${panel} role="dialog" aria-modal="true" aria-labelledby="cT" onKeyDown=${trap}>
    <header><h2 id="cT">העגלה שלי</h2><button class="x" ref=${first} type="button" aria-label="סגירה" onClick=${close}>×</button></header>
    ${ids.length?ids.map(id=>{const p=byId(id);return html`<div class="line" key=${id}><div><b>${p.name}</b></div><div>${ils(p.price*cart[id])}</div>
      <div class="qty"><button type="button" aria-label=${"הפחתת כמות של "+p.name} onClick=${()=>setCart(c=>{const n={...c};if(--n[id]<=0)delete n[id];return n})}>−</button><span aria-live="polite">${cart[id]}</span><button type="button" aria-label=${"הוספת כמות של "+p.name} onClick=${()=>setCart(c=>({...c,[id]:c[id]+1}))}>+</button></div>
      <div style=${{color:"var(--muted)",fontSize:".85rem"}}>${ils(p.price)} ליחידה</div></div>`}):html`<div class="empty">העגלה ריקה. בחרו מארז מהרשימה.</div>`}
    ${ids.length>0&&html`<div class="sum"><div><span>סכום ביניים (${qty} מארזים)</span><span>${ils(sub)}</span></div>${rate>0&&html`<div class="disc"><span>הנחת כמות ${rate*100}%</span><span>−${ils(disc)}</span></div>`}<div><span>משלוח</span><span>${ship?ils(ship):"ללא"}</span></div><div class="tot"><span>לתשלום</span><span>${ils(total)}</span></div></div>`}
    ${ids.length>0&&!done&&html`<form onSubmit=${submit} noValidate>
      <label>שם מלא<input value=${f.name} onInput=${set("name")} required autocomplete="name"/></label>
      <label>טלפון<input value=${f.phone} onInput=${set("phone")} required type="tel" inputmode="tel" autocomplete="tel"/></label>
      <label>מייל (לאישור הזמנה וקבלה)<input value=${f.email} onInput=${set("email")} type="email" inputmode="email" autocomplete="email"/></label>
      <label>עיר<select value=${f.city} onChange=${set("city")}>${S.cities.map(c=>html`<option key=${c}>${c}</option>`)}</select></label>
      <label>אופן קבלה<select value=${f.delivery} onChange=${set("delivery")}><option value="ship">משלוח עד הבית (${ils(S.shipping_fee)})</option><option value="pick">איסוף עצמי</option></select></label>
      <label>אופן תשלום<select value=${f.pay} onChange=${set("pay")}>
        ${S.pay_card_enabled&&S.pay_provider!=="none"?html`<option value="card">כרטיס אשראי (תשלום מאובטח)</option>`:html`<option value="card" disabled>כרטיס אשראי (תשלום מאובטח) – יופעל בקרוב</option>`}
        ${S.pay_cash_enabled&&html`<option value="cash">מזומן באיסוף / במסירה</option>`}<option value="whatsapp">סיכום בוואטסאפ</option></select></label>
      <label>הערות / נוסח לכרטיס ברכה<textarea rows="3" value=${f.note} onInput=${set("note")}></textarea></label>
      <p class="terms-note">בלחיצה על "שליחת הזמנה" אני מאשר/ת את <a href="terms.html" target="_blank" rel="noopener">התקנון ומדיניות הביטול</a>.</p>
      <button class="submit" type="submit" disabled=${busy}>${busy?"שולח…":"שליחת הזמנה"}</button></form>`}
    ${done&&html`<div class="done"><b>${done.head}</b><pre>${done.text}</pre>
      ${done.url?html`<a class="paybtn" href=${done.url}>תשלום מאובטח בכרטיס אשראי ${ils(done.total)}</a>`:html`<a class="paybtn" href="#" aria-disabled="true">תשלום מאובטח בכרטיס אשראי – יופעל בקרוב</a>`}
      <button class="cp" type="button" onClick=${copy}>העתקת פרטי ההזמנה</button><small>מספר להזמנות: <span dir="ltr">+${S.whatsapp}</span></small></div>`}
  </div></div>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App}/>`);
})();
