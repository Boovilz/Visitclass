'use strict';
/**
 * Data access layer — PostgreSQL
 *
 * รองรับ 2 โหมดโดยใช้คำสั่ง SQL ชุดเดียวกัน:
 *   - production : Neon (ตั้ง DATABASE_URL)
 *   - พัฒนา/ทดสอบ : PGlite (Postgres ที่รันในเครื่อง ไม่ต้องติดตั้งอะไรเพิ่ม)
 *
 * ข้อควรระวังของ Postgres ที่จัดการไว้แล้วทั้งโปรเจกต์:
 *   - ฟังก์ชันนับแถวเป็น BIGINT ไดรเวอร์คืนเป็น string  -> ทุกจุดต้อง cast เป็น int
 *   - ฟังก์ชันค่าเฉลี่ยเป็น NUMERIC ไดรเวอร์คืนเป็น string -> ทุกจุดต้อง cast เป็น float8
 *   - LIKE ของ Postgres สนตัวพิมพ์เล็กใหญ่        → การค้นหาใช้ ILIKE
 */
const path = require('node:path');
const fs = require('node:fs');

// Neon ที่สร้างผ่าน Vercel อาจตั้งชื่อตัวแปรได้หลายแบบ จึงมองหาทุกชื่อที่เป็นไปได้
// (เรียงจากที่เหมาะกับ serverless ที่สุด คือแบบ pooled ก่อน)
const CONNECTION_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
];
const CONNECTION_KEY = CONNECTION_KEYS.find((k) => process.env[k]);
const CONNECTION_STRING = CONNECTION_KEY ? process.env[CONNECTION_KEY] : '';
const USE_NEON = !!CONNECTION_STRING;

const now = () => new Date().toISOString();

/* ==================================================================
 * ชั้นเชื่อมต่อฐานข้อมูล — ปรับ API ของทั้งสองไดรเวอร์ให้เหมือนกัน
 * ================================================================== */
let driver = null;

function createNeonDriver() {
  const { Pool, neonConfig } = require('@neondatabase/serverless');
  // ใช้ WebSocket เพื่อให้รองรับ transaction จริง (BEGIN/COMMIT ข้ามหลายคำสั่ง)
  neonConfig.webSocketConstructor = require('ws');

  const pool = new Pool({ connectionString: CONNECTION_STRING });
  pool.on('error', (err) => console.error('[db] connection error:', err.message));

  return {
    name: 'neon',
    async query(text, params) {
      const r = await pool.query(text, params);
      return { rows: r.rows, rowCount: r.rowCount };
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const wrapped = {
          async query(text, params) {
            const r = await client.query(text, params);
            return { rows: r.rows, rowCount: r.rowCount };
          },
        };
        const result = await fn(wrapped);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* การเชื่อมต่อหลุดไปแล้ว */ }
        throw err;
      } finally {
        client.release();
      }
    },
    async close() { await pool.end(); },
  };
}

function createPgliteDriver() {
  // บน Vercel ไม่มีดิสก์ถาวร ถ้าปล่อยให้ใช้ PGlite ข้อมูลจะหายทุกครั้งที่ deploy
  if (process.env.VERCEL) {
    throw new Error('ยังไม่ได้ต่อฐานข้อมูล — กรุณาสร้าง Neon ที่แท็บ Storage ของโปรเจกต์บน Vercel');
  }
  // ใช้ชื่อโมดูลผ่านตัวแปร เพื่อไม่ให้ตัวไล่ dependency ของ Vercel พยายามรวม PGlite เข้า bundle
  // (เป็น devDependency ใช้เฉพาะตอนพัฒนา ถ้าถูกไล่จะทำให้ build ล้ม)
  const pgliteModule = '@electric-sql/pglite';
  const { PGlite } = require(pgliteModule);
  // เก็บไฟล์ไว้ในโฟลเดอร์ data เพื่อให้ข้อมูลอยู่ต่อระหว่างการพัฒนา
  const dir = process.env.PGLITE_DIR || path.join(__dirname, '..', '..', 'data', 'pg');
  if (dir !== ':memory:') fs.mkdirSync(path.dirname(dir), { recursive: true });

  const ready = PGlite.create(dir === ':memory:' ? undefined : dir);

  return {
    name: 'pglite',
    async query(text, params) {
      const db = await ready;
      const r = await db.query(text, params);
      return { rows: r.rows, rowCount: r.affectedRows == null ? r.rows.length : r.affectedRows };
    },
    async exec(sql) {
      const db = await ready;
      await db.exec(sql);
    },
    async transaction(fn) {
      const db = await ready;
      return db.transaction(async (tx) => {
        const wrapped = {
          async query(text, params) {
            const r = await tx.query(text, params);
            return { rows: r.rows, rowCount: r.affectedRows == null ? r.rows.length : r.affectedRows };
          },
        };
        return fn(wrapped);
      });
    },
    async close() { const db = await ready; await db.close(); },
  };
}

function getDriver() {
  if (!driver) driver = USE_NEON ? createNeonDriver() : createPgliteDriver();
  return driver;
}

/* ---------------- ตัวช่วยเรียกฐานข้อมูล ---------------- */

/** คืนทุกแถวเป็น array */
async function query(text, params = []) {
  const r = await getDriver().query(text, params);
  return r.rows;
}

/** คืนแถวแรก หรือ null ถ้าไม่พบ */
async function one(text, params = []) {
  const rows = await query(text, params);
  return rows.length ? rows[0] : null;
}

/** รันคำสั่งเปลี่ยนแปลงข้อมูล คืนจำนวนแถวที่ถูกกระทบ */
async function run(text, params = []) {
  return getDriver().query(text, params);
}

