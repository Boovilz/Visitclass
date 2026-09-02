'use strict';
const { HttpError } = require('./validate');

/** ห่อ async handler เพื่อส่ง error เข้าสู่ error middleware */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ok = (res, data = {}, extra = {}) => res.json({ ok: true, ...extra, data });

/** Cookie parser ขนาดเล็ก (ไม่ต้องพึ่ง dependency ภายนอก) */
function cookieParser(req, _res, next) {
  const header = req.headers.cookie;
  req.cookies = {};
  if (header) {
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx < 0) continue;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      try { req.cookies[k] = decodeURIComponent(v); } catch { req.cookies[k] = v; }
    }
  }
  next();
}

function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ ok: false, message: err.message, details: err.details || null });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, message: 'ไฟล์รูปภาพมีขนาดใหญ่เกินกำหนด (สูงสุด 5 MB ต่อไฟล์)' });
  }
  if (err && err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ ok: false, message: 'อัปโหลดรูปภาพได้สูงสุด 10 ไฟล์ต่อการประเมิน 1 ครั้ง' });
  }
  if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ ok: false, message: 'พบไฟล์แนบที่ไม่รองรับ' });
  }
  if (err && /UNIQUE constraint/i.test(err.message || '')) {
    return res.status(409).json({ ok: false, message: 'ข้อมูลนี้มีอยู่ในระบบแล้ว' });
  }
  // JSON ที่ส่งมาผิดรูปแบบ ถือเป็นความผิดพลาดของคำขอ ไม่ใช่ของเซิร์ฟเวอร์
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ ok: false, message: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง' });
  }
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' });
}

function pageParams(query, defaultSize = 10) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const sizeRaw = parseInt(query.pageSize, 10) || defaultSize;
  const pageSize = Math.min(100, Math.max(5, sizeRaw));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

module.exports = { wrap, ok, cookieParser, errorHandler, pageParams };
