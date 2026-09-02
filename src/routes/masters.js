'use strict';
/** CRUD กลางสำหรับข้อมูลพื้นฐานทุกเมนู (ภาคเรียน / ปีการศึกษา / ครู / ผู้เยี่ยม / ชั้นเรียน / กลุ่มสาระ / หัวข้อกลุ่ม / ตัวชี้วัด) */
const express = require('express');
const { query, one, run, transaction, MASTER_TABLES, now } = require('../lib/db');
const { wrap, pageParams } = require('../lib/http');
const { mapRow, mapRows, likeValue } = require('../lib/rows');
const { HttpError, bad, requiredText, optionalText, toInt, toBool } = require('../lib/validate');

const router = express.Router();

function config(resource) {
  const cfg = MASTER_TABLES[resource];
  if (!cfg) throw new HttpError(404, 'ไม่พบรายการข้อมูลที่ต้องการ');
  return cfg;
}

/** ฟิลด์ที่ใช้เป็น "ชื่อ" ของแต่ละตาราง */
function nameField(cfg) {
  if (cfg.fields.includes('full_name')) return 'full_name';
  if (cfg.fields.includes('indicator_name')) return 'indicator_name';
  return 'name';
}

/** อ่านค่าจาก body ตามชนิดของตาราง พร้อม validate ฝั่ง server */
async function readBody(resource, body) {
  const cfg = config(resource);
  const data = {};
  if (cfg.fields.includes('full_name')) {
    data.full_name = requiredText(body.fullName, 'ชื่อ-นามสกุล', { min: 2, max: 150 });
    data.position = optionalText(body.position, 150);
  }
  if (cfg.fields.includes('indicator_name')) {
    data.indicator_name = requiredText(body.indicatorName, 'ชื่อรายการตัวชี้วัด', { min: 3, max: 500 });
  }
  if (cfg.fields.includes('group_id')) {
    // หัวข้อกลุ่มไม่บังคับ — ตัวชี้วัดที่ไม่มีกลุ่มจะแสดงเป็นรายการเดี่ยว
    const groupId = toInt(body.groupId === '' || body.groupId == null ? null : body.groupId, 'หัวข้อกลุ่ม', { required: false });
    if (groupId) {
      const group = await one('SELECT id FROM indicator_groups WHERE id = $1 AND deleted_at IS NULL', [groupId]);
      if (!group) throw bad('หัวข้อกลุ่มที่เลือกไม่ถูกต้อง', { field: 'groupId' });
    }
    data.group_id = groupId;
  }
  if (cfg.fields.includes('name')) {
    const label =
      resource === 'semesters' ? 'ชื่อภาคเรียน'
        : resource === 'academic-years' ? 'ชื่อปีการศึกษา'
          : resource === 'learning-areas' ? 'ชื่อกลุ่มสาระการเรียนรู้'
            : resource === 'indicator-groups' ? 'ชื่อหัวข้อกลุ่ม'
              : 'ชื่อชั้นเรียน';
    data.name = requiredText(body.name, label, { min: 1, max: 150 });
  }
  if (cfg.fields.includes('sort_order')) {
    data.sort_order = toInt(body.sortOrder === '' || body.sortOrder == null ? 0 : body.sortOrder, 'ลำดับการแสดงผล', {
      min: 0, max: 9999, required: false,
    }) || 0;
  }
  data.status = body.status === undefined ? 1 : toBool(body.status) ? 1 : 0;
  return data;
}

/** กันข้อมูลซ้ำ (ไม่สนตัวพิมพ์เล็กใหญ่ / ช่องว่างซ้ำ, ไม่นับรายการที่ถูกลบแล้ว) */
async function assertNotDuplicate(cfg, field, value, excludeId) {
  const sql = `SELECT id, ${field} AS v FROM ${cfg.table} WHERE deleted_at IS NULL` + (excludeId ? ' AND id <> $1' : '');
  const rows = await query(sql, excludeId ? [excludeId] : []);
  const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  if (rows.some((r) => norm(r.v) === norm(value))) {
    throw new HttpError(409, `มี "${value}" อยู่ในระบบแล้ว กรุณาตรวจสอบอีกครั้ง`);
  }
}

