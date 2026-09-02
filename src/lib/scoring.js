'use strict';
/** Single source of truth for score maths and quality levels (server-authoritative). */

const QUALITY_LEVELS = [
  { key: 'excellent', label: 'ดีมาก', min: 90, badge: 'badge-q1' },
  { key: 'good', label: 'ดี', min: 80, badge: 'badge-q2' },
  { key: 'fair', label: 'ปานกลาง', min: 70, badge: 'badge-q3' },
  { key: 'pass', label: 'พอใช้', min: 60, badge: 'badge-q4' },
  { key: 'improve', label: 'ปรับปรุงแก้ไข', min: 0, badge: 'badge-q5' },
];

const MAX_PER_ITEM = 5;

/** ปัดทศนิยม 2 ตำแหน่ง โดยไม่ให้เกิดปัญหา floating point (เช่น 84.005) */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function qualityLevel(percentage) {
  const p = Number(percentage) || 0;
  return (QUALITY_LEVELS.find((l) => p >= l.min) || QUALITY_LEVELS[QUALITY_LEVELS.length - 1]).label;
}

/**
 * @param {number[]} scores  คะแนนของแต่ละตัวชี้วัด (1-5)
 * @returns {{totalScore:number, maximumScore:number, percentage:number, qualityLevel:string}}
 */
function calculate(scores) {
  const list = (scores || []).map(Number).filter((n) => Number.isFinite(n));
  const totalScore = list.reduce((sum, n) => sum + n, 0);
  const maximumScore = list.length * MAX_PER_ITEM;
  const percentage = maximumScore > 0 ? round2((totalScore / maximumScore) * 100) : 0;
  return { totalScore, maximumScore, percentage, qualityLevel: qualityLevel(percentage) };
}

/** ค่าเฉลี่ยของการประเมินหลายครั้ง (ผู้เยี่ยมหลายคน) */
function average(numbers) {
  const list = (numbers || []).map(Number).filter((n) => Number.isFinite(n));
  if (!list.length) return 0;
  return round2(list.reduce((a, b) => a + b, 0) / list.length);
}

module.exports = { QUALITY_LEVELS, MAX_PER_ITEM, calculate, qualityLevel, round2, average };
