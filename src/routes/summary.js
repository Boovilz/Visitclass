'use strict';
/**
 * สรุปผลการเยี่ยมชั้นเรียน — จัดกลุ่มตาม ผู้รับการเยี่ยม + ชั้นเรียน + ภาคเรียน + ปีการศึกษา
 * ถ้าผู้รับการเยี่ยมคนเดียวกันถูกประเมินโดยผู้เยี่ยมหลายคน จะคำนวณเป็นค่าเฉลี่ยของทุกคน
 */
const express = require('express');
const { query, one } = require('../lib/db');
const { wrap } = require('../lib/http');
const { mapRows } = require('../lib/rows');
const { toInt, HttpError } = require('../lib/validate');
const { qualityLevel, round2, average } = require('../lib/scoring');
const { deleteEvaluation } = require('../lib/evaluations');

const router = express.Router();

function requireScope(q) {
  return {
    semesterId: toInt(q.semesterId, 'ภาคเรียน'),
    academicYearId: toInt(q.academicYearId, 'ปีการศึกษา'),
  };
}

/* ---------------- รายการสรุปแบบกลุ่ม ---------------- */
router.get('/', wrap(async (req, res) => {
  const { semesterId, academicYearId } = requireScope(req.query);

  // cast ::float8 / ::int ทุกจุด เพราะ Postgres คืน AVG/COUNT เป็น string
  const rows = await query(
    `SELECT e.classroom_teacher_id, t.full_name AS teacher_name, t.position AS teacher_position,
            e.classroom_id, c.name AS classroom_name, c.sort_order AS classroom_sort,
            COUNT(*)::int AS visit_count,
            AVG(e.total_score)::float8 AS avg_total_score,
            AVG(e.maximum_score)::float8 AS avg_maximum_score,
            AVG(e.percentage)::float8 AS avg_percentage,
            MAX(e.education_level) AS education_level,
            MIN(e.visit_date) AS first_visit,
            MAX(e.visit_date) AS last_visit
     FROM evaluations e
     JOIN classroom_teachers t ON t.id = e.classroom_teacher_id
     JOIN classrooms c ON c.id = e.classroom_id
     WHERE e.semester_id = $1 AND e.academic_year_id = $2
     GROUP BY e.classroom_teacher_id, t.full_name, t.position, e.classroom_id, c.name, c.sort_order
     ORDER BY c.sort_order ASC, t.full_name ASC`,
    [semesterId, academicYearId]
  );

  const semester = await one('SELECT name FROM semesters WHERE id = $1', [semesterId]);
  const year = await one('SELECT name FROM academic_years WHERE id = $1', [academicYearId]);

  const data = rows.map((r) => {
    const avgPercentage = round2(r.avg_percentage);
    return {
      classroomTeacherId: r.classroom_teacher_id,
      teacherName: r.teacher_name,
      teacherPosition: r.teacher_position,
      classroomId: r.classroom_id,
      classroomName: r.classroom_name,
      educationLevel: r.education_level || '',
      visitCount: r.visit_count,
      averageTotalScore: round2(r.avg_total_score),
      averageMaximumScore: round2(r.avg_maximum_score),
      averagePercentage: avgPercentage,
      qualityLevel: qualityLevel(avgPercentage),
      firstVisit: r.first_visit,
      lastVisit: r.last_visit,
    };
  });

  res.json({
    ok: true,
    data,
    meta: {
      semesterName: (semester && semester.name) || '',
      academicYearName: (year && year.name) || '',
      semesterId, academicYearId, total: data.length,
    },
  });
}));

