'use strict';
/** Server-side validation helpers (ตรวจซ้ำเสมอ ไม่เชื่อค่าจาก client) */

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const bad = (message, details) => new HttpError(400, message, details);

const CONTROL_CHARS = new RegExp('[\u0000-\u001F\u007F]', 'g');

/** ตัดอักขระควบคุมและช่องว่างหัวท้าย (ฝั่งแสดงผลใช้ textContent เสมอเพื่อกัน XSS) */
function clean(value, max = 255) {
  if (value === null || value === undefined) return '';
  return String(value).replace(CONTROL_CHARS, '').trim().slice(0, max);
}

/** สำหรับ textarea ที่อนุญาตให้ขึ้นบรรทัดใหม่ได้ */
function cleanMultiline(value, max = 2000) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', 'g'), '')
    .trim()
    .slice(0, max);
}

function requiredText(value, field, { min = 1, max = 255 } = {}) {
  const v = clean(value, max);
  if (v.length < min) throw bad(`กรุณากรอก${field}${min > 1 ? ` อย่างน้อย ${min} ตัวอักษร` : ''}`, { field });
  return v;
}

function optionalText(value, max = 255) {
  return clean(value, max);
}

function toInt(value, field, { min = -2147483648, max = 2147483647, required = true } = {}) {
  if (value === '' || value === null || value === undefined) {
    if (required) throw bad(`กรุณาระบุ${field}`, { field });
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${field}ไม่ถูกต้อง`, { field });
  return n;
}

/** รับได้ทั้ง YYYY-MM-DD และ ISO string */
function toDate(value, field) {
  const v = clean(value, 40);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) throw bad(`รูปแบบ${field}ไม่ถูกต้อง`, { field });
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw bad(`${field}ไม่ถูกต้อง`, { field });
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function toBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

function pin4(value, field = 'PIN') {
  const v = String(value ?? '').trim();
  if (!/^\d{4}$/.test(v)) throw bad(`${field} ต้องเป็นตัวเลข 4 หลัก`, { field });
  return v;
}

module.exports = { HttpError, bad, clean, cleanMultiline, requiredText, optionalText, toInt, toDate, toBool, pin4 };
