'use strict';
/**
 * รันชุดทดสอบบนฐานข้อมูลแยกต่างหาก (data/test.db) และพอร์ตแยก
 * ข้อมูลจริงใน data/app.db จะไม่ถูกแตะต้องเลย
 * ใช้งาน: npm test
 */
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const TEST_DB = path.join(ROOT, 'data', 'pg-test');
const PORT = process.env.TEST_PORT || 3199;

/** ลบไฟล์ฐานข้อมูลทดสอบทั้งหมด (รวมไฟล์ WAL ของ SQLite) */
function removeTestDb() {
  try { fs.rmSync(TEST_DB, { recursive: true, force: true }); } catch { /* ไม่มีโฟลเดอร์ = ไม่ต้องทำอะไร */ }
}

// ใช้ Postgres ในเครื่อง (PGlite) แยกโฟลเดอร์ต่างหาก เพื่อไม่ให้แตะข้อมูลจริง
const env = { ...process.env, PGLITE_DIR: TEST_DB, PORT: String(PORT), SEED_PIN: '2468' };
delete env.DATABASE_URL;
delete env.POSTGRES_URL;
delete env.BLOB_READ_WRITE_TOKEN;

console.log('เตรียมฐานข้อมูลทดสอบแยกจากข้อมูลจริง...');
removeTestDb();

const seed = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'seed.js'), '--reset'], { env, stdio: 'ignore' });
if (seed.status !== 0) {
  console.error('สร้างข้อมูลทดสอบไม่สำเร็จ');
  removeTestDb();
  process.exit(1);
}

const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: 'ignore' });

let finished = false;
function finish(code) {
  if (finished) return;
  finished = true;
  server.kill();
  setTimeout(() => { removeTestDb(); process.exit(code); }, 300);
}

process.on('SIGINT', () => finish(1));

// รอให้เซิร์ฟเวอร์พร้อมก่อนเริ่มทดสอบ
(async () => {
  const base = `http://localhost:${PORT}`;
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/api/public/settings`);
      if (res.ok) break;
    } catch { /* ยังไม่พร้อม */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  const tests = spawn(process.execPath, [path.join(ROOT, 'scripts', 'smoke-test.js')], {
    env: { ...env, BASE: base },
    stdio: 'inherit',
  });
  tests.on('exit', (code) => finish(code === null ? 1 : code));
})();
