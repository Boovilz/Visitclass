'use strict';
/**
 * ย้ายข้อมูลจากฐานข้อมูล SQLite เดิม (data/app.db) ไปยัง Postgres ปลายทาง
 *
 * ใช้งาน:
 *   DATABASE_URL=postgresql://... node scripts/migrate-sqlite-to-postgres.js
 *   DATABASE_URL=... SQLITE_FILE=/path/app.db node scripts/migrate-sqlite-to-postgres.js
 *
 * หมายเหตุสำคัญ:
 *   - รูปภาพเดิมอยู่ในโฟลเดอร์ uploads/ ซึ่ง Vercel ไม่มีดิสก์ถาวร
 *     สคริปต์นี้จะอัปโหลดขึ้น Vercel Blob ให้ด้วยถ้าตั้ง BLOB_READ_WRITE_TOKEN
 *   - ปลายทางต้องเป็นฐานข้อมูลเปล่า (ถ้ามีข้อมูลอยู่แล้วสคริปต์จะหยุด)
 */
const path = require('node:path');
const fs = require('node:fs');

const SQLITE_FILE = process.env.SQLITE_FILE || path.join(__dirname, '..', 'data', 'app.db');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

// ลำดับการย้ายต้องเรียงตามความสัมพันธ์ของตาราง (ตารางแม่ก่อนตารางลูก)
const TABLES = [
  'semesters',
  'academic_years',
  'classroom_teachers',
  'visitors',
  'classrooms',
  'learning_areas',
  'indicator_groups',
  'indicators',
  'evaluations',
  'evaluation_scores',
  'evaluation_images',
];

async function main() {
  // อนุญาต PGLITE_DIR เพื่อให้ทดลองย้ายข้อมูลในเครื่องก่อนย้ายขึ้น Neon จริงได้
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.PGLITE_DIR) {
    console.error('ต้องตั้ง DATABASE_URL ให้ชี้ไปยัง Postgres ปลายทางก่อน');
    process.exit(1);
  }
  if (!fs.existsSync(SQLITE_FILE)) {
    console.error(`ไม่พบไฟล์ฐานข้อมูลเดิม: ${SQLITE_FILE}`);
    process.exit(1);
  }

  const { DatabaseSync } = require('node:sqlite');
  const pg = require('../src/lib/db');

  const sqlite = new DatabaseSync(SQLITE_FILE, { readOnly: true });
  await pg.migrate();

  // ปลายทางต้องว่าง เพื่อกันการย้ายซ้ำจนข้อมูลซ้ำซ้อน
  const existing = await pg.one('SELECT COUNT(*)::int AS c FROM evaluations');
  const existingIndicators = await pg.one('SELECT COUNT(*)::int AS c FROM indicators');
  if (existing.c > 0 || existingIndicators.c > 0) {
    console.error('ฐานข้อมูลปลายทางมีข้อมูลอยู่แล้ว — กรุณาใช้ฐานข้อมูลเปล่าเพื่อกันข้อมูลซ้ำ');
    process.exit(1);
  }

  console.log(`\nย้ายข้อมูลจาก ${SQLITE_FILE}\n`);

  /* ---- ตั้งค่าระบบ ---- */
  const settings = sqlite.prepare('SELECT * FROM system_settings WHERE id = 1').get();
  if (settings) {
    await pg.run(
      `UPDATE system_settings SET school_name = $1, affiliation_name = $2, school_logo = $3,
       admin_pin_hash = $4, admin_pin_salt = $5, require_images = $6, updated_at = $7 WHERE id = 1`,
      [
        settings.school_name, settings.affiliation_name, settings.school_logo,
        settings.admin_pin_hash, settings.admin_pin_salt, settings.require_images, settings.updated_at,
      ]
    );
    console.log('  ตั้งค่าระบบ (รวม PIN เดิม) — ย้ายแล้ว');
  }

  /* ---- ตารางข้อมูล ---- */
  const counts = {};
  for (const table of TABLES) {
    let rows;
    try {
      rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    } catch {
      console.log(`  ${table} — ไม่มีในฐานข้อมูลเดิม (ข้าม)`);
      continue;
    }
    if (!rows.length) { counts[table] = 0; continue; }

    // ใช้เฉพาะคอลัมน์ที่มีอยู่จริงในตารางปลายทาง
    const targetCols = (await pg.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]
    )).map((r) => r.column_name);

    const cols = Object.keys(rows[0]).filter((c) => targetCols.includes(c));

    await pg.transaction(async (tx) => {
      for (const row of rows) {
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
        await tx.query(
          `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`,
          cols.map((c) => row[c])
        );
      }
      // ปรับ sequence ของ id ให้ต่อจากค่าสูงสุด ไม่งั้นการเพิ่มข้อมูลใหม่จะชนกัน
      if (cols.includes('id')) {
        await tx.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
          [table]
        );
      }
    });

    counts[table] = rows.length;
    console.log(`  ${table} — ${rows.length} แถว`);
  }

  /* ---- รูปภาพ ---- */
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = require('@vercel/blob');
    const images = await pg.query("SELECT id, image_url FROM evaluation_images WHERE image_url LIKE '/uploads/%'");
    let moved = 0;
    let missing = 0;

    for (const img of images) {
      const name = path.basename(img.image_url);
      const full = path.join(UPLOADS_DIR, name);
      if (!fs.existsSync(full)) { missing += 1; continue; }

      const ext = path.extname(name).toLowerCase();
      const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const blob = await put(`uploads/${name}`, fs.readFileSync(full), {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: type,
        addRandomSuffix: false,
      });
      await pg.run('UPDATE evaluation_images SET image_url = $1 WHERE id = $2', [blob.url, img.id]);
      moved += 1;
    }

    // โลโก้โรงเรียน
    const s = await pg.getSettings();
    if (s && s.school_logo && s.school_logo.startsWith('/uploads/')) {
      const full = path.join(UPLOADS_DIR, path.basename(s.school_logo));
      if (fs.existsSync(full)) {
        const blob = await put(`uploads/${path.basename(s.school_logo)}`, fs.readFileSync(full), {
          access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: false,
        });
        await pg.run('UPDATE system_settings SET school_logo = $1 WHERE id = 1', [blob.url]);
        console.log('  โลโก้โรงเรียน — อัปโหลดขึ้น Blob แล้ว');
      }
    }

    console.log(`  รูปภาพ — อัปโหลดขึ้น Blob ${moved} ไฟล์${missing ? ` (หาไฟล์ไม่เจอ ${missing} ไฟล์)` : ''}`);
  } else {
    console.log('  รูปภาพ — ข้าม (ไม่ได้ตั้ง BLOB_READ_WRITE_TOKEN)');
    console.log('    หมายเหตุ: ถ้าไม่ย้ายรูปขึ้น Blob รูปในรายงานเดิมจะแสดงไม่ได้บน Vercel');
  }

  await pg.closeDatabase();
  console.log('\nย้ายข้อมูลเรียบร้อยแล้ว\n');
}

main().catch((e) => { console.error('\nย้ายข้อมูลไม่สำเร็จ:', e.message, '\n'); process.exit(1); });
