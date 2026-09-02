'use strict';
/** ข้อมูลภาพรวมสำหรับแดชบอร์ด (รองรับตัวกรองภาคเรียน/ปีการศึกษา) */
const express = require('express');
const { query, one } = require('../lib/db');
const { wrap } = require('../lib/http');
const { toInt } = require('../lib/validate');
const { QUALITY_LEVELS, round2 } = require('../lib/scoring');

const router = express.Router();

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

router.get('/', wrap(async (req, res) => {
  const semesterId = toInt(req.query.semesterId, 'ภาคเรียน', { required: false });
  const academicYearId = toInt(req.query.academicYearId, 'ปีการศึกษา', { required: false });

  const where = ['1 = 1'];
  const params = [];
  if (semesterId) { params.push(semesterId); where.push(`e.semester_id = $${params.length}`); }
  if (academicYearId) { params.push(academicYearId); where.push(`e.academic_year_id = $${params.length}`); }
  const whereSql = where.join(' AND ');

  // cast ::int / ::float8 ทุกจุด เพราะ Postgres คืน COUNT/AVG เป็น string
  const totals = await one(
    `SELECT COUNT(*)::int AS evaluations,
            COALESCE(AVG(e.percentage), 0)::float8 AS avg_percentage,
            COALESCE(AVG(e.total_score), 0)::float8 AS avg_total_score,
            COALESCE(AVG(e.maximum_score), 0)::float8 AS avg_maximum_score,
            COUNT(DISTINCT e.classroom_teacher_id)::int AS teachers_evaluated,
            COUNT(DISTINCT e.visitor_id)::int AS visitors_active
     FROM evaluations e WHERE ${whereSql}`,
    params
  );

  const counts = await one(
    `SELECT
       (SELECT COUNT(*)::int FROM classroom_teachers WHERE deleted_at IS NULL AND status = 1) AS classroom_teachers,
       (SELECT COUNT(*)::int FROM visitors           WHERE deleted_at IS NULL AND status = 1) AS visitors,
       (SELECT COUNT(*)::int FROM classrooms         WHERE deleted_at IS NULL AND status = 1) AS classrooms,
       (SELECT COUNT(*)::int FROM indicators         WHERE deleted_at IS NULL AND status = 1) AS indicators`
  );

  // กราฟ 1: จำนวนการเยี่ยมชั้นเรียนแยกตามเดือน
  const monthRows = await query(
    `SELECT substr(e.visit_date, 1, 7) AS ym, COUNT(*)::int AS c
     FROM evaluations e WHERE ${whereSql}
     GROUP BY substr(e.visit_date, 1, 7) ORDER BY 1 ASC`,
    params
  );
  const byMonth = monthRows.map((r) => {
    const [y, m] = r.ym.split('-');
    return { key: r.ym, label: `${THAI_MONTHS[Number(m) - 1]} ${Number(y) + 543 - 2500}`, count: r.c };
  });

  // กราฟ 2: จำนวนผลการประเมินแยกตามระดับคุณภาพ
  const levelRows = await query(
    `SELECT e.quality_level AS level, COUNT(*)::int AS c FROM evaluations e WHERE ${whereSql} GROUP BY e.quality_level`,
    params
  );
  const levelMap = new Map(levelRows.map((r) => [r.level, r.c]));
  const byQuality = QUALITY_LEVELS.map((l) => ({ label: l.label, count: levelMap.get(l.label) || 0 }));

  // กราฟ 3: ร้อยละเฉลี่ยแยกตามชั้นเรียน
  const classRows = await query(
    `SELECT c.name AS classroom, c.sort_order AS so, AVG(e.percentage)::float8 AS avg_pct, COUNT(*)::int AS c
     FROM evaluations e JOIN classrooms c ON c.id = e.classroom_id
     WHERE ${whereSql}
     GROUP BY e.classroom_id, c.name, c.sort_order ORDER BY c.sort_order ASC LIMIT 20`,
    params
  );
  const byClassroom = classRows.map((r) => ({ label: r.classroom, percentage: round2(r.avg_pct), count: r.c }));

  const recent = await query(
    `SELECT e.id, e.reference_number, e.visit_date, e.percentage, e.quality_level,
            t.full_name AS teacher_name, c.name AS classroom_name, v.full_name AS visitor_name
     FROM evaluations e
     JOIN classroom_teachers t ON t.id = e.classroom_teacher_id
     JOIN classrooms c ON c.id = e.classroom_id
     JOIN visitors v ON v.id = e.visitor_id
     WHERE ${whereSql} ORDER BY e.created_at DESC LIMIT 5`,
    params
  );

  res.json({
    ok: true,
    data: {
      summary: {
        totalEvaluations: totals.evaluations,
        averagePercentage: round2(totals.avg_percentage),
        averageTotalScore: round2(totals.avg_total_score),
        averageMaximumScore: round2(totals.avg_maximum_score),
        teachersEvaluated: totals.teachers_evaluated,
        visitorsActive: totals.visitors_active,
        classroomTeachers: counts.classroom_teachers,
        visitors: counts.visitors,
        classrooms: counts.classrooms,
        indicators: counts.indicators,
      },
      byMonth,
      byQuality,
      byClassroom,
      recent: recent.map((r) => ({
        id: r.id,
        referenceNumber: r.reference_number,
        visitDate: r.visit_date,
        percentage: r.percentage,
        qualityLevel: r.quality_level,
        teacherName: r.teacher_name,
        classroomName: r.classroom_name,
        visitorName: r.visitor_name,
      })),
    },
  });
}));

module.exports = router;
