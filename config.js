// ============================================================
//  הגדרות חיבור — הקובץ היחיד שצריך לערוך ידנית
//  כל שאר ההגדרות (וואטסאפ, מחירי משלוח, תשלום, צ'אט) נערכות בפאנל האדמין.
// ============================================================
window.SITE_CONFIG = {
  // מ-Supabase: Project Settings → API
  SUPABASE_URL: "https://zkfgcreyortjanoskmya.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_TbnscS4I9oyXDXxPhtTKGg_pyuqnae8",   // מפתח ציבורי (publishable). לא את ה-secret!

  // כתובת האתר הציבורית (לחזרה מדף התשלום)
  SITE_URL: "https://mishlohi.co.il/",

  // מפתח ציבורי להתראות פוש של אפליקציית הניהול (VAPID)
  VAPID_PUBLIC_KEY: "BKJS1D0IVULmtodKJ0QbWdJ1bXsRQ9XffNLSyF1fNUJ_6j788GmW26OAbT_n7QtWX8pYiE7EnWE0QOWupNd-mDU"
};
