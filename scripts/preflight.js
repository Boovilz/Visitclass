'use strict';
/**
 * ตรวจความพร้อมก่อนเปิดใช้งานจริง
 * ใช้งาน: npm run preflight
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
let errors = 0;
let warnings = 0;

const ok = (m) => console.log(`  \x1b[32mผ่าน\x1b[0m  ${m}`);
const warn = (m) => { warnings += 1; console.log(`  \x1b[33mเตือน\x1b[0m ${m}`); };
const fail = (m) => { errors += 1; console.log(`  \x1b[31mไม่ผ่าน\x1b[0m ${m}`); };
const info = (m) => console.log(`  \x1b[36mข้อมูล\x1b[0m ${m}`);

async function main() {
  console.log('\n== ตรวจความพร้อมก่อนขึ้นระบบจริง ==\n');

  /* 1) Node version */
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > 20 || (major === 20 && minor >= 0)) ok(`Node.js ${process.versions.node}`);
  else fail(`Node.js ${process.versions.node} เก่าเกินไป — ต้องการ 20 ขึ้นไป`);

  /* 2) ไฟล์ที่ต้อง build ก่อน */
  [
    ['public/css/app.css', 'รัน `npm run build:css`'],
    ['public/vendor/chart.umd.js', 'รัน `npm run vendor`'],
    ['public/vendor/sweetalert2.all.min.js', 'รัน `npm run vendor`'],
  ].forEach(([file, howto]) => {
    if (fs.existsSync(path.join(ROOT, file))) ok(`มีไฟล์ ${file}`);
    else fail(`ขาดไฟล์ ${file} — ${howto}`);
  });

  /* 3) การเชื่อมต่อฐานข้อมูล */
  const usingNeon = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  if (usingNeon) ok('ตั้งค่า DATABASE_URL แล้ว (ใช้ Neon Postgres)');
  else warn('ยังไม่ได้ตั้ง DATABASE_URL — ระบบจะใช้ Postgres ในเครื่อง (PGlite) ซึ่งใช้กับ Vercel ไม่ได้');

  const db = require('../src/lib/db');
  try {
    await db.migrate();
    ok(`เชื่อมต่อฐานข้อมูลได้ (ไดรเวอร์: ${db.driverName()})`);
  } catch (e) {
    fail(`เชื่อมต่อฐานข้อมูลไม่ได้ — ${e.message.split('\n')[0]}`);
    console.log(`\n== สรุป: ไม่ผ่าน ${errors} · เตือน ${warnings} ==\n`);
    process.exit(1);
  }

  /* 4) ที่เก็บรูปภาพ */
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    ok('ตั้งค่า BLOB_READ_WRITE_TOKEN แล้ว (เก็บรูปที่ Vercel Blob)');
  } else {
    warn('ยังไม่ได้ตั้ง BLOB_READ_WRITE_TOKEN — รูปจะถูกเก็บลงดิสก์ในเครื่อง ซึ่งบน Vercel จะหายทุกครั้งที่ deploy');
    try {
      fs.mkdirSync(path.join(ROOT, 'uploads'), { recursive: true });
      ok('โฟลเดอร์ uploads/ เขียนไฟล์ได้');
    } catch (e) {
      fail(`โฟลเดอร์ uploads/ เขียนไม่ได้ — ${e.message}`);
    }
  }

  /* 5) ข้อมูลในระบบและ PIN */
  const settings = await db.getSettings();
  const evalCount = (await db.one('SELECT COUNT(*)::int AS c FROM evaluations')).c;
  const indicatorCount = (await db.one(
    'SELECT COUNT(*)::int AS c FROM indicators WHERE deleted_at IS NULL AND status = 1'
  )).c;

  if (settings && settings.admin_pin_hash) ok('ตั้งค่า PIN ผู้ดูแลแล้ว');
  else fail('ยังไม่ได้ตั้ง PIN ผู้ดูแล — เปิดระบบหนึ่งครั้งเพื่อให้สร้างอัตโนมัติ หรือรัน `npm run seed`');

  // เตือนถ้ายังใช้ PIN เริ่มต้น
  if (settings && settings.admin_pin_salt) {
    const { hashPin } = require('../src/lib/auth');
    const { hash } = hashPin('2468', settings.admin_pin_salt);
    if (hash === settings.admin_pin_hash) fail('ยังใช้ PIN เริ่มต้น 2468 — ต้องเปลี่ยนก่อนเปิดใช้งานจริง');
    else ok('เปลี่ยน PIN จากค่าเริ่มต้นแล้ว');
  }

  if (indicatorCount > 0) ok(`มีตัวชี้วัดที่เปิดใช้งาน ${indicatorCount} ข้อ`);
  else fail('ยังไม่มีตัวชี้วัดที่เปิดใช้งาน — ฟอร์มประเมินจะใช้งานไม่ได้');

  if (settings && settings.school_name && settings.affiliation_name) ok(`ตั้งค่าโรงเรียนแล้ว: ${settings.school_name}`);
  else warn('ยังไม่ได้ตั้งชื่อโรงเรียน/ต้นสังกัด ที่เมนูตั้งค่าระบบ');

  info(`ผลการประเมินในระบบขณะนี้ ${evalCount} รายการ`);

  /* 6) ตัวแปรสภาพแวดล้อมสำหรับ production */
  if (process.env.SESSION_SECRET) ok('ตั้งค่า SESSION_SECRET แล้ว');
  else fail('ยังไม่ได้ตั้ง SESSION_SECRET — บน Vercel ระบบจะเริ่มทำงานไม่ได้ (เซสชันต้องใช้กุญแจถาวร)');

  if (process.env.SECURE_COOKIE) ok('ตั้ง SECURE_COOKIE แล้ว (คุกกี้ส่งผ่าน HTTPS เท่านั้น)');
  else warn('ยังไม่ได้ตั้ง SECURE_COOKIE=1 — ถ้าเปิดผ่าน HTTPS ควรตั้งเพื่อความปลอดภัยของเซสชัน');

  if (process.env.NODE_ENV === 'production') ok('NODE_ENV=production');
  else warn('ยังไม่ได้ตั้ง NODE_ENV=production');

  await db.closeDatabase();

  console.log(`\n== สรุป: ไม่ผ่าน ${errors} · เตือน ${warnings} ==\n`);
  if (errors) console.log('  แก้ข้อที่ "ไม่ผ่าน" ให้ครบก่อนเปิดใช้งานจริง\n');
  process.exit(errors ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
