'use strict';
/** แปลง snake_case ที่ได้จาก SQLite เป็น camelCase สำหรับ API */
const toCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function mapRow(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

const mapRows = (rows) => (rows || []).map(mapRow);

/** สร้างเงื่อนไข LIKE สำหรับการค้นหาภาษาไทย (escape อักขระพิเศษของ LIKE) */
const likeValue = (search) => `%${String(search).replace(/[%_\\]/g, (m) => '\\' + m)}%`;

module.exports = { mapRow, mapRows, toCamel, likeValue };
