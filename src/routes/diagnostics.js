'use strict';
/**
 * หน้าตรวจสภาพระบบสำหรับผู้ดูแล — บอกว่าตอนนี้ต่ออะไรอยู่บ้าง
 * ใช้ตรวจหลัง deploy ว่าฐานข้อมูลและที่เก็บรูปภาพเชื่อมต่อถูกต้องหรือยัง
 *
 * บอกเฉพาะ "ชื่อ" ตัวแปรและสถานะ ไม่เปิดเผยค่าจริงของ token
 * หรือ connection string เด็ดขาด
 */
const express = require('express');
const { wrap } = require('../lib/http');
const { one, driverName } = require('../lib/db');
const { USE_BLOB, BLOB_TOKEN_KEY } = require('../lib/uploads');

const router = express.Router();

router.get('/', wrap(async (_req, res) => {
  const dbKeys = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING'];
  const dbKey = dbKeys.find((k) => process.env[k]) || null;

  // ชื่อตัวแปรที่น่าจะเกี่ยวกับที่เก็บรูปภาพ (เอาเฉพาะชื่อ ไม่เอาค่า)
  const blobKeys = Object.keys(process.env).filter(
    (k) => /BLOB|TOKEN/i.test(k) || String(process.env[k] || '').startsWith('vercel_blob_')
  );

  const counts = await one(`
    SELECT
      (SELECT COUNT(*)::int FROM evaluations) AS evaluations,
      (SELECT COUNT(*)::int FROM classroom_teachers WHERE deleted_at IS NULL) AS teachers,
      (SELECT COUNT(*)::int FROM visitors WHERE deleted_at IS NULL) AS visitors,
      (SELECT COUNT(*)::int FROM indicators WHERE deleted_at IS NULL AND status = 1) AS indicators,
      (SELECT COUNT(*)::int FROM evaluation_images) AS images`);

  res.json({
    ok: true,
    data: {
      ฐานข้อมูล: {
        ไดรเวอร์: driverName(),
        ตัวแปรที่ใช้: dbKey,
        เชื่อมต่อได้: true,
      },
      ที่เก็บรูปภาพ: {
        ใช้งานได้: USE_BLOB,
        ตัวแปรที่ใช้: BLOB_TOKEN_KEY,
        ตัวแปรที่พบทั้งหมด: blobKeys.length ? blobKeys : ['ไม่พบเลย'],
        หมายเหตุ: USE_BLOB
          ? 'พร้อมใช้งาน อัปโหลดรูปได้'
          : 'ยังอัปโหลดรูปไม่ได้ — ต้องผูก Vercel Blob แล้ว Redeploy',
      },
      การตั้งค่าอื่น: {
        SESSION_SECRET: process.env.SESSION_SECRET ? 'ตั้งแล้ว' : 'ยังไม่ได้ตั้ง',
        SECURE_COOKIE: process.env.SECURE_COOKIE ? 'ตั้งแล้ว' : 'ยังไม่ได้ตั้ง',
        NODE_ENV: process.env.NODE_ENV || '(ไม่ได้ตั้ง)',
        รันบน: process.env.VERCEL ? 'Vercel' : 'เซิร์ฟเวอร์ปกติ',
      },
      ข้อมูลในระบบ: counts,
    },
  });
}));

module.exports = router;
