'use strict';
/**
 * การอัปโหลดรูปภาพ
 *
 * production : Vercel Blob (ตั้ง BLOB_READ_WRITE_TOKEN)
 * พัฒนา      : เก็บลงโฟลเดอร์ uploads/ ในเครื่อง
 *
 * ทั้งสองโหมดตรวจชนิด/ขนาดไฟล์เหมือนกัน และสร้างชื่อไฟล์ใหม่เสมอ
 * เพื่อกันชื่อซ้ำและกัน path traversal
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const { bad } = require('./validate');

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';
const USE_BLOB = !!BLOB_TOKEN;

const UPLOAD_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');

// ห้ามแตะระบบไฟล์ตอนโหลดโมดูล — บน serverless ระบบไฟล์เขียนไม่ได้
// ถ้าทำจะพังทั้งฟังก์ชันตั้งแต่ยังไม่ทันรับ request แรก
let uploadDirReady = false;
function ensureUploadDir() {
  if (uploadDirReady || USE_BLOB) return;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  uploadDirReady = true;
}

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/pjpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 10;

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED.has(file.mimetype) || (ext && !ALLOWED_EXT.has(ext))) {
    return cb(bad('รองรับเฉพาะไฟล์ JPG, JPEG, PNG และ WEBP เท่านั้น'));
  }
  cb(null, true);
}

/** ชื่อไฟล์ใหม่แบบสุ่มเสมอ */
function newFileName(mimetype) {
  const ext = ALLOWED.get(mimetype) || '.jpg';
  return `${Date.now().toString(36)}-${crypto.randomBytes(10).toString('hex')}${ext}`;
}

// เก็บไฟล์ไว้ในหน่วยความจำก่อน แล้วค่อยตัดสินใจว่าจะส่งไป Blob หรือเขียนลงดิสก์
const memory = multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES } });

const uploadImages = memory.array('images', MAX_FILES);
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
}).single('logo');

/**
 * บันทึกไฟล์ที่ผ่าน multer แล้วไปยังที่เก็บถาวร
 * @param {object} file ไฟล์จาก multer (memoryStorage)
 * @returns {Promise<{url: string, fileName: string}>}
 */
async function storeFile(file) {
  const fileName = newFileName(file.mimetype);

  if (USE_BLOB) {
    const { put } = require('@vercel/blob');
    const blob = await put(`uploads/${fileName}`, file.buffer, {
      access: 'public',
      token: BLOB_TOKEN,
      contentType: file.mimetype,
      addRandomSuffix: false,
    });
    return { url: blob.url, fileName: file.originalname || fileName };
  }

  // บน serverless เขียนดิสก์ไม่ได้ ถ้ายังไม่ได้ต่อ Blob ต้องบอกให้ชัดว่าต้องทำอะไร
  if (process.env.VERCEL) {
    throw bad(
      'ยังไม่ได้ต่อที่เก็บรูปภาพ (Vercel Blob) จึงอัปโหลดไฟล์ไม่ได้ — ' +
      'ไปที่โปรเจกต์บน Vercel → แท็บ Storage → Create Database → เลือก Blob → Connect to Project แล้ว Redeploy'
    );
  }

  ensureUploadDir();
  await fs.promises.writeFile(path.join(UPLOAD_DIR, fileName), file.buffer);
  return { url: `/uploads/${fileName}`, fileName: file.originalname || fileName };
}

/** บันทึกหลายไฟล์พร้อมกัน */
function storeFiles(files) {
  return Promise.all((files || []).map(storeFile));
}

/** ลบไฟล์รูปอย่างปลอดภัย รองรับทั้ง Blob และไฟล์ในเครื่อง */
async function removeFile(imageUrl) {
  if (!imageUrl) return;

  if (/^https?:\/\//i.test(imageUrl)) {
    if (!USE_BLOB) return;
    try {
      const { del } = require('@vercel/blob');
      await del(imageUrl, { token: BLOB_TOKEN });
    } catch (err) {
      console.error('[uploads] ลบไฟล์บน Blob ไม่สำเร็จ:', err.message);
    }
    return;
  }

  // ไฟล์ในเครื่อง — อนุญาตเฉพาะไฟล์ที่อยู่ใน uploads/ เท่านั้น
  const name = path.basename(String(imageUrl));
  const full = path.join(UPLOAD_DIR, name);
  if (!full.startsWith(UPLOAD_DIR)) return;
  await fs.promises.unlink(full).catch(() => {});
}

module.exports = {
  UPLOAD_DIR, USE_BLOB,
  uploadImages, uploadLogo,
  storeFile, storeFiles, removeFile,
  MAX_FILE_SIZE, MAX_FILES,
};
