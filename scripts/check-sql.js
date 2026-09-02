'use strict';
/**
 * ตรวจ SQL แบบสถิต — กันกับดักของ Postgres ที่การทดสอบในเครื่อง (PGlite) จับไม่ได้
 *
 * เหตุผล: ไดรเวอร์ของ Neon/node-postgres คืนค่า BIGINT และ NUMERIC เป็น "string"
 * ถ้าลืม cast จะไม่มี error แต่การคำนวณจะผิดแบบเงียบ ๆ บน production
 * PGlite คืนเป็น number อยู่แล้ว จึงไม่แสดงอาการตอนทดสอบ
 *
 * ใช้งาน: npm run check:sql
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['src', 'scripts'];
const SKIP = new Set(['check-sql.js', 'migrate-sqlite-to-postgres.js']);
const problems = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    // สคริปต์ย้ายข้อมูลต้องอ่าน SQLite เดิมโดยตรง จึงยกเว้นจากการตรวจ
    else if (name.endsWith('.js') && !SKIP.has(name)) inspect(full);
  }
}

function inspect(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const at = `${rel}:${i + 1}`;

    // COUNT(...) ต้องตามด้วย ::int
    const counts = line.match(/\bCOUNT\s*\([^)]*\)(?!::int)/g);
    if (counts) {
      counts.forEach((m) => problems.push({ at, kind: 'COUNT ไม่ได้ cast ::int', snippet: m.trim() }));
    }

    // AVG(...) ต้องตามด้วย ::float8  (ยอมให้ครอบด้วย COALESCE ก่อนได้)
    const avgs = line.match(/\bAVG\s*\([^)]*\)(?!::float8)/g);
    if (avgs) {
      avgs.forEach((m) => {
        // กรณี COALESCE(AVG(x), 0)::float8 ถือว่าถูกต้อง
        if (/COALESCE\s*\(\s*AVG/i.test(line) && /\)::float8/.test(line)) return;
        problems.push({ at, kind: 'AVG ไม่ได้ cast ::float8', snippet: m.trim() });
      });
    }

    // การค้นหาต้องใช้ ILIKE เพราะ LIKE ของ Postgres สนใจตัวพิมพ์เล็กใหญ่
    // reference_number เป็นรหัสที่ระบบสร้างเอง (ตัวพิมพ์ใหญ่+ตัวเลข) จึงใช้ LIKE ได้
    if (/\sLIKE\s+\$/.test(line) && !/ILIKE/.test(line) && !/reference_number/.test(line)) {
      problems.push({ at, kind: 'ใช้ LIKE แทน ILIKE', snippet: line.trim().slice(0, 70) });
    }

    // ไม่ควรเหลือ API ของ SQLite
    if (/\bdb\.prepare\s*\(|lastInsertRowid|require\('node:sqlite'\)/.test(line)) {
      problems.push({ at, kind: 'ยังใช้ API ของ SQLite', snippet: line.trim().slice(0, 70) });
    }

    // Postgres ใช้ $1 $2 ไม่ใช่ ? — ตรวจเฉพาะบรรทัดที่เป็นคำสั่ง SQL ชัดเจน
    if (/(SELECT|INSERT INTO|UPDATE|DELETE FROM)\s/i.test(line) && /(=|IN|VALUES)\s*\?/.test(line)) {
      problems.push({ at, kind: 'ใช้ placeholder ? แทน $1', snippet: line.trim().slice(0, 70) });
    }
  });
}

console.log('\n== ตรวจ SQL สำหรับ Postgres ==\n');
TARGETS.forEach((t) => walk(path.join(ROOT, t)));

if (!problems.length) {
  console.log('  ผ่าน — cast ::int / ::float8 ครบ, ใช้ ILIKE, ไม่มีโค้ด SQLite ตกค้าง\n');
  process.exit(0);
}

problems.forEach((p) => console.log(`  ${p.kind}\n    ${p.at}  →  ${p.snippet}`));
console.log(`\n== พบปัญหา ${problems.length} จุด ==\n`);
process.exit(1);