/* ---------------- รายละเอียดของกลุ่ม ---------------- */
router.get('/detail', wrap(async (req, res) => {
  const { semesterId, academicYearId } = requireScope(req.query);
  const classroomTeacherId = toInt(req.query.classroomTeacherId, 'ผู้รับการเยี่ยมชั้นเรียน');
  const classroomId = toInt(req.query.classroomId, 'ชั้นเรียน');

  const evaluations = await query(
    `SELECT e.*, v.full_name AS visitor_name, v.position AS visitor_position,
            t.full_name AS teacher_name, t.position AS teacher_position,
            c.name AS classroom_name, s.name AS semester_name, y.name AS academic_year_name
     FROM evaluations e
     JOIN visitors v ON v.id = e.visitor_id
     JOIN classroom_teachers t ON t.id = e.classroom_teacher_id
     JOIN classrooms c ON c.id = e.classroom_id
     JOIN semesters s ON s.id = e.semester_id
     JOIN academic_years y ON y.id = e.academic_year_id
     WHERE e.semester_id = $1 AND e.academic_year_id = $2 AND e.classroom_teacher_id = $3 AND e.classroom_id = $4
     ORDER BY e.visit_date ASC, e.id ASC`,
    [semesterId, academicYearId, classroomTeacherId, classroomId]
  );

  if (!evaluations.length) throw new HttpError(404, 'ไม่พบข้อมูลสรุปผลการเยี่ยมชั้นเรียนตามเงื่อนไขที่เลือก');

  const ids = evaluations.map((e) => e.id);
  const scoreRows = await query(
    `SELECT * FROM evaluation_scores WHERE evaluation_id = ANY($1::int[])
     ORDER BY COALESCE(group_sort_snapshot, 9999) ASC, sort_order_snapshot ASC, id ASC`,
    [ids]
  );
  const imageRows = await query(
    'SELECT * FROM evaluation_images WHERE evaluation_id = ANY($1::int[]) ORDER BY id ASC',
    [ids]
  );

  // สร้างตารางเปรียบเทียบคะแนนรายตัวชี้วัดของผู้เยี่ยมแต่ละคน
  const indicatorMap = new Map();
  for (const row of scoreRows) {
    if (!indicatorMap.has(row.indicator_id)) {
      indicatorMap.set(row.indicator_id, {
        indicatorId: row.indicator_id,
        indicatorName: row.indicator_snapshot,
        sortOrder: row.sort_order_snapshot,
        groupName: row.group_snapshot || null,
        groupSort: row.group_sort_snapshot == null ? 9999 : row.group_sort_snapshot,
        scores: {},
        practices: {},
      });
    }
    const entry = indicatorMap.get(row.indicator_id);
    entry.indicatorName = row.indicator_snapshot; // ใช้ snapshot ล่าสุดของกลุ่มนี้
    entry.groupName = row.group_snapshot || entry.groupName;
    entry.scores[row.evaluation_id] = row.score;
    entry.practices[row.evaluation_id] = row.practice || null;
  }

  const indicators = [...indicatorMap.values()]
    .sort((a, b) => a.groupSort - b.groupSort || a.sortOrder - b.sortOrder || a.indicatorId - b.indicatorId)
    .map((item) => {
      const values = ids.map((id) => item.scores[id]).filter((v) => Number.isFinite(v));
      const avg = average(values);
      return {
        ...item,
        averageScore: avg,
        percentage: round2((avg / 5) * 100),
        qualityLevel: qualityLevel((avg / 5) * 100),
      };
    });

  const averagePercentage = average(evaluations.map((e) => e.percentage));
  const summary = {
    visitCount: evaluations.length,
    averageTotalScore: average(evaluations.map((e) => e.total_score)),
    averageMaximumScore: average(evaluations.map((e) => e.maximum_score)),
    averagePercentage,
    qualityLevel: qualityLevel(averagePercentage),
  };

  const head = evaluations[0];
  res.json({
    ok: true,
    data: {
      scope: {
        semesterId, academicYearId, classroomTeacherId, classroomId,
        semesterName: head.semester_name,
        academicYearName: head.academic_year_name,
        teacherName: head.teacher_name,
        teacherPosition: head.teacher_position,
        classroomName: head.classroom_name,
        educationLevel: head.education_level || '',
        subjectName: head.subject_name || '',
        subjectCode: head.subject_code || '',
        learningArea: head.learning_area_snapshot || '',
      },
      summary,
      evaluations: mapRows(evaluations).map((e) => ({
        id: e.id,
        referenceNumber: e.referenceNumber,
        visitDate: e.visitDate,
        visitorName: e.visitorName,
        visitorPosition: e.visitorPosition,
        totalScore: e.totalScore,
        maximumScore: e.maximumScore,
        percentage: e.percentage,
        qualityLevel: e.qualityLevel,
        comment: e.comment,
        educationLevel: e.educationLevel || '',
        subjectName: e.subjectName || '',
        subjectCode: e.subjectCode || '',
        learningArea: e.learningAreaSnapshot || '',
      })),
      indicators,
      images: mapRows(imageRows).map((img) => {
        const ev = evaluations.find((e) => e.id === img.evaluationId);
        return {
          ...img,
          visitorName: ev ? ev.visitor_name : '',
          visitDate: ev ? ev.visit_date : '',
          referenceNumber: ev ? ev.reference_number : '',
        };
      }),
    },
  });
}));

/* ---------------- ลบข้อมูลทั้งกลุ่ม (ลบผลการประเมินต้นทางทุกครั้งของกลุ่มนั้น) ---------------- */
router.delete('/group', wrap(async (req, res) => {
  const { semesterId, academicYearId } = requireScope(req.query);
  const classroomTeacherId = toInt(req.query.classroomTeacherId, 'ผู้รับการเยี่ยมชั้นเรียน');
  const classroomId = toInt(req.query.classroomId, 'ชั้นเรียน');

  const rows = await query(
    `SELECT id FROM evaluations
     WHERE semester_id = $1 AND academic_year_id = $2 AND classroom_teacher_id = $3 AND classroom_id = $4`,
    [semesterId, academicYearId, classroomTeacherId, classroomId]
  );

  if (!rows.length) throw new HttpError(404, 'ไม่พบข้อมูลที่ต้องการลบ');
  for (const r of rows) await deleteEvaluation(r.id);

  res.json({
    ok: true,
    message: `ลบข้อมูลการเยี่ยมชั้นเรียนของกลุ่มนี้แล้ว จำนวน ${rows.length} รายการ`,
    data: { deleted: rows.length },
  });
}));

module.exports = router;
