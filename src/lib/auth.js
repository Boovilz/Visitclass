'use strict';
/**
 * PIN hashing (scrypt) + stateless signed-cookie sessions + brute-force throttling
 *
 * บน Vercel ระบบรันหลาย instance พร้อมกัน การนับ PIN ที่ผิดจึงต้องเก็บในฐานข้อมูล
 * ไม่ใช่หน่วยความจำของ instance ใดตัวหนึ่ง
 * ไม่มีการส่ง PIN หรือ hash ออกไปยัง frontend ในทุกกรณี
 */
const crypto = require('node:crypto');
const { query, one, run, getSettings, now } = require('./db');

const COOKIE_NAME = 'cvs_session';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 ชั่วโมง

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;  // นับความพยายามย้อนหลัง 15 นาที
const LOCKOUT_MS = 5 * 60 * 1000;  // ถูกระงับนาน 5 นาทีหลังผิดครบ

/* ---------------- กุญแจลงลายเซ็นเซสชัน ---------------- */
function serverSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  // ไม่มีระบบไฟล์ถาวรบน Vercel จึงบังคับให้ตั้งค่าผ่าน environment variable
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error(
      'ไม่พบ SESSION_SECRET — กรุณาตั้งค่าที่ Environment Variables\n' +
      '  สร้างค่าใหม่ด้วย: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }

  // โหมดพัฒนาในเครื่อง: สุ่มค่าชั่วคราว (เซสชันจะหลุดทุกครั้งที่รีสตาร์ต ซึ่งยอมรับได้)
  if (!global.__devSessionSecret) {
    global.__devSessionSecret = crypto.randomBytes(48).toString('hex');
    console.warn('  หมายเหตุ: ไม่ได้ตั้ง SESSION_SECRET — ใช้กุญแจชั่วคราวสำหรับการพัฒนา');
  }
  return global.__devSessionSecret;
}

/* ---------------- PIN ---------------- */
function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 64).toString('hex');
  return { hash, salt };
}

async function verifyPin(pin) {
  const s = await getSettings();
  if (!s || !s.admin_pin_hash || !s.admin_pin_salt) return false;
  const { hash } = hashPin(pin, s.admin_pin_salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(s.admin_pin_hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function setPin(pin) {
  const { hash, salt } = hashPin(pin);
  await run(
    'UPDATE system_settings SET admin_pin_hash = $1, admin_pin_salt = $2, updated_at = $3 WHERE id = 1',
    [hash, salt, now()]
  );
}

/* ---------------- Session ---------------- */
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', serverSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function unsign(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', serverSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function issueSession(res) {
  const payload = { role: 'admin', iat: Date.now(), exp: Date.now() + SESSION_TTL_MS, jti: crypto.randomUUID() };
  res.cookie(COOKIE_NAME, sign(payload), {
    httpOnly: true,
    sameSite: 'strict',
    secure: !!process.env.SECURE_COOKIE,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  return payload;
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/', sameSite: 'strict', httpOnly: true });
}

function currentSession(req) {
  return unsign(req.cookies?.[COOKIE_NAME]);
}

/** ตรวจสอบสิทธิ์ก่อนเข้าถึง API ผู้ดูแลทุกครั้ง */
function requireAdmin(req, res, next) {
  const session = currentSession(req);
  if (!session) {
    return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
  // ป้องกัน CSRF: การเปลี่ยนแปลงข้อมูลต้องมาจาก XHR ของระบบเท่านั้น (คุกกี้เป็น SameSite=Strict อยู่แล้ว)
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (mutating && req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ ok: false, code: 'CSRF', message: 'คำขอไม่ถูกต้อง (CSRF)' });
  }
  req.session = session;
  next();
}

/* ---------------- การหน่วงเวลาเมื่อกรอก PIN ผิด (เก็บในฐานข้อมูล) ---------------- */
const PIN_BUCKET = 'pin_fail';

/** ดูสถานะปัจจุบันว่าถูกระงับอยู่หรือไม่ */
async function throttleState(ip) {
  const row = await one(
    `SELECT COUNT(*)::int AS fails, MAX(hit_at) AS last_fail
     FROM rate_limits
     WHERE bucket = $1 AND client_key = $2 AND hit_at > now() - ($3 || ' milliseconds')::interval`,
    [PIN_BUCKET, ip, String(WINDOW_MS)]
  );

  const fails = (row && row.fails) || 0;
  if (fails < MAX_ATTEMPTS) {
    return { locked: false, remaining: MAX_ATTEMPTS - fails };
  }

  const lastFail = row.last_fail ? new Date(row.last_fail).getTime() : Date.now();
  const unlockAt = lastFail + LOCKOUT_MS;
  if (unlockAt > Date.now()) {
    return { locked: true, remaining: 0, retryAfter: Math.ceil((unlockAt - Date.now()) / 1000) };
  }
  // พ้นเวลาระงับแล้ว — ล้างประวัติเพื่อเริ่มนับใหม่
  await resetFailures(ip);
  return { locked: false, remaining: MAX_ATTEMPTS };
}

async function registerFailure(ip) {
  await run('INSERT INTO rate_limits (bucket, client_key) VALUES ($1, $2)', [PIN_BUCKET, ip]);
  // ล้างข้อมูลเก่ากันตารางโตไม่จำกัด
  await run(`DELETE FROM rate_limits WHERE hit_at < now() - INTERVAL '1 day'`);
  return throttleState(ip);
}

async function resetFailures(ip) {
  await run('DELETE FROM rate_limits WHERE bucket = $1 AND client_key = $2', [PIN_BUCKET, ip]);
}

module.exports = {
  COOKIE_NAME, hashPin, verifyPin, setPin, issueSession, clearSession,
  currentSession, requireAdmin, throttleState, registerFailure, resetFailures,
};
