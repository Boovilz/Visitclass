'use strict';
/**
 * สร้างข้อมูลตัวอย่างสำหรับทดสอบระบบ (ครู ผู้เยี่ยม และผลการประเมิน)
 * ข้อมูลพื้นฐานที่ทุกโรงเรียนใช้เหมือนกันถูกสร้างอัตโนมัติโดย src/lib/bootstrap.js อยู่แล้ว
 *
 * ใช้งาน:  node scripts/seed.js          เพิ่มข้อมูลตัวอย่าง (ข้ามถ้ามีอยู่แล้ว)
 *          node scripts/seed.js --reset  ล้างผลการประเมินและรายชื่อทั้งหมดก่อนสร้างใหม่
 */
const { query, one, run, transaction, migrate, now } = require('../src/lib/db');
const { bootstrapIfEmpty } = require('../src/lib/bootstrap');
const { setPin } = require('../src/lib/auth');
const { calculate } = require('../src/lib/scoring');

const RESET = process.argv.includes('--reset');
const DEFAULT_PIN = process.env.SEED_PIN || '2468';
const ts = now();

const TEACHERS = [
  ['นางสาวศิริพร ใจดี', 'ครูชำนาญการ'],
  ['นายวิทยา ใจดี', 'ครูชำนาญการพิเศษ'],
  ['นางสาววิราพร รัตนมณี', 'ครู คศ.1'],
  ['นางสมหญิง เรืองวิทย์', 'ครูชำนาญการ'],
  ['นายอนุชา พงษ์ไพบูลย์', 'ครูผู้ช่วย'],
  ['นางสาวกนกวรรณ สุขสวัสดิ์', 'ครู คศ.1'],
  ['นายธนกฤต บุญมาก', 'ครูชำนาญการ'],
  ['นางพรทิพย์ ศรีสุวรรณ', 'ครูชำนาญการพิเศษ'],
];

const VISITORS = [
  ['นายสมชาย ผู้บริหาร', 'ผู้อำนวยการโรงเรียน'],
  ['นางสาวปิยะนุช วงศ์คำ', 'รองผู้อำนวยการโรงเรียน'],
  ['นายประเสริฐ มั่นคง', 'หัวหน้าฝ่ายวิชาการ'],
  ['นางสาวจันทร์เพ็ญ ทองดี', 'หัวหน้าระดับสายชั้น'],
];

const COMMENTS = [
  'ห้องเรียนสะอาด เป็นระเบียบเรียบร้อย ครูจัดมุมส่งเสริมการอ่านได้น่าสนใจ ควรเพิ่มการจัดแสดงผลงานนักเรียนให้หลากหลายและเปลี่ยนตามช่วงเวลามากขึ้น',
  'บรรยากาศในห้องเรียนเอื้อต่อการเรียนรู้ นักเรียนมีส่วนร่วมดี ขอชื่นชมการใช้สื่อเทคโนโลยีประกอบการสอน ควรตรวจสอบความปลอดภัยของอุปกรณ์ไฟฟ้าอย่างสม่ำเสมอ',
  'ครูดูแลเอาใจใส่นักเรียนเป็นรายบุคคลได้ดีมาก มีข้อมูลนักเรียนครบถ้วน ควรพัฒนามุมวิชาการให้ครอบคลุมทุกกลุ่มสาระการเรียนรู้เพิ่มเติม',
  'ห้องเรียนมีป้ายข้อมูลครบถ้วน ชัดเจน ควรปรับปรุงการจัดเก็บวัสดุอุปกรณ์ให้เป็นหมวดหมู่ และเพิ่มแสงสว่างบริเวณมุมอ่านหนังสือ',
  'โดยรวมอยู่ในระดับที่น่าพอใจ นักเรียนมีวินัยในการใช้ห้องเรียน ควรเพิ่มกิจกรรมส่งเสริมการอ่านและจัดหาหนังสือให้หลากหลายยิ่งขึ้น',
];

const PRACTICES = ['done', 'doing', 'not_yet'];

async function reset() {
  await run('DELETE FROM evaluation_images');
  await run('DELETE FROM evaluation_scores');
  await run('DELETE FROM evaluations');
  await run('DELETE FROM classroom_teachers');
  await run('DELETE FROM visitors');
}

async function insertPeople(table, rows) {
  for (const [fullName, position] of rows) {
    await run(
      `INSERT INTO ${table} (full_name, position, status, created_at, updated_at) VALUES ($1,$2,1,$3,$3)`,
      [fullName, position, ts]
    );
  }
}