/** นับจำนวนการถูกนำไปใช้จริง เพื่อตัดสินใจว่าจะลบถาวรหรือ soft delete */
async function usageCount(resource, id) {
  const cfg = config(resource);
  if (resource === 'indicators') {
    const r = await one('SELECT COUNT(*)::int AS c FROM evaluation_scores WHERE indicator_id = $1', [id]);
    return r.c;
  }
  if (resource === 'indicator-groups') {
    const r = await one('SELECT COUNT(*)::int AS c FROM indicators WHERE group_id = $1 AND deleted_at IS NULL', [id]);
    return r.c;
  }
  const r = await one(`SELECT COUNT(*)::int AS c FROM evaluations WHERE ${cfg.usedBy} = $1`, [id]);
  return r.c;
}

/* ---------------- List ---------------- */
router.get('/:resource', wrap(async (req, res) => {
  const { resource } = req.params;
  const cfg = config(resource);
  const field = nameField(cfg);
  const { page, pageSize, offset } = pageParams(req.query);
  const search = String(req.query.search || '').trim();
  const status = req.query.status;

  const where = ['m.deleted_at IS NULL'];
  const params = [];
  if (search) {
    // ILIKE เพราะ LIKE ของ Postgres สนใจตัวพิมพ์เล็กใหญ่
    const hasPosition = cfg.fields.includes('position');
    params.push(likeValue(search));
    if (hasPosition) {
      params.push(likeValue(search));
      where.push(`(m.${field} ILIKE $1 OR m.position ILIKE $2)`);
    } else {
      where.push(`m.${field} ILIKE $1`);
    }
  }
  if (status === '1' || status === '0') where.push(`m.status = ${Number(status)}`);

  const whereSql = where.join(' AND ');

  // ตัวชี้วัดต้องเรียงตามหัวข้อกลุ่มก่อน แล้วจึงเรียงตามลำดับภายในกลุ่ม
  const grouped = resource === 'indicators';
  const from = grouped
    ? `${cfg.table} m LEFT JOIN indicator_groups g ON g.id = m.group_id AND g.deleted_at IS NULL`
    : `${cfg.table} m`;
  const columns = grouped ? 'm.*, g.name AS group_name, g.sort_order AS group_sort' : 'm.*';
  const orderBy = grouped
    ? 'COALESCE(g.sort_order, 9999) ASC, m.sort_order ASC, m.id ASC'
    : cfg.fields.includes('sort_order') ? 'm.sort_order ASC, m.id ASC' : `m.${field} ASC`;

  const totalRow = await one(`SELECT COUNT(*)::int AS c FROM ${from} WHERE ${whereSql}`, params);
  const rows = await query(
    `SELECT ${columns} FROM ${from} WHERE ${whereSql} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset]
  );

  const items = [];
  for (const r of mapRows(rows)) {
    items.push({ ...r, usageCount: await usageCount(resource, r.id) });
  }

  res.json({
    ok: true,
    meta: { page, pageSize, total: totalRow.c, totalPages: Math.max(1, Math.ceil(totalRow.c / pageSize)) },
    data: items,
  });
}));

/* ---------------- Reorder (ต้องมาก่อน route แบบ /:id) ---------------- */
router.post('/:resource/reorder', wrap(async (req, res) => {
  const { resource } = req.params;
  const cfg = config(resource);
  if (!cfg.fields.includes('sort_order')) throw bad('รายการนี้ไม่รองรับการเปลี่ยนลำดับ');
  const orders = Array.isArray(req.body && req.body.orders) ? req.body.orders : [];
  if (!orders.length) throw bad('ไม่พบข้อมูลลำดับที่ต้องการบันทึก');

  const ts = now();
  await transaction(async (tx) => {
    for (let i = 0; i < orders.length; i += 1) {
      const o = orders[i];
      await tx.query(
        `UPDATE ${cfg.table} SET sort_order = $1, updated_at = $2 WHERE id = $3`,
        [toInt(o.sortOrder == null ? i + 1 : o.sortOrder, 'ลำดับ', { min: 0, max: 9999 }), ts, toInt(o.id, 'รหัสรายการ')]
      );
    }
  });

  res.json({ ok: true, message: 'บันทึกลำดับใหม่เรียบร้อยแล้ว', data: { count: orders.length } });
}));

/* ---------------- Create ---------------- */
router.post('/:resource', wrap(async (req, res) => {
  const { resource } = req.params;
  const cfg = config(resource);
  const data = await readBody(resource, req.body || {});
  await assertNotDuplicate(cfg, nameField(cfg), data[nameField(cfg)]);

  // ถ้าไม่ระบุลำดับ ให้ต่อท้ายอัตโนมัติ
  if (cfg.fields.includes('sort_order') && !data.sort_order) {
    const maxRow = await one(`SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM ${cfg.table}`);
    data.sort_order = (maxRow.m || 0) + 1;
  }

  const ts = now();
  const cols = [...Object.keys(data), 'created_at', 'updated_at'];
  const values = [...Object.values(data), ts, ts];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');

  const inserted = await run(
    `INSERT INTO ${cfg.table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json({ ok: true, message: `เพิ่ม${cfg.label}เรียบร้อยแล้ว`, data: mapRow(inserted.rows[0]) });
}));

/* ---------------- Update ---------------- */
router.put('/:resource/:id', wrap(async (req, res) => {
  const { resource } = req.params;
  const cfg = config(resource);
  const id = toInt(req.params.id, 'รหัสรายการ');
  const existing = await one(`SELECT * FROM ${cfg.table} WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!existing) throw new HttpError(404, `ไม่พบ${cfg.label}ที่ต้องการแก้ไข`);

  const data = await readBody(resource, req.body || {});
  await assertNotDuplicate(cfg, nameField(cfg), data[nameField(cfg)], id);

  const keys = Object.keys(data);
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const updated = await run(
    `UPDATE ${cfg.table} SET ${sets}, updated_at = $${keys.length + 1} WHERE id = $${keys.length + 2} RETURNING *`,
    [...Object.values(data), now(), id]
  );
  res.json({ ok: true, message: `แก้ไข${cfg.label}เรียบร้อยแล้ว`, data: mapRow(updated.rows[0]) });
}));

/* ---------------- Toggle status ---------------- */
router.patch('/:resource/:id/status', wrap(async (req, res) => {
  const { resource } = req.params;
  const cfg = config(resource);
  const id = toInt(req.params.id, 'รหัสรายการ');
  const status = toBool(req.body && req.body.status) ? 1 : 0;
  const result = await run(
    `UPDATE ${cfg.table} SET status = $1, updated_at = $2 WHERE id = $3 AND deleted_at IS NULL`,
    [status, now(), id]
  );
  if (!result.rowCount) throw new HttpError(404, `ไม่พบ${cfg.label}ที่ต้องการ`);
  res.json({ ok: true, message: status ? 'เปิดใช้งานรายการแล้ว' : 'ปิดใช้งานรายการแล้ว', data: { id, status } });
}));

/* ---------------- Delete (soft delete ถ้าเคยถูกใช้งานแล้ว) ---------------- */
router.delete('/:resource/:id', wrap(async (req, res) => {
  const { resource } = req.params;
  const cfg = config(resource);
  const id = toInt(req.params.id, 'รหัสรายการ');
  const row = await one(`SELECT * FROM ${cfg.table} WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!row) throw new HttpError(404, `ไม่พบ${cfg.label}ที่ต้องการลบ`);

  const used = await usageCount(resource, id);
  if (used > 0) {
    // Soft delete: เก็บข้อมูลไว้เพื่อไม่ให้ผลการประเมินเดิมเสียหาย
    const ts = now();
    await run(`UPDATE ${cfg.table} SET deleted_at = $1, status = 0, updated_at = $2 WHERE id = $3`, [ts, ts, id]);
    return res.json({
      ok: true,
      message: `ลบ${cfg.label}ออกจากรายการแล้ว (ข้อมูลถูกใช้ในการประเมิน ${used} รายการ ระบบเก็บไว้เบื้องหลังเพื่อความถูกต้องของรายงานเดิม)`,
      data: { id, softDeleted: true },
    });
  }
  await run(`DELETE FROM ${cfg.table} WHERE id = $1`, [id]);
  res.json({ ok: true, message: `ลบ${cfg.label}เรียบร้อยแล้ว`, data: { id, softDeleted: false } });
}));

module.exports = router;
