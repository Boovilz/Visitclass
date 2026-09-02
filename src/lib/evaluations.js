'use strict';
/** Business logic ของการบันทึก/อ่านผลการเยี่ยมชั้นเรียน */
const { query, one, run, transaction, getSettings, now } = require('./db');
const { calculate } = require('./scoring');
const { mapRow, mapRows } = require('./rows');
const { HttpError, bad, toInt, toDate, cleanMultiline, requiredText, optionalText } = require('./validate');
const { removeFile, storeFiles, USE_BLOB } = require('./uploads');
const { EDUCATION_LEVELS, SUBJECT_REQUIRED_LEVEL, PRACTICE_VALUES } = require('./constants');

const COMMENT_MIN = 10;
const COMMENT_MAX = 2000;

/** ตรวจว่า master record มีอยู่จริงและยังเปิดใช้งาน */
async function requireActive(table, id, label) {
  const row = await one(`SELECT * FROM ${table} WHERE id = $1 AND deleted_at IS NULL AND status = 1`, [id]);
  if (!row) throw bad(`${label}ที่เลือกไม่ถูกต้องหรือถูกปิดใช้งานแล้ว`);
  return row;
}

/** สร้างเลขอ้างอิงรูปแบบ CVYYYYMMDD-0001 (ไม่ซ้ำกันเสมอ) */
async function nextReferenceNumber(visitDate) {
  const prefix = `CV${String(visitDate).replace(/-/g, '')}`;
  const row = await one(
    'SELECT reference_number AS r FROM evaluations WHERE reference_number LIKE $1 ORDER BY reference_number DESC LIMIT 1',
    [`${prefix}-%`]
  );
  let seq = row ? parseInt(String(row.r).split('-')[1], 10) + 1 : 1;
  // กันกรณีแข่งกันบันทึกพร้อมกัน
  while (await one('SELECT 1 AS x FROM evaluations WHERE reference_number = $1', [`${prefix}-${String(seq).padStart(4, '0')}`])) {
    seq += 1;
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * บันทึกผลการประเมินใหม่ — คำนวณคะแนนทั้งหมดที่ฝั่ง server เท่านั้น
 * @param {object} body ข้อมูลจากฟอร์ม
 * @param {Array} files ไฟล์รูปที่ผ่าน multer แล้ว (memoryStorage)
 */
async function createEvaluation(body, files = []) {
  const settings = await getSettings();

  const semesterId = toInt(body.semesterId, 'ภาคเรียน');
  const academicYearId = toInt(body.academicYearId, 'ปีการศึกษา');
  const classroomTeacherId = toInt(body.classroomTeacherId, 'ผู้รับการเยี่ยมชั้นเรียน');
  const classroomId = toInt(body.classroomId, 'ชั้นเรียน');
  const visitorId = toInt(body.visitorId, 'ผู้เยี่ยมชั้นเรียน');
  const visitDate = toDate(body.visitDate, 'วันที่เยี่ยมชั้นเรียน');

  await requireActive('semesters', semesterId, 'ภาคเรียน');
  await requireActive('academic_years', academicYearId, 'ปีการศึกษา');
  await requireActive('classroom_teachers', classroomTeacherId, 'ผู้รับการเยี่ยมชั้นเรียน');
  await requireActive('classrooms', classroomId, 'ชั้นเรียน');
  await requireActive('visitors', visitorId, 'ผู้เยี่ยมชั้นเรียน');

  const comment = cleanMultiline(body.comment, COMMENT_MAX);
  if (comment.length < COMMENT_MIN) {
    throw bad(`กรุณากรอกข้อคิดเห็น/ข้อเสนอแนะ อย่างน้อย ${COMMENT_MIN} ตัวอักษร`, { field: 'comment' });
  }

  /* ---- ระดับการศึกษา และข้อมูลวิชา (บังคับเฉพาะระดับขั้นพื้นฐาน) ---- */
  const educationLevel = optionalText(body.educationLevel, 40);
  if (!EDUCATION_LEVELS.includes(educationLevel)) {
    throw bad('กรุณาเลือกระดับการศึกษา', { field: 'educationLevel' });
  }

  let subjectName = null;
  let subjectCode = null;
  let learningAreaId = null;
  let learningAreaSnapshot = null;

  if (educationLevel === SUBJECT_REQUIRED_LEVEL) {
    subjectName = requiredText(body.subjectName, 'วิชา', { min: 1, max: 150 });
    subjectCode = requiredText(body.subjectCode, 'รหัสวิชา', { min: 1, max: 40 });
    learningAreaId = toInt(body.learningAreaId, 'กลุ่มสาระการเรียนรู้');
    learningAreaSnapshot = (await requireActive('learning_areas', learningAreaId, 'กลุ่มสาระการเรียนรู้')).name;
  }

  // ตัวชี้วัดที่เปิดใช้งาน ณ เวลาที่บันทึก (เรียงตามกลุ่ม แล้วตามลำดับในกลุ่ม)
  const indicators = await query(
    `SELECT i.*, g.name AS group_name, g.sort_order AS group_sort
     FROM indicators i
     LEFT JOIN indicator_groups g ON g.id = i.group_id AND g.deleted_at IS NULL AND g.status = 1
     WHERE i.deleted_at IS NULL AND i.status = 1
     ORDER BY (g.sort_order IS NULL), g.sort_order ASC, i.sort_order ASC, i.id ASC`
  );
  if (!indicators.length) throw bad('ยังไม่มีรายการตัวชี้วัดในระบบ กรุณาติดต่อผู้ดูแลระบบ');

  let submitted;
  try {
    submitted = typeof body.scores === 'string' ? JSON.parse(body.scores) : body.scores;
  } catch {
    throw bad('รูปแบบข้อมูลคะแนนไม่ถูกต้อง');
  }
  if (!Array.isArray(submitted)) throw bad('รูปแบบข้อมูลคะแนนไม่ถูกต้อง');

  const byId = new Map(submitted.map((s) => [Number(s.indicatorId), s]));
  const rows = indicators.map((ind) => {
    const entry = byId.get(ind.id) || {};
    const score = Number(entry.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw bad(`กรุณาให้คะแนนรายการตัวชี้วัดให้ครบทุกข้อ (ข้อ "${ind.indicator_name}" ยังไม่ได้เลือกคะแนน)`, {
        field: 'scores',
        indicatorId: ind.id,
      });
    }
    const practice = entry.practice == null ? '' : String(entry.practice);
    if (!PRACTICE_VALUES.includes(practice)) {
      throw bad(`กรุณาเลือกการดำเนินการให้ครบทุกข้อ (ข้อ "${ind.indicator_name}" ยังไม่ได้เลือก)`, {
        field: 'practice',
        indicatorId: ind.id,
      });
    }
    return { indicator: ind, score, practice };
  });

  const summary = calculate(rows.map((r) => r.score));

  // ถ้าระบบยังอัปโหลดรูปไม่ได้ ก็ไม่ควรบังคับให้แนบ ไม่งั้นจะบันทึกอะไรไม่ได้เลย
  const uploadsAvailable = USE_BLOB || !process.env.VERCEL;
  if (settings.require_images && uploadsAvailable && files.length === 0) {
    throw bad('ผู้ดูแลระบบกำหนดให้ต้องแนบรูปภาพการเยี่ยมชั้นเรียนอย่างน้อย 1 รูป', { field: 'images' });
  }

  // อัปโหลดรูปก่อนเปิด transaction เพราะเป็นงานภายนอกฐานข้อมูลและใช้เวลานาน
  const stored = await storeFiles(files);

  const ts = now();
  const referenceNumber = await nextReferenceNumber(visitDate);

  try {
    const evaluationId = await transaction(async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO evaluations
         (reference_number, semester_id, academic_year_id, classroom_teacher_id, classroom_id, visit_date, visitor_id,
          education_level, subject_name, subject_code, learning_area_id, learning_area_snapshot,
          total_score, maximum_score, percentage, quality_level, comment, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING id`,
        [
          referenceNumber, semesterId, academicYearId, classroomTeacherId, classroomId, visitDate, visitorId,
          educationLevel, subjectName, subjectCode, learningAreaId, learningAreaSnapshot,
          summary.totalScore, summary.maximumScore, summary.percentage, summary.qualityLevel, comment, ts, ts,
        ]
      );
      const id = inserted.rows[0].id;

      // เก็บ snapshot ชื่อตัวชี้วัดและหัวข้อกลุ่ม เพื่อให้รายงานเดิมถูกต้องแม้ข้อมูลถูกแก้ไขภายหลัง
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        await tx.query(
          `INSERT INTO evaluation_scores
           (evaluation_id, indicator_id, indicator_snapshot, sort_order_snapshot, score, practice, group_snapshot, group_sort_snapshot)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            id, r.indicator.id, r.indicator.indicator_name, r.indicator.sort_order || i + 1,
            r.score, r.practice, r.indicator.group_name || null,
            r.indicator.group_sort == null ? 9999 : r.indicator.group_sort,
          ]
        );
      }

      for (const f of stored) {
        await tx.query(
          'INSERT INTO evaluation_images (evaluation_id, image_url, file_name, created_at) VALUES ($1,$2,$3,$4)',
          [id, f.url, f.fileName, ts]
        );
      }

      return id;
    });

    return { id: evaluationId, referenceNumber, ...summary, imageCount: stored.length };
  } catch (err) {
    // บันทึกฐานข้อมูลล้มเหลว — เก็บกวาดรูปที่อัปโหลดไปแล้วเพื่อไม่ให้เหลือขยะ
    await Promise.all(stored.map((f) => removeFile(f.url)));
    throw err;
  }
}