async function seedSampleEvaluations() {
  const semesters = await query('SELECT * FROM semesters ORDER BY id');
  const years = await query('SELECT * FROM academic_years ORDER BY id');
  const teachers = await query('SELECT * FROM classroom_teachers ORDER BY id');
  const visitors = await query('SELECT * FROM visitors ORDER BY id');
  const classrooms = await query('SELECT * FROM classrooms ORDER BY sort_order');
  const learningAreas = await query('SELECT * FROM learning_areas ORDER BY id');
  const indicators = await query(
    `SELECT i.*, g.name AS group_name, g.sort_order AS group_sort
     FROM indicators i LEFT JOIN indicator_groups g ON g.id = i.group_id
     ORDER BY COALESCE(g.sort_order, 9999), i.sort_order`
  );

  const year = years[years.length - 1];

  // ค่าสุ่มแบบ deterministic เพื่อให้ข้อมูลตัวอย่างเหมือนกันทุกครั้ง
  let counter = 20690801;
  const pseudo = () => {
    counter = (counter * 1103515245 + 12345) % 2147483648;
    return counter / 2147483648;
  };

  const refSeq = {};
  let created = 0;

  for (let ti = 0; ti < teachers.length; ti += 1) {
    const teacher = teachers[ti];
    const classroom = classrooms[ti % classrooms.length];
    const semester = semesters[ti % semesters.length];
    const visitorSet = [visitors[ti % visitors.length], visitors[(ti + 1) % visitors.length]];

    for (let vi = 0; vi < visitorSet.length; vi += 1) {
      const visitor = visitorSet[vi];
      const day = Math.min(28, 3 + ti * 2 + vi);
      const month = semester.id === semesters[0].id ? 8 : 11;
      const visitDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const scores = indicators.map(() => {
        const r = pseudo();
        return r > 0.72 ? 5 : r > 0.42 ? 4 : r > 0.2 ? 3 : r > 0.08 ? 2 : 1;
      });
      const summary = calculate(scores);

      const key = visitDate.replace(/-/g, '');
      refSeq[key] = (refSeq[key] || 0) + 1;
      const reference = `CV${key}-${String(refSeq[key]).padStart(4, '0')}`;

      const isKindergarten = /อนุบาล/.test(classroom.name);
      const level = isKindergarten ? 'ปฐมวัย' : 'ขั้นพื้นฐาน';
      const area = isKindergarten ? null : learningAreas[ti % (learningAreas.length || 1)] || null;

      await transaction(async (tx) => {
        const inserted = await tx.query(
          `INSERT INTO evaluations
           (reference_number, semester_id, academic_year_id, classroom_teacher_id, classroom_id, visit_date, visitor_id,
            education_level, subject_name, subject_code, learning_area_id, learning_area_snapshot,
            total_score, maximum_score, percentage, quality_level, comment, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
           RETURNING id`,
          [
            reference, semester.id, year.id, teacher.id, classroom.id, visitDate, visitor.id,
            level,
            isKindergarten ? null : (area ? area.name : 'ภาษาไทย'),
            isKindergarten ? null : `ท1${String(ti + 1).padStart(2, '0')}01`,
            area ? area.id : null,
            area ? area.name : null,
            summary.totalScore, summary.maximumScore, summary.percentage, summary.qualityLevel,
            COMMENTS[(ti + vi) % COMMENTS.length], ts,
          ]
        );
        const evalId = inserted.rows[0].id;

        for (let i = 0; i < indicators.length; i += 1) {
          const ind = indicators[i];
          await tx.query(
            `INSERT INTO evaluation_scores
             (evaluation_id, indicator_id, indicator_snapshot, sort_order_snapshot, score, practice, group_snapshot, group_sort_snapshot)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              evalId, ind.id, ind.indicator_name, ind.sort_order, scores[i],
              PRACTICES[scores[i] >= 4 ? 0 : scores[i] === 3 ? 1 : 2],
              ind.group_name || null,
              ind.group_sort == null ? 9999 : ind.group_sort,
            ]
          );
        }
      });
      created += 1;
    }
  }
  return created;
}

async function main() {
  await migrate();
  await bootstrapIfEmpty();

  if (RESET) await reset();

  const existing = await one('SELECT COUNT(*)::int AS c FROM classroom_teachers');
  if (existing.c > 0 && !RESET) {
    console.log('พบข้อมูลในระบบอยู่แล้ว — ข้ามการสร้างข้อมูลตัวอย่าง (ใช้ --reset เพื่อล้างและสร้างใหม่)');
    return;
  }

  await setPin(DEFAULT_PIN);
  await insertPeople('classroom_teachers', TEACHERS);
  await insertPeople('visitors', VISITORS);
  const created = await seedSampleEvaluations();

  console.log('สร้างข้อมูลตัวอย่างเรียบร้อยแล้ว');
  console.log(`  - ครู ${TEACHERS.length} คน, ผู้เยี่ยม ${VISITORS.length} คน`);
  console.log(`  - ผลการเยี่ยมชั้นเรียนตัวอย่าง ${created} รายการ`);
  console.log(`  - PIN ผู้ดูแลระบบ: ${DEFAULT_PIN}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