/**
 * ทำงานภายใน transaction เดียว — ถ้ามีข้อผิดพลาดจะย้อนกลับทั้งหมด
 * ใช้กับการบันทึกผลประเมิน (หัวรายการ + คะแนนรายข้อ + รูปภาพ) ที่ต้องสำเร็จพร้อมกัน
 */
function transaction(fn) {
  return getDriver().transaction(fn);
}

/* ==================================================================
 * โครงสร้างตาราง
 * ================================================================== */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  school_name TEXT NOT NULL DEFAULT '',
  affiliation_name TEXT NOT NULL DEFAULT '',
  school_logo TEXT,
  admin_pin_hash TEXT NOT NULL DEFAULT '',
  admin_pin_salt TEXT NOT NULL DEFAULT '',
  require_images INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS semesters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_years (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classroom_teachers (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visitors (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classrooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_areas (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS indicator_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS indicators (
  id SERIAL PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  indicator_name TEXT NOT NULL,
  group_id INTEGER REFERENCES indicator_groups(id),
  status INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  semester_id INTEGER NOT NULL REFERENCES semesters(id),
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id),
  classroom_teacher_id INTEGER NOT NULL REFERENCES classroom_teachers(id),
  classroom_id INTEGER NOT NULL REFERENCES classrooms(id),
  visit_date TEXT NOT NULL,
  visitor_id INTEGER NOT NULL REFERENCES visitors(id),
  education_level TEXT,
  subject_name TEXT,
  subject_code TEXT,
  learning_area_id INTEGER REFERENCES learning_areas(id),
  learning_area_snapshot TEXT,
  total_score INTEGER NOT NULL,
  maximum_score INTEGER NOT NULL,
  percentage DOUBLE PRECISION NOT NULL,
  quality_level TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_scores (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  indicator_id INTEGER NOT NULL,
  indicator_snapshot TEXT NOT NULL,
  sort_order_snapshot INTEGER NOT NULL,
  group_snapshot TEXT,
  group_sort_snapshot INTEGER,
  practice TEXT,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS evaluation_images (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

/* สถิติการเรียก API สำหรับจำกัดอัตรา — ต้องอยู่ในฐานข้อมูลเพราะ Vercel รันหลาย instance พร้อมกัน */
CREATE TABLE IF NOT EXISTS rate_limits (
  id SERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  client_key TEXT NOT NULL,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_group
  ON evaluations(academic_year_id, semester_id, classroom_teacher_id, classroom_id);
CREATE INDEX IF NOT EXISTS idx_eval_visit_date ON evaluations(visit_date);
CREATE INDEX IF NOT EXISTS idx_scores_eval ON evaluation_scores(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_images_eval ON evaluation_images(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_indicators_group ON indicators(group_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(bucket, client_key, hit_at);
`;

let migratePromise = null;

/** สร้าง/อัปเดตโครงสร้างตาราง — รันซ้ำได้ปลอดภัย และรันจริงแค่ครั้งเดียวต่อโปรเซส */
function migrate() {
  if (!migratePromise) {
    migratePromise = (async () => {
      await getDriver().exec(SCHEMA);
      await ensureSettings();
    })().catch((err) => { migratePromise = null; throw err; });
  }
  return migratePromise;
}

/* ---------------- ตารางข้อมูลพื้นฐานที่ใช้ CRUD ร่วมกัน ---------------- */
const MASTER_TABLES = {
  semesters: { table: 'semesters', fields: ['name'], unique: ['name'], label: 'ภาคเรียน', usedBy: 'semester_id' },
  'academic-years': { table: 'academic_years', fields: ['name'], unique: ['name'], label: 'ปีการศึกษา', usedBy: 'academic_year_id' },
  'classroom-teachers': { table: 'classroom_teachers', fields: ['full_name', 'position'], unique: ['full_name'], label: 'ผู้รับผิดชอบชั้นเรียน', usedBy: 'classroom_teacher_id' },
  visitors: { table: 'visitors', fields: ['full_name', 'position'], unique: ['full_name'], label: 'ผู้เยี่ยมชั้นเรียน', usedBy: 'visitor_id' },
  classrooms: { table: 'classrooms', fields: ['name', 'sort_order'], unique: ['name'], label: 'ชั้นเรียน', usedBy: 'classroom_id' },
  indicators: { table: 'indicators', fields: ['indicator_name', 'sort_order', 'group_id'], unique: ['indicator_name'], label: 'รายการตัวชี้วัด', usedBy: null },
  'learning-areas': { table: 'learning_areas', fields: ['name'], unique: ['name'], label: 'กลุ่มสาระการเรียนรู้', usedBy: 'learning_area_id' },
  'indicator-groups': { table: 'indicator_groups', fields: ['name', 'sort_order'], unique: ['name'], label: 'หัวข้อกลุ่มตัวชี้วัด', usedBy: null },
};

async function getSettings() {
  return one('SELECT * FROM system_settings WHERE id = 1');
}

async function ensureSettings() {
  await run(
    `INSERT INTO system_settings (id, school_name, affiliation_name, school_logo, admin_pin_hash, admin_pin_salt, require_images, updated_at)
     VALUES (1, $1, $2, NULL, '', '', 0, $3)
     ON CONFLICT (id) DO NOTHING`,
    ['โรงเรียนตัวอย่างวิทยา', 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษา เขต 1', now()]
  );
}

async function closeDatabase() {
  if (driver) await driver.close();
  driver = null;
  migratePromise = null;
}

const driverName = () => getDriver().name;

module.exports = {
  query, one, run, transaction, migrate,
  now, MASTER_TABLES, getSettings, closeDatabase, driverName,
};
