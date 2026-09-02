'use strict';
/**
 * ตรวจว่าตั้งค่าที่จำเป็นครบหรือยัง
 *
 * ใช้ตอน deploy ครั้งแรกบน Vercel ซึ่งยังไม่ได้ต่อฐานข้อมูล/Blob
 * ระบบจะแสดงหน้าบอกขั้นตอนที่ค้างอยู่ แทนที่จะขึ้น error ที่อ่านไม่รู้เรื่อง
 */
const ON_VERCEL = !!process.env.VERCEL;
const IS_PRODUCTION = ON_VERCEL || process.env.NODE_ENV === 'production';

/** รายการตั้งค่าที่ยังขาด (เฉพาะตอนรันบน production) */
function missingConfig() {
  if (!IS_PRODUCTION) return [];
  const missing = [];

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    missing.push({
      key: 'DATABASE_URL',
      title: 'ยังไม่ได้ต่อฐานข้อมูล Neon',
      how: 'ที่โปรเจกต์บน Vercel → แท็บ Storage → Create Database → เลือก Neon → Connect',
    });
  }

  if (!process.env.SESSION_SECRET) {
    missing.push({
      key: 'SESSION_SECRET',
      title: 'ยังไม่ได้ตั้งกุญแจเซสชัน',
      how: 'Settings → Environment Variables → เพิ่ม SESSION_SECRET (สุ่มค่ายาว ๆ)',
    });
  }

  return missing;
}

/** คำเตือนที่ไม่ถึงกับทำให้ระบบใช้ไม่ได้ */
function warnings() {
  if (!IS_PRODUCTION) return [];
  const list = [];
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    list.push('ยังไม่ได้ต่อ Vercel Blob — รูปภาพที่อัปโหลดจะหายทุกครั้งที่ deploy ใหม่');
  }
  if (!process.env.SECURE_COOKIE) {
    list.push('ยังไม่ได้ตั้ง SECURE_COOKIE=1 — ควรตั้งเมื่อเปิดผ่าน HTTPS');
  }
  return list;
}

/** หน้าเว็บบอกขั้นตอนที่ยังค้างอยู่ */
function setupPage(missing) {
  const items = missing.map((m, i) => `
    <li>
      <div class="step">
        <span class="num">${i + 1}</span>
        <div>
          <p class="t">${m.title}</p>
          <p class="h">${m.how}</p>
          <code>${m.key}</code>
        </div>
      </div>
    </li>`).join('');

  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ตั้งค่าระบบยังไม่เสร็จ</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
       font-family:Sarabun,system-ui,sans-serif;color:#334155;
       background:linear-gradient(180deg,#FFF7FB,#F8FAFC)}
  .card{max-width:640px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:18px;
        box-shadow:0 12px 40px -18px rgba(74,44,109,.35);padding:28px}
  h1{margin:0 0 4px;font-size:20px;color:#4A2C6D}
  .sub{margin:0 0 20px;font-size:14px;color:#64748b}
  ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
  .step{display:flex;gap:12px;align-items:flex-start;border:1px solid #f1f5f9;border-radius:12px;padding:12px 14px;background:#fafafa}
  .num{flex:none;width:26px;height:26px;border-radius:8px;background:#F13596;color:#fff;
       display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
  .t{margin:0;font-weight:700;font-size:15px;color:#4A2C6D}
  .h{margin:2px 0 6px;font-size:13px;line-height:1.5}
  code{background:#4A2C6D;color:#fff;padding:2px 8px;border-radius:6px;font-size:12px}
  .foot{margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:13px;color:#64748b;line-height:1.6}
</style></head>
<body><main class="card">
  <h1>ตั้งค่าระบบยังไม่เสร็จ</h1>
  <p class="sub">ระบบแบบเยี่ยมชั้นเรียน — เหลืออีก ${missing.length} ขั้นตอนก็พร้อมใช้งาน</p>
  <ul>${items}</ul>
  <p class="foot">ทำครบแล้วให้กลับไปที่แท็บ <b>Deployments</b> บน Vercel แล้วกด <b>Redeploy</b>
  จากนั้นรีเฟรชหน้านี้อีกครั้ง</p>
</main></body></html>`;
}

module.exports = { ON_VERCEL, IS_PRODUCTION, missingConfig, warnings, setupPage };
