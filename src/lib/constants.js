'use strict';
/** ค่าคงที่ที่ใช้ร่วมกันทั้ง backend และ frontend (frontend มีสำเนาใน core.js) */

/** ระดับการศึกษาของชั้นเรียนที่รับการเยี่ยม */
const EDUCATION_LEVELS = ['ปฐมวัย', 'ขั้นพื้นฐาน'];

/** ระดับการศึกษาที่ต้องระบุวิชา/รหัสวิชา/กลุ่มสาระการเรียนรู้ */
const SUBJECT_REQUIRED_LEVEL = 'ขั้นพื้นฐาน';

/** สถานะการดำเนินการของแต่ละตัวชี้วัด */
const PRACTICE_OPTIONS = [
  { value: 'done', label: 'ปฏิบัติแล้ว' },
  { value: 'doing', label: 'กำลังปฏิบัติ' },
  { value: 'not_yet', label: 'ยังไม่ปฏิบัติ' },
];

const PRACTICE_VALUES = PRACTICE_OPTIONS.map((p) => p.value);
const practiceLabel = (value) => (PRACTICE_OPTIONS.find((p) => p.value === value) || {}).label || '';

module.exports = { EDUCATION_LEVELS, SUBJECT_REQUIRED_LEVEL, PRACTICE_OPTIONS, PRACTICE_VALUES, practiceLabel };
