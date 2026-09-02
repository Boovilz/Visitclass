'use strict';
/**
 * จำกัดอัตราการเรียก API โดยเก็บสถิติในฐานข้อมูล
 * (บน Vercel ระบบรันหลาย instance การนับในหน่วยความจำจึงกันไม่ได้จริง)
 */
const { one, run } = require('./db');
const { HttpError } = require('./validate');

/**
 * @param {object} options { windowMs, max, message, key }
 */
function rateLimit(options) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 30;
  const bucket = options.key || 'default';
  const message = options.message || 'มีการส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';

  return async function limiter(req, _res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    try {
      const row = await one(
        `SELECT COUNT(*)::int AS hits, MIN(hit_at) AS oldest
         FROM rate_limits
         WHERE bucket = $1 AND client_key = $2 AND hit_at > now() - ($3 || ' milliseconds')::interval`,
        [bucket, ip, String(windowMs)]
      );

      const hits = (row && row.hits) || 0;
      if (hits >= max) {
        const oldest = row.oldest ? new Date(row.oldest).getTime() : Date.now();
        const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - Date.now()) / 1000));
        return next(new HttpError(429, `${message} (รออีกประมาณ ${retryAfter} วินาที)`));
      }

      await run('INSERT INTO rate_limits (bucket, client_key) VALUES ($1, $2)', [bucket, ip]);
      next();
    } catch (err) {
      // ถ้าตรวจสอบไม่ได้ ไม่ควรทำให้ระบบใช้งานไม่ได้ทั้งหมด — บันทึกไว้แล้วปล่อยผ่าน
      console.error('[ratelimit] ตรวจสอบไม่สำเร็จ:', err.message);
      next();
    }
  };
}

module.exports = { rateLimit };
