'use strict';
/**
 * ทดสอบ workflow หลักของระบบผ่าน HTTP จริง (ต้องเปิดเซิร์ฟเวอร์ไว้ก่อน)
 * ใช้งาน: node scripts/smoke-test.js
 */
const BASE = process.env.BASE || 'http://localhost:3000';
const PIN = process.env.PIN || '2468';

let cookie = '';
let pass = 0;
let fail = 0;

function check(name, condition, detail) {
  if (condition) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function call(path, options = {}) {
  const res = await fetch(BASE + path, {
    method: options.method || 'GET',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : options.raw,
  });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  let json = null;
  try { json = await res.json(); } catch { /* ไม่ใช่ JSON */ }
  return { status: res.status, json };
}

async function main() {
  console.log('\n== เข้าสู่ระบบ ==');
  const login = await call('/api/auth/login', { method: 'POST', body: { pin: PIN } });
  check('เข้าสู่ระบบด้วย PIN', login.status === 200, JSON.stringify(login.json));

  console.log('\n== ข้อมูลพื้นฐานใหม่ ==');
  const groupName = `กลุ่มทดสอบ ${Date.now()}`;
  const created = await call('/api/admin/masters/indicator-groups', {
    method: 'POST', body: { name: groupName, sortOrder: 99, status: 1 },
  });
  check('เพิ่มหัวข้อกลุ่มตัวชี้วัด', created.status === 201, JSON.stringify(created.json));
  const groupId = created.json && created.json.data && created.json.data.id;

  const dup = await call('/api/admin/masters/indicator-groups', {
    method: 'POST', body: { name: groupName, sortOrder: 99, status: 1 },
  });
  check('กันชื่อหัวข้อกลุ่มซ้ำ', dup.status === 409);

  const areas = await call('/api/admin/masters/learning-areas');
  check('มีกลุ่มสาระการเรียนรู้ 8 กลุ่ม', areas.json.data.length >= 8, `พบ ${areas.json.data.length}`);

  console.log('\n== ผูกตัวชี้วัดเข้ากลุ่ม ==');
  const indicators = await call('/api/admin/masters/indicators?pageSize=100');
  const first = indicators.json.data[0];
  const originalGroupId = first.groupId;
  const moved = await call(`/api/admin/masters/indicators/${first.id}`, {
    method: 'PUT',
    body: { indicatorName: first.indicatorName, groupId, sortOrder: first.sortOrder, status: 1 },
  });
  check('ย้ายตัวชี้วัดเข้ากลุ่มใหม่', moved.status === 200 && moved.json.data.groupId === groupId);

  // ใช้ผลการประเมินที่มีอยู่จริงรายการแรก (ไม่ผูกกับ id ตายตัว)
  const existing = await call('/api/admin/evaluations?pageSize=1');
  const sampleId = existing.json.data.length ? existing.json.data[0].id : null;
  if (sampleId) {
    const oldReport = await call(`/api/admin/evaluations/${sampleId}`);
    check('snapshot ของรายงานเดิมไม่เปลี่ยนตาม',
      oldReport.json.data.scores[0].groupSnapshot !== groupName,
      oldReport.json.data.scores[0].groupSnapshot);
  } else {
    console.log('  skip snapshot ของรายงานเดิมไม่เปลี่ยนตาม (ยังไม่มีผลการประเมินในระบบ)');
  }

  const softDelete = await call(`/api/admin/masters/indicator-groups/${groupId}`, { method: 'DELETE' });
  check('ลบกลุ่มที่มีตัวชี้วัดผูกอยู่ = soft delete',
    softDelete.status === 200 && softDelete.json.data.softDeleted === true,
    JSON.stringify(softDelete.json && softDelete.json.data));

  // คืนค่าเดิม
  await call(`/api/admin/masters/indicators/${first.id}`, {
    method: 'PUT',
    body: { indicatorName: first.indicatorName, groupId: originalGroupId, sortOrder: first.sortOrder, status: 1 },
  });

  console.log('\n== การตรวจสอบข้อมูลฝั่ง server ==');
  const badJson = await call('/api/admin/masters/learning-areas', {
    method: 'POST', raw: '{"name":}', headers: { 'Content-Type': 'application/json' },
  });
  check('JSON ผิดรูปแบบ = 400 ไม่ใช่ 500', badJson.status === 400, `ได้ ${badJson.status}`);

  const publicSettings = (await call('/api/public/settings')).json.data;
  const needImage = !!publicSettings.requireImages;
  if (needImage) console.log('  (ระบบเปิดบังคับแนบรูปภาพ — เทสจะแนบไฟล์ทดสอบไปด้วย)');
  const formData = (await call('/api/public/form-data')).json.data;
  const scores = formData.indicators.map((i) => ({ indicatorId: i.id, score: 5, practice: 'done' }));

  const noLevel = await postEvaluation(formData, { scores, educationLevel: '' });
  check('ไม่เลือกระดับการศึกษา = ถูกปฏิเสธ', noLevel.status === 400, noLevel.json && noLevel.json.message);

  const noSubject = await postEvaluation(formData, { scores, educationLevel: 'ขั้นพื้นฐาน', skipSubject: true });
  check('ขั้นพื้นฐานแต่ไม่กรอกวิชา = ถูกปฏิเสธ', noSubject.status === 400, noSubject.json && noSubject.json.message);

  const noPractice = await postEvaluation(formData, {
    scores: formData.indicators.map((i) => ({ indicatorId: i.id, score: 5 })),
    educationLevel: 'ปฐมวัย',
  });
  check('ไม่เลือกการดำเนินการ = ถูกปฏิเสธ', noPractice.status === 400, noPractice.json && noPractice.json.message);

  const okKinder = await postEvaluation(formData, { scores, educationLevel: 'ปฐมวัย', withImage: needImage });
  check('บันทึกระดับปฐมวัย (ไม่ต้องมีวิชา) สำเร็จ', okKinder.status === 201, okKinder.json && okKinder.json.message);

  if (okKinder.status === 201) {
    const id = okKinder.json.data.id;
    const detail = await call(`/api/admin/evaluations/${id}`);
    const d = detail.json.data;
    check('บันทึกระดับการศึกษาถูกต้อง', d.educationLevel === 'ปฐมวัย', d.educationLevel);
    check('ปฐมวัยไม่มีข้อมูลวิชา', !d.subjectName && !d.subjectCode, `${d.subjectName}/${d.subjectCode}`);
    check('บันทึกการดำเนินการครบ', d.scores.every((s) => s.practice === 'done'));
    check('บันทึก snapshot หัวข้อกลุ่ม', d.scores.every((s) => !!s.groupSnapshot));
    check('คำนวณคะแนนที่ server', d.totalScore === d.scores.length * 5 && d.percentage === 100);
    await call(`/api/admin/evaluations/${id}`, { method: 'DELETE' });
  }

  console.log(`\n== สรุป: ผ่าน ${pass} / ล้มเหลว ${fail} ==\n`);
  process.exit(fail ? 1 : 0);
}

/** ส่งแบบประเมินผ่าน multipart เหมือนฟอร์มจริง */
async function postEvaluation(formData, opts) {
  const fd = new FormData();
  fd.append('semesterId', formData.semesters[0].id);
  fd.append('academicYearId', formData.academicYears[0].id);
  fd.append('classroomTeacherId', formData.classroomTeachers[0].id);
  fd.append('classroomId', formData.classrooms[0].id);
  fd.append('visitorId', formData.visitors[0].id);
  fd.append('visitDate', new Date().toISOString().slice(0, 10));
  fd.append('comment', 'ข้อความทดสอบระบบอัตโนมัติสำหรับตรวจสอบการทำงานของแบบฟอร์ม');
  fd.append('educationLevel', opts.educationLevel);
  if (opts.educationLevel === 'ขั้นพื้นฐาน' && !opts.skipSubject) {
    fd.append('subjectName', 'ภาษาไทยพื้นฐาน');
    fd.append('subjectCode', 'ท11101');
    fd.append('learningAreaId', formData.learningAreas[0].id);
  }
  fd.append('scores', JSON.stringify(opts.scores));

  // ถ้าผู้ดูแลเปิดบังคับแนบรูปภาพ ให้แนบไฟล์ทดสอบไปด้วย
  if (opts.withImage) {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAHElEQVQI12P8z8Dwn4EIwESMolGFoworhwIAaWQDAd/1s0AAAAAASUVORK5CYII=',
      'base64'
    );
    fd.append('images', new Blob([png], { type: 'image/png' }), 'test.png');
  }

  const res = await fetch(`${BASE}/api/public/evaluations`, { method: 'POST', body: fd });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}

main().catch((e) => { console.error(e); process.exit(1); });
