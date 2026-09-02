'use strict';
/** ผลการเยี่ยมชั้นเรียนทั้งหมด (ค้นหา / กรอง / เรียงลำดับ / แบ่งหน้า / ดูรายละเอียด / ลบ) */
const express = require('express');
const { query, one } = require('../lib/db');
const { wrap, pageParams } = require('../lib/http');
const { mapRows, likeValue } = require('../lib/rows');
const { toInt } = require('../lib/validate');
const { getEvaluation, deleteEvaluation, DETAIL_SELECT } = require('../lib/evaluations');

const router = express.Router();

const SORTABLE = {
  visitDate: 'e.visit_date',
  teacher: 't.full_name',
  totalScore: 'e.total_score',
  percentage: 'e.percentage',
  createdAt: 'e.created_at',
};

router.get('/', wrap(async (req, res) => {
  const { page, pageSize, offset } = pageParams(req.query);
  const where = ['1 = 1'];
  const params = [];

  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

  const teacherId = toInt(req.query.classroomTeacherId, 'ผู้รับการเยี่ยมชั้นเรียน', { required: false });
  const semesterId = toInt(req.query.semesterId, 'ภาคเรียน', { required: false });
  const yearId = toInt(req.query.academicYearId, 'ปีการศึกษา', { required: false });
  const classroomId = toInt(req.query.classroomId, 'ชั้นเรียน', { required: false });
  const search = String(req.query.search || '').trim();

  if (teacherId) add('e.classroom_teacher_id = ?', teacherId);
  if (semesterId) add('e.semester_id = ?', semesterId);
  if (yearId) add('e.academic_year_id = ?', yearId);
  if (classroomId) add('e.classroom_id = ?', classroomId);
  if (search) {
    // ILIKE เพราะ LIKE ของ Postgres สนใจตัวพิมพ์เล็กใหญ่
    params.push(likeValue(search));
    const p = `$${params.length}`;
    where.push(`(t.full_name ILIKE ${p} OR v.full_name ILIKE ${p} OR c.name ILIKE ${p} OR e.reference_number ILIKE ${p})`);
  }

  const whereSql = where.join(' AND ');
  const sortCol = SORTABLE[req.query.sortBy] || 'e.created_at';
  const sortDir = String(req.query.sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const totalRow = await one(
    `SELECT COUNT(*)::int AS c FROM evaluations e
     JOIN classroom_teachers t ON t.id = e.classroom_teacher_id
     JOIN visitors v ON v.id = e.visitor_id
     JOIN classrooms c ON c.id = e.classroom_id
     WHERE ${whereSql}`,
    params
  );

  const rows = await query(
    `${DETAIL_SELECT} WHERE ${whereSql} ORDER BY ${sortCol} ${sortDir}, e.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset]
  );

  const ids = rows.map((r) => r.id);
  const imageCounts = new Map();
  if (ids.length) {
    const counts = await query(
      `SELECT evaluation_id AS id, COUNT(*)::int AS c FROM evaluation_images
       WHERE evaluation_id = ANY($1::int[]) GROUP BY evaluation_id`,
      [ids]
    );
    counts.forEach((r) => imageCounts.set(r.id, r.c));
  }

  res.json({
    ok: true,
    meta: { page, pageSize, total: totalRow.c, totalPages: Math.max(1, Math.ceil(totalRow.c / pageSize)) },
    data: mapRows(rows).map((r) => ({ ...r, imageCount: imageCounts.get(r.id) || 0 })),
  });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toInt(req.params.id, 'รหัสผลการประเมิน');
  res.json({ ok: true, data: await getEvaluation(id) });
}));

router.delete('/:id', wrap(async (req, res) => {
  const id = toInt(req.params.id, 'รหัสผลการประเมิน');
  const result = await deleteEvaluation(id);
  res.json({ ok: true, message: 'ลบผลการเยี่ยมชั้นเรียนเรียบร้อยแล้ว', data: result });
}));

module.exports = router;