const DETAIL_SELECT = `
  SELECT e.*, s.name AS semester_name, y.name AS academic_year_name,
         t.full_name AS teacher_name, t.position AS teacher_position,
         c.name AS classroom_name,
         v.full_name AS visitor_name, v.position AS visitor_position
  FROM evaluations e
  JOIN semesters s ON s.id = e.semester_id
  JOIN academic_years y ON y.id = e.academic_year_id
  JOIN classroom_teachers t ON t.id = e.classroom_teacher_id
  JOIN classrooms c ON c.id = e.classroom_id
  JOIN visitors v ON v.id = e.visitor_id`;

async function getEvaluation(id) {
  const row = await one(`${DETAIL_SELECT} WHERE e.id = $1`, [id]);
  if (!row) throw new HttpError(404, 'ไม่พบผลการเยี่ยมชั้นเรียนที่ต้องการ');

  // ครั้งที่เท่าใดของผู้รับการเยี่ยมคนนี้ ในชั้นเรียน/ภาคเรียน/ปีการศึกษาเดียวกัน (ใช้ในหัวเอกสารพิมพ์)
  const roundRow = await one(
    `SELECT COUNT(*)::int AS c FROM evaluations
     WHERE classroom_teacher_id = $1 AND classroom_id = $2 AND semester_id = $3 AND academic_year_id = $4
       AND (visit_date < $5 OR (visit_date = $5 AND id <= $6))`,
    [row.classroom_teacher_id, row.classroom_id, row.semester_id, row.academic_year_id, row.visit_date, id]
  );

  const scores = await query(
    `SELECT * FROM evaluation_scores WHERE evaluation_id = $1
     ORDER BY COALESCE(group_sort_snapshot, 9999) ASC, sort_order_snapshot ASC, id ASC`,
    [id]
  );
  const images = await query('SELECT * FROM evaluation_images WHERE evaluation_id = $1 ORDER BY id ASC', [id]);

  return { ...mapRow(row), visitRound: roundRow.c, scores: mapRows(scores), images: mapRows(images) };
}

/** ลบผลการประเมิน พร้อมคะแนนและไฟล์รูปที่เกี่ยวข้อง */
async function deleteEvaluation(id) {
  const row = await one('SELECT id FROM evaluations WHERE id = $1', [id]);
  if (!row) throw new HttpError(404, 'ไม่พบผลการเยี่ยมชั้นเรียนที่ต้องการลบ');

  const images = await query('SELECT image_url FROM evaluation_images WHERE evaluation_id = $1', [id]);

  await transaction(async (tx) => {
    await tx.query('DELETE FROM evaluation_images WHERE evaluation_id = $1', [id]);
    await tx.query('DELETE FROM evaluation_scores WHERE evaluation_id = $1', [id]);
    await tx.query('DELETE FROM evaluations WHERE id = $1', [id]);
  });

  // ลบไฟล์จริงหลังฐานข้อมูลสำเร็จแล้ว
  await Promise.all(images.map((i) => removeFile(i.image_url)));
  return { id, deletedImages: images.length };
}

module.exports = { createEvaluation, getEvaluation, deleteEvaluation, DETAIL_SELECT, COMMENT_MIN, COMMENT_MAX };
