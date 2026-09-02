'use strict';
/** API สาธารณะ: ข้อมูลตั้งค่าโรงเรียน, ตัวเลือกในฟอร์ม และการบันทึกผลการเยี่ยมชั้นเรียน */
const express = require('express');
const { query, getSettings } = require('../lib/db');
const { wrap } = require('../lib/http');
const { mapRows } = require('../lib/rows');
const { createEvaluation, COMMENT_MIN } = require('../lib/evaluations');
const { uploadImages, MAX_FILE_SIZE, MAX_FILES } = require('../lib/uploads');
const { EDUCATION_LEVELS, SUBJECT_REQUIRED_LEVEL, PRACTICE_OPTIONS } = require('../lib/constants');
const { rateLimit } = require('../lib/ratelimit');

const router = express.Router();

/** ข้อมูลโรงเรียนสำหรับ Header/Footer — ไม่ส่ง PIN หรือ hash ออกไปเด็ดขาด */
router.get('/settings', wrap(async (_req, res) => {
  const s = await getSettings();
  res.json({
    ok: true,
    data: {
      schoolName: s.school_name,
      affiliationName: s.affiliation_name,
      schoolLogo: s.school_logo,
      requireImages: !!s.require_images,
      pinConfigured: !!s.admin_pin_hash,
      commentMinLength: COMMENT_MIN,
      maxFileSize: MAX_FILE_SIZE,
      maxFiles: MAX_FILES,
    },
  });
}));

const activeList = (table, order) =>
  query(`SELECT * FROM ${table} WHERE deleted_at IS NULL AND status = 1 ORDER BY ${order}`);

/** ตัวเลือกทั้งหมดของฟอร์ม (โหลดจากฐานข้อมูลจริง) */
router.get('/form-data', wrap(async (_req, res) => {
  // ตัวชี้วัดพร้อมหัวข้อกลุ่ม เรียงตามกลุ่มแล้วตามลำดับภายในกลุ่ม (ไม่มีกลุ่มจะไปอยู่ท้ายสุด)
  const indicators = await query(
    `SELECT i.*, g.id AS group_id, g.name AS group_name, g.sort_order AS group_sort
     FROM indicators i
     LEFT JOIN indicator_groups g ON g.id = i.group_id AND g.deleted_at IS NULL AND g.status = 1
     WHERE i.deleted_at IS NULL AND i.status = 1
     ORDER BY (g.sort_order IS NULL), g.sort_order ASC, i.sort_order ASC, i.id ASC`
  );

  const [semesters, academicYears, classroomTeachers, visitors, classrooms, learningAreas, indicatorGroups] =
    await Promise.all([
      activeList('semesters', 'id ASC'),
      activeList('academic_years', 'name DESC'),
      activeList('classroom_teachers', 'full_name ASC'),
      activeList('visitors', 'full_name ASC'),
      activeList('classrooms', 'sort_order ASC, id ASC'),
      activeList('learning_areas', 'id ASC'),
      activeList('indicator_groups', 'sort_order ASC, id ASC'),
    ]);

  res.json({
    ok: true,
    data: {
      semesters: mapRows(semesters),
      academicYears: mapRows(academicYears),
      classroomTeachers: mapRows(classroomTeachers),
      visitors: mapRows(visitors),
      classrooms: mapRows(classrooms),
      learningAreas: mapRows(learningAreas),
      indicatorGroups: mapRows(indicatorGroups),
      indicators: mapRows(indicators),
      educationLevels: EDUCATION_LEVELS,
      subjectRequiredLevel: SUBJECT_REQUIRED_LEVEL,
      practiceOptions: PRACTICE_OPTIONS,
    },
  });
}));

/** บันทึกผลการเยี่ยมชั้นเรียน (multipart: ฟิลด์ข้อความ + images[]) */
// จำกัดไม่เกิน 20 ครั้งต่อ 10 นาทีต่อ IP — พอสำหรับการใช้งานจริง แต่กันการยิงข้อมูลขยะ
const submitLimit = rateLimit({
  key: 'evaluations',
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'บันทึกผลการประเมินถี่เกินไป กรุณารอสักครู่',
});

router.post('/evaluations', submitLimit, (req, res, next) => {
  uploadImages(req, res, async (err) => {
    if (err) return next(err);
    try {
      const result = await createEvaluation(req.body || {}, req.files || []);
      res.status(201).json({
        ok: true,
        message: 'บันทึกผลการเยี่ยมชั้นเรียนเรียบร้อยแล้ว',
        data: result,
      });
    } catch (e) {
      next(e);
    }
  });
});

module.exports = router;
