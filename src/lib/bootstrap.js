'use strict';
/**
 * เตรียมข้อมูลตั้งต้นให้อัตโนมัติเมื่อเปิดระบบครั้งแรกบนเซิร์ฟเวอร์ใหม่
 * ใส่เฉพาะข้อมูลที่ทุกโรงเรียนใช้เหมือนกัน — ไม่มีรายชื่อครูหรือผลประเมินตัวอย่าง
 * (ผู้ดูแลกรอกรายชื่อครู/ผู้เยี่ยมเองที่หน้าผู้ดูแลระบบ)
 */
const { query, one, run, transaction, getSettings, now } = require('./db');

const LEARNING_AREAS = [
  'ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์และเทคโนโลยี', 'สังคมศึกษา ศาสนา และวัฒนธรรม',
  'สุขศึกษาและพลศึกษา', 'ศิลปะ', 'การงานอาชีพ', 'ภาษาต่างประเทศ',
];

const INDICATOR_GROUPS = [
  ['สภาพแวดล้อมและความปลอดภัยในห้องเรียน', 1],
  ['การจัดแสดงและสื่อการเรียนรู้', 2],
  ['การดูแลช่วยเหลือผู้เรียนและการปฏิบัติหน้าที่', 3],
];

const INDICATORS = [
  [1, 'มีความสะอาด เป็นระเบียบ และถูกสุขลักษณะภายในห้องเรียน'],
  [1, 'มีการจัดสภาพแวดล้อมห้องเรียนให้น่าดู น่าอยู่ และเอื้อต่อการเรียนรู้'],
  [1, 'มีความมั่นคง ปลอดภัย และอุปกรณ์ภายในห้องเรียนสามารถใช้งานได้ตามปกติ'],
  [2, 'มีการจัดแสดงสาระการเรียนรู้ครบทุกกลุ่มสาระการเรียนรู้'],
  [2, 'มีมุมวิชาการหรือมุมส่งเสริมการอ่านภายในห้องเรียน'],
  [2, 'มีป้ายชั้นเรียน ป้ายครูประจำชั้น และข้อมูลสมาชิกภายในห้องเรียนครบถ้วน'],
  [2, 'มีการจัดเก็บผลงานนักเรียนและแสดงผลงานอย่างเหมาะสม'],
  [3, 'มีสื่อ อุปกรณ์ และเทคโนโลยีที่ส่งเสริมการจัดการเรียนรู้'],
  [3, 'มีการดูแลช่วยเหลือนักเรียนและบันทึกข้อมูลนักเรียนเป็นรายบุคคล'],
  [3, 'ครูประจำชั้นปฏิบัติหน้าที่ในห้องเรียนอย่างสม่ำเสมอและตรงเวลา'],
];

const CLASSROOMS = [
  'อนุบาล 1', 'อนุบาล 2', 'อนุบาล 3',
  'ประถมศึกษาปีที่ 1', 'ประถมศึกษาปีที่ 2', 'ประถมศึกษาปีที่ 3',
  'ประถมศึกษาปีที่ 4', 'ประถมศึกษาปีที่ 5', 'ประถมศึกษาปีที่ 6',
];

/** ปีการศึกษาปัจจุบันแบบ พ.ศ. และปีถัดไป */
function academicYears() {
  const be = new Date().getFullYear() + 543;
  return [String(be), String(be + 1)];
}

async function bootstrapIfEmpty() {
  const existing = await one('SELECT COUNT(*)::int AS c FROM indicators');
  if (existing.c > 0) return false;

  const ts = now();

  await transaction(async (tx) => {
    const insert = async (table, cols, rows) => {
      for (const r of rows) {
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
        const tsIdx = cols.length + 1;
        await tx.query(
          `INSERT INTO ${table} (${cols.join(',')}, status, created_at, updated_at)
           VALUES (${placeholders}, 1, $${tsIdx}, $${tsIdx})`,
          [...r, ts]
        );
      }
    };

    await insert('semesters', ['name'], [['ภาคเรียนที่ 1'], ['ภาคเรียนที่ 2']]);
    await insert('academic_years', ['name'], academicYears().map((y) => [y]));
    await insert('classrooms', ['name', 'sort_order'], CLASSROOMS.map((n, i) => [n, i + 1]));
    await insert('learning_areas', ['name'], LEARNING_AREAS.map((n) => [n]));
    await insert('indicator_groups', ['name', 'sort_order'], INDICATOR_GROUPS);

    // จับคู่ตัวชี้วัดกับหัวข้อกลุ่มที่เพิ่งสร้าง
    const groups = (await tx.query('SELECT id, sort_order FROM indicator_groups ORDER BY sort_order')).rows;
    const counters = {};
    for (const [groupOrder, name] of INDICATORS) {
      const g = groups.find((x) => x.sort_order === groupOrder);
      counters[groupOrder] = (counters[groupOrder] || 0) + 1;
      await tx.query(
        `INSERT INTO indicators (indicator_name, group_id, sort_order, status, created_at, updated_at)
         VALUES ($1,$2,$3,1,$4,$4)`,
        [name, g ? g.id : null, counters[groupOrder], ts]
      );
    }
  });

  // ตั้ง PIN เริ่มต้นจากตัวแปรสภาพแวดล้อม (ถ้าไม่ได้ตั้งจะใช้ 2468 และเตือนให้เปลี่ยน)
  const settings = await getSettings();
  if (!settings.admin_pin_hash) {
    const { setPin } = require('./auth');
    const pin = /^d{4}$/.test(process.env.SEED_PIN || '') ? process.env.SEED_PIN : '2468';
    await setPin(pin);
    if (pin === '2468') {
      console.warn('  คำเตือน: ใช้ PIN เริ่มต้น 2468 — กรุณาเปลี่ยนที่เมนู "ตั้งค่าระบบ" ทันที');
    }
  }

  console.log('  เตรียมข้อมูลตั้งต้นให้อัตโนมัติแล้ว (ภาคเรียน ปีการศึกษา ชั้นเรียน กลุ่มสาระ และตัวชี้วัด)');
  console.log('  ขั้นตอนถัดไป: เข้าหน้าผู้ดูแล → เพิ่มรายชื่อครูและผู้เยี่ยมชั้นเรียน');
  return true;
}

module.exports = { bootstrapIfEmpty };
