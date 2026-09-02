/* หน้าแบบการเยี่ยมชั้นเรียน — ขั้นตอนที่ 1-2, คำนวณคะแนนแบบ Real-time และบันทึกข้อมูล */
(function () {
  'use strict';
  const A = window.App;
  const { $, $$, el, icon, clear } = A;

  const DRAFT_KEY = 'cvs.draft.v1';

  const state = {
    step: 1,
    settings: null,
    data: null,           // form-data จาก server
    scores: new Map(),    // indicatorId -> score (1-5)
    practices: new Map(), // indicatorId -> 'done' | 'doing' | 'not_yet'
    educationLevel: '',
    selects: {},
    numbered: [],         // ตัวชี้วัดที่คำนวณเลขข้อ (เช่น 1.1) และหัวข้อกลุ่มแล้ว
    uploader: null,
    saving: false,
  };

  /** จัดเลขข้อแบบ "กลุ่ม.ลำดับ" เช่น 1.1, 1.2, 2.1 — ข้อที่ไม่มีกลุ่มใช้เลขเรียงต่อท้าย */
  function numberIndicators(indicators) {
    const out = [];
    let groupIndex = 0;
    let itemIndex = 0;
    let currentGroup = null;
    let plainIndex = 0;

    indicators.forEach((ind) => {
      const groupName = ind.groupName || null;
      if (groupName) {
        if (groupName !== currentGroup) {
          currentGroup = groupName;
          groupIndex += 1;
          itemIndex = 0;
        }
        itemIndex += 1;
        out.push({
          indicator: ind,
          groupName,
          groupIndex,
          isFirstOfGroup: itemIndex === 1,
          label: `${groupIndex}.${itemIndex}`,
        });
      } else {
        currentGroup = null;
        plainIndex += 1;
        out.push({ indicator: ind, groupName: null, isFirstOfGroup: false, label: String(plainIndex) });
      }
    });
    return out;
  }

  /* ================= Stepper ================= */
  function renderStepper() {
    $$('[data-step-item]').forEach((item) => {
      const n = Number(item.dataset.stepItem);
      const badge = item.querySelector('[data-step-badge]');
      const label = item.querySelector('[data-step-label]');
      const line = item.querySelector('[data-step-line]');
      const done = state.step > n;
      const active = state.step === n;
      badge.className = `flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition sm:h-11 sm:w-11 ${
        done ? 'bg-teal-500 text-white' : active ? 'bg-brand-500 text-white shadow-soft' : 'bg-slate-200 text-slate-500'}`;
      badge.innerHTML = done ? icon('check', 'h-5 w-5') : String(n);
      label.className = `block truncate text-xs font-bold sm:text-sm ${active || done ? 'text-plum' : 'text-slate-400'}`;
      if (line) line.className = `mx-1 hidden h-0.5 flex-1 rounded sm:block ${done ? 'bg-teal-500' : 'bg-slate-200'}`;
    });
  }

  function goStep(n) {
    state.step = n;
    $('#step-1').classList.toggle('hidden', n !== 1);
    $('#step-2').classList.toggle('hidden', n !== 2);
    renderStepper();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ================= โหลดข้อมูลตั้งต้น ================= */
  async function bootstrap() {
    A.hydrateIcons();
    renderStepper();
    renderLegend();

    try {
      const [settings, formData] = await Promise.all([A.loadSettings(), A.api('/api/public/form-data', { skipAuthRedirect: true })]);
      state.settings = settings;
      state.data = formData.data;
      A.applyBranding(settings);
      buildStep1();
      buildIndicators();
      restoreDraft();
      updateSummary();
    } catch (err) {
      $('#step1-skeleton').replaceWith(A.errorState(err.message, () => window.location.reload()));
      return;
    }

    if (new URLSearchParams(location.search).get('session') === 'expired') {
      A.alertWarning('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบผู้ดูแลอีกครั้ง');
      history.replaceState({}, '', '/');
    }
  }

  /* ================= ตอนที่ 1 ================= */
  function fillSelect(node, items, labelKey) {
    clear(node);
    node.appendChild(el('option', { value: '', text: '-- เลือก --' }));
    items.forEach((i) => node.appendChild(el('option', { value: String(i.id), text: i[labelKey] })));
  }

  function buildStep1() {
    const d = state.data;
    $('#step1-skeleton').classList.add('hidden');
    $('#general-form').classList.remove('hidden');

    fillSelect($('#semesterId'), d.semesters, 'name');
    fillSelect($('#academicYearId'), d.academicYears, 'name');

    state.selects.teacher = new A.SearchableSelect($('#teacher-select'), {
      placeholder: '-- เลือกผู้รับผิดชอบชั้นเรียน --',
      searchPlaceholder: 'พิมพ์ชื่อหรือตำแหน่งเพื่อค้นหา...',
      items: d.classroomTeachers.map((t) => ({ value: t.id, label: t.fullName, sublabel: t.position })),
      onChange: saveDraft,
    });
    state.selects.classroom = new A.SearchableSelect($('#classroom-select'), {
      placeholder: '-- เลือกชั้นเรียน --',
      searchPlaceholder: 'พิมพ์ชื่อชั้นเรียนเพื่อค้นหา...',
      items: d.classrooms.map((c) => ({ value: c.id, label: c.name })),
      onChange: () => { suggestEducationLevel(); saveDraft(); },
    });
    state.selects.visitor = new A.SearchableSelect($('#visitor-select'), {
      placeholder: '-- เลือกผู้เยี่ยมชั้นเรียน --',
      searchPlaceholder: 'พิมพ์ชื่อหรือตำแหน่งเพื่อค้นหา...',
      items: d.visitors.map((v) => ({ value: v.id, label: v.fullName, sublabel: v.position })),
      onChange: saveDraft,
    });

    state.selects.learningArea = new A.SearchableSelect($('#learning-area-select'), {
      placeholder: '-- เลือกกลุ่มสาระการเรียนรู้ --',
      searchPlaceholder: 'พิมพ์ชื่อกลุ่มสาระเพื่อค้นหา...',
      items: (d.learningAreas || []).map((a) => ({ value: a.id, label: a.name })),
      onChange: saveDraft,
    });

    buildEducationLevels();

    $('#visitDate').value = A.todayISO();
    $('#general-form').addEventListener('submit', (e) => { e.preventDefault(); if (validateStep1()) goStep(2); });
    ['#subjectName', '#subjectCode'].forEach((sel) => {
      $(sel).addEventListener('input', () => { A.clearFieldError($(sel)); saveDraft(); });
    });
    ['#semesterId', '#academicYearId', '#visitDate'].forEach((sel) => {
      $(sel).addEventListener('change', () => { A.clearFieldError($(sel)); saveDraft(); });
    });

    if (!state.settings.requireImages) {
      $('#images-required-chip').textContent = 'ไม่บังคับ';
    } else {
      $('#images-required-chip').textContent = 'บังคับแนบอย่างน้อย 1 รูป';
      $('#images-required-chip').classList.add('border-danger-500', 'text-danger-600');
    }
  }

  /** ปุ่มเลือกระดับการศึกษา (ปฐมวัย / ขั้นพื้นฐาน) */
  function buildEducationLevels() {
    const box = $('#education-level');
    clear(box);
    (state.data.educationLevels || []).forEach((level) => {
      box.appendChild(el('button', {
        type: 'button',
        class: 'level-btn',
        role: 'radio',
        'aria-checked': 'false',
        dataset: { level },
        onclick: () => setEducationLevel(level),
      }, [
        el('span', { class: 'text-brand-500', html: icon(level === 'ปฐมวัย' ? 'star' : 'academic', 'h-4 w-4') }),
        el('span', { text: level }),
      ]));
    });
  }

  function setEducationLevel(level) {
    state.educationLevel = level;
    $$('#education-level .level-btn').forEach((b) => b.setAttribute('aria-checked', b.dataset.level === level ? 'true' : 'false'));
    const needsSubject = level === state.data.subjectRequiredLevel;
    $('#subject-block').classList.toggle('hidden', !needsSubject);
    if (!needsSubject) {
      // ระดับปฐมวัยไม่ต้องระบุวิชา — ล้างค่าที่กรอกไว้เพื่อไม่ให้ส่งข้อมูลค้าง
      $('#subjectName').value = '';
      $('#subjectCode').value = '';
      state.selects.learningArea.setValue('', true);
    }
    A.clearFieldError($('#education-level'));
    saveDraft();
  }

  /** เดาระดับการศึกษาจากชื่อชั้นเรียน เพื่อช่วยกรอกให้เร็วขึ้น (ผู้ใช้เปลี่ยนเองได้) */
  function suggestEducationLevel() {
    if (state.educationLevel) return;
    const item = state.selects.classroom && state.selects.classroom.selectedItem();
    if (!item) return;
    setEducationLevel(/อนุบาล|ปฐมวัย|เตรียม/.test(item.label) ? 'ปฐมวัย' : 'ขั้นพื้นฐาน');
  }

  function generalValues() {
    return {
      semesterId: $('#semesterId').value,
      academicYearId: $('#academicYearId').value,
      classroomTeacherId: state.selects.teacher ? state.selects.teacher.value : '',
      classroomId: state.selects.classroom ? state.selects.classroom.value : '',
      visitDate: $('#visitDate').value,
      visitorId: state.selects.visitor ? state.selects.visitor.value : '',
      educationLevel: state.educationLevel,
      subjectName: $('#subjectName') ? $('#subjectName').value.trim() : '',
      subjectCode: $('#subjectCode') ? $('#subjectCode').value.trim() : '',
      learningAreaId: state.selects.learningArea ? state.selects.learningArea.value : '',
    };
  }

  function validateStep1(silent) {
    A.clearAllErrors($('#step-1'));
    const v = generalValues();
    const problems = [];

    const check = (cond, node, message) => { if (!cond) { A.setFieldError(node, message); problems.push(message); } };
    check(v.semesterId, $('#semesterId'), 'กรุณาเลือกภาคเรียน');
    check(v.academicYearId, $('#academicYearId'), 'กรุณาเลือกปีการศึกษา');
    check(v.classroomTeacherId, state.selects.teacher.button, 'กรุณาเลือกชื่อผู้รับผิดชอบชั้นเรียน');
    check(v.classroomId, state.selects.classroom.button, 'กรุณาเลือกชั้นเรียน');
    check(v.visitDate, $('#visitDate'), 'กรุณาระบุวันที่เยี่ยมชั้นเรียน');
    check(v.visitorId, state.selects.visitor.button, 'กรุณาเลือกชื่อผู้เยี่ยมชั้นเรียน');
    check(v.educationLevel, $('#education-level'), 'กรุณาเลือกระดับการศึกษา');

    // วิชา/รหัสวิชา/กลุ่มสาระ บังคับเฉพาะระดับขั้นพื้นฐาน
    if (v.educationLevel === state.data.subjectRequiredLevel) {
      check(v.subjectName, $('#subjectName'), 'กรุณากรอกวิชา');
      check(v.subjectCode, $('#subjectCode'), 'กรุณากรอกรหัสวิชา');
      check(v.learningAreaId, state.selects.learningArea.button, 'กรุณาเลือกกลุ่มสาระการเรียนรู้');
    }

    if (problems.length) {
      if (!silent) {
        A.alertWarning('กรอกข้อมูลไม่ครบถ้วน',
          `<div style="text-align:left" class="text-sm">${problems.map((p) => `<div class="py-0.5">• ${p}</div>`).join('')}</div>`);
      }
      return false;
    }
    renderRecap();
    saveDraft();
    return true;
  }

  function labelOf(list, id, key) {
    const found = (list || []).find((i) => String(i.id) === String(id));
    return found ? found[key] : '-';
  }

  function renderRecap() {
    const d = state.data;
    const v = generalValues();
    const teacher = state.selects.teacher.selectedItem();
    const visitor = state.selects.visitor.selectedItem();
    const chips = [
      ['calendar', `${labelOf(d.semesters, v.semesterId, 'name')} / ปีการศึกษา ${labelOf(d.academicYears, v.academicYearId, 'name')}`],
      ['user', `ผู้รับการเยี่ยม: ${teacher ? teacher.label : '-'}`],
      ['academic', `ชั้นเรียน: ${labelOf(d.classrooms, v.classroomId, 'name')}`],
      ['calendar', `วันที่: ${A.thaiDate(v.visitDate)}`],
      ['users', `ผู้เยี่ยม: ${visitor ? visitor.label : '-'}`],
      ['badge', `ระดับการศึกษา: ${v.educationLevel || '-'}`],
    ];
    if (v.educationLevel === state.data.subjectRequiredLevel) {
      const area = state.selects.learningArea.selectedItem();
      chips.push(['doc', `วิชา: ${v.subjectName || '-'} (${v.subjectCode || '-'})`]);
      chips.push(['list', `กลุ่มสาระ: ${area ? area.label : '-'}`]);
    }
    const box = $('#general-recap');
    clear(box);
    chips.forEach(([ic, text]) => {
      const chip = el('span', { class: 'chip' });
      chip.appendChild(el('span', { class: 'text-brand-500', html: icon(ic, 'h-4 w-4') }));
      chip.appendChild(el('span', { text }));
      box.appendChild(chip);
    });
  }

  /* ================= ตอนที่ 2 ================= */
  function renderLegend() {
    const box = $('#score-legend');
    clear(box);
    [5, 4, 3, 2, 1].forEach((s) => {
      const chip = el('span', { class: 'badge border border-slate-200 bg-white text-slate-600' });
      chip.appendChild(el('span', {
        class: 'flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold text-white',
        text: String(s),
        style: `background:${A.SCORE_COLORS[s]}${s === 3 ? ';color:#5A3B00' : ''}`,
      }));
      chip.appendChild(el('span', { text: `= ${A.SCORE_LABELS[s]}` }));
      box.appendChild(chip);
    });
  }

  function buildIndicators() {
    const body = $('#indicator-body');
    clear(body);
    const indicators = state.data.indicators;

    if (!indicators.length) {
      body.appendChild(el('tr', {}, el('td', { colspan: 3 }, A.emptyState('ยังไม่มีรายการตัวชี้วัด', 'กรุณาให้ผู้ดูแลระบบเพิ่มรายการตัวชี้วัดที่เมนู "จัดการแบบเยี่ยมชั้นเรียน" ก่อนใช้งาน'))));
      $('#btn-save').disabled = true;
      return;
    }

    state.numbered = numberIndicators(indicators);

    state.numbered.forEach((item) => {
      const ind = item.indicator;

      // แถวหัวข้อกลุ่ม เช่น "1  แผนการจัดการเรียนรู้"
      if (item.isFirstOfGroup) {
        body.appendChild(el('tr', { class: 'group-row' },
          el('td', { colspan: 4 }, [
            el('span', { class: 'mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-500 text-xs text-white', text: String(item.groupIndex) }),
            el('span', { text: item.groupName }),
          ])));
      }

      const tr = el('tr', { dataset: { indicatorRow: ind.id } });
      tr.appendChild(el('td', { class: 'whitespace-nowrap text-center align-top font-bold text-slate-500', text: item.label }));
      tr.appendChild(el('td', { class: 'min-w-[16rem] align-top leading-relaxed text-slate-700', text: ind.indicatorName }));

      /* ---- คอลัมน์การดำเนินการ ---- */
      const practiceCell = el('td', { class: 'align-top' });
      const practiceGroup = el('div', {
        class: 'flex flex-col gap-1',
        role: 'radiogroup',
        'aria-label': `การดำเนินการของข้อ ${item.label}`,
      });
      (state.data.practiceOptions || []).forEach((opt) => {
        practiceGroup.appendChild(el('button', {
          type: 'button',
          class: 'practice-btn',
          role: 'radio',
          'aria-checked': 'false',
          dataset: { practice: opt.value, indicator: String(ind.id) },
          text: opt.label,
          onclick: () => selectPractice(ind.id, opt.value),
        }));
      });
      practiceCell.appendChild(practiceGroup);
      tr.appendChild(practiceCell);

      /* ---- คอลัมน์คะแนน 1-5 ---- */
      const cell = el('td', { class: 'align-top' });
      const group = el('div', {
        class: 'flex items-center justify-center gap-1.5 sm:gap-2',
        role: 'radiogroup',
        'aria-label': `ระดับการปฏิบัติของข้อ ${item.label}`,
      });
      [1, 2, 3, 4, 5].forEach((score) => {
        group.appendChild(el('button', {
          type: 'button',
          class: 'score-btn',
          role: 'radio',
          'aria-checked': 'false',
          'aria-label': `${score} คะแนน — ${A.SCORE_LABELS[score]}`,
          title: A.SCORE_LABELS[score],
          dataset: { score: String(score), indicator: String(ind.id) },
          text: String(score),
          onclick: () => selectScore(ind.id, score),
          onkeydown: (e) => onScoreKey(e, ind.id, score),
        }));
      });
      cell.appendChild(group);
      tr.appendChild(cell);
      body.appendChild(tr);
    });

    $('#sum-count').textContent = String(indicators.length);
    $('#sum-max').textContent = String(indicators.length * 5);

    $('#comment').addEventListener('input', () => {
      $('#comment-count').textContent = String($('#comment').value.length);
      A.clearFieldError($('#comment'));
      saveDraft();
    });

    if (state.settings.uploadsAvailable === false) {
      // ยังต่อที่เก็บรูปภาพไม่ได้ — บอกตั้งแต่ต้นดีกว่าให้กรอกจนเสร็จแล้วบันทึกไม่ผ่าน
      clear($('#image-uploader'));
      $('#image-uploader').appendChild(el('div', {
        class: 'rounded-xl border border-amber2-500/40 bg-amber2-500/10 p-4 text-sm text-[#7A4F01]',
      }, [
        el('p', { class: 'font-bold', text: 'ยังแนบรูปภาพไม่ได้ในขณะนี้' }),
        el('p', { class: 'mt-1', text: 'ระบบยังไม่ได้เชื่อมต่อที่เก็บรูปภาพ กรุณาแจ้งผู้ดูแลระบบ — บันทึกผลการประเมินได้ตามปกติโดยไม่ต้องแนบรูป' }),
      ]));
      $('#images-required-chip').textContent = 'ยังใช้งานไม่ได้';
    } else {
      state.uploader = new A.ImageUploader($('#image-uploader'), {
        onChange: () => A.clearFieldError($('#image-uploader')),
      });
    }

    $('#btn-back').addEventListener('click', () => goStep(1));
    $('#btn-save').addEventListener('click', save);
  }

  function onScoreKey(e, indicatorId, score) {
    const map = { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -1, ArrowDown: 1 };
    if (map[e.key]) {
      e.preventDefault();
      const next = Math.min(5, Math.max(1, score + map[e.key]));
      const btn = document.querySelector(`.score-btn[data-indicator="${indicatorId}"][data-score="${next}"]`);
      if (btn) btn.focus();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      selectScore(indicatorId, score);
    }
  }

  function selectPractice(indicatorId, value) {
    state.practices.set(String(indicatorId), value);
    $$(`.practice-btn[data-indicator="${indicatorId}"]`).forEach((b) => {
      b.setAttribute('aria-checked', b.dataset.practice === value ? 'true' : 'false');
    });
    const row = document.querySelector(`tr[data-indicator-row="${indicatorId}"]`);
    if (row && state.scores.get(String(indicatorId))) row.classList.remove('bg-danger-500/5');
    A.$('[data-error="scores"]').classList.remove('show');
    saveDraft();
  }

  function selectScore(indicatorId, score) {
    state.scores.set(String(indicatorId), score);
    $$(`.score-btn[data-indicator="${indicatorId}"]`).forEach((b) => {
      b.setAttribute('aria-checked', b.dataset.score === String(score) ? 'true' : 'false');
    });
    const row = document.querySelector(`tr[data-indicator-row="${indicatorId}"]`);
    if (row) row.classList.remove('bg-danger-500/5');
    A.$('[data-error="scores"]').classList.remove('show');
    updateSummary();
    saveDraft();
  }

  /* คำนวณคะแนนแบบ Real-time (server จะคำนวณซ้ำอีกครั้งเสมอ) */
  function computeSummary() {
    const count = state.data.indicators.length;
    let total = 0;
    let answered = 0;
    state.data.indicators.forEach((ind) => {
      const s = state.scores.get(String(ind.id));
      if (s) { total += s; answered += 1; }
    });
    const maximum = count * 5;
    const percentage = maximum ? Math.round(((total / maximum) * 100 + Number.EPSILON) * 100) / 100 : 0;
    return { total, maximum, answered, count, percentage };
  }

  const QUALITY = [[90, 'ดีมาก'], [80, 'ดี'], [70, 'ปานกลาง'], [60, 'พอใช้'], [0, 'ปรับปรุงแก้ไข']];

  function updateSummary() {
    const s = computeSummary();
    $('#sum-total').textContent = A.num(s.total);
    $('#sum-max').textContent = A.num(s.maximum);
    $('#sum-answered').textContent = A.num(s.answered);
    $('#sum-percent').textContent = s.percentage.toFixed(2);
    $('#sum-bar').style.width = `${Math.min(100, s.percentage)}%`;

    const node = $('#sum-quality');
    if (s.answered < s.count || !s.count) {
      node.className = 'badge-off text-base';
      node.textContent = `ประเมินแล้ว ${s.answered}/${s.count} ข้อ`;
    } else {
      const level = (QUALITY.find(([min]) => s.percentage >= min) || QUALITY[QUALITY.length - 1])[1];
      node.className = `${A.qualityBadge(level)} text-base`;
      node.textContent = level;
    }
  }

  /* ================= Draft (กันข้อมูลหายเมื่อ refresh) ================= */
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        general: generalValues(),
        scores: Array.from(state.scores.entries()),
        practices: Array.from(state.practices.entries()),
        comment: $('#comment') ? $('#comment').value : '',
        savedAt: Date.now(),
      }));
    } catch { /* localStorage อาจถูกปิด — ไม่ถือเป็นข้อผิดพลาด */ }
  }

  function restoreDraft() {
    let draft;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { draft = null; }
    if (!draft || Date.now() - (draft.savedAt || 0) > 24 * 3600 * 1000) return;

    const g = draft.general || {};
    if (g.semesterId) $('#semesterId').value = g.semesterId;
    if (g.academicYearId) $('#academicYearId').value = g.academicYearId;
    if (g.visitDate) $('#visitDate').value = g.visitDate;
    if (g.classroomTeacherId) state.selects.teacher.setValue(g.classroomTeacherId, true);
    if (g.classroomId) state.selects.classroom.setValue(g.classroomId, true);
    if (g.visitorId) state.selects.visitor.setValue(g.visitorId, true);
    if (g.educationLevel) setEducationLevel(g.educationLevel);
    if (g.subjectName) $('#subjectName').value = g.subjectName;
    if (g.subjectCode) $('#subjectCode').value = g.subjectCode;
    if (g.learningAreaId) state.selects.learningArea.setValue(g.learningAreaId, true);

    const known = (id) => state.data.indicators.some((i) => String(i.id) === String(id));
    (draft.scores || []).forEach(([id, score]) => { if (known(id)) selectScore(id, score); });
    (draft.practices || []).forEach(([id, value]) => { if (known(id)) selectPractice(id, value); });
    if (draft.comment) {
      $('#comment').value = draft.comment;
      $('#comment-count').textContent = String(draft.comment.length);
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  /* ================= บันทึก ================= */
  async function save() {
    if (state.saving) return; // ป้องกันการกดปุ่มซ้ำ

    if (!validateStep1(true)) {
      await A.alertWarning('ข้อมูลทั่วไปไม่ครบถ้วน', 'กรุณากลับไปตรวจสอบข้อมูลในตอนที่ 1 ให้ครบถ้วนก่อนบันทึก');
      goStep(1);
      validateStep1();
      return;
    }

    A.clearAllErrors($('#step-2'));
    // ต้องเลือกครบทั้งการดำเนินการและคะแนนทุกข้อ
    const missing = state.data.indicators.filter(
      (i) => !state.scores.get(String(i.id)) || !state.practices.get(String(i.id))
    );
    if (missing.length) {
      missing.forEach((i) => {
        const row = document.querySelector(`tr[data-indicator-row="${i.id}"]`);
        if (row) row.classList.add('bg-danger-500/5');
      });
      const noPractice = missing.filter((i) => !state.practices.get(String(i.id))).length;
      const noScore = missing.filter((i) => !state.scores.get(String(i.id))).length;
      const parts = [];
      if (noPractice) parts.push(`ยังไม่ได้เลือกการดำเนินการ ${noPractice} ข้อ`);
      if (noScore) parts.push(`ยังไม่ได้เลือกคะแนน ${noScore} ข้อ`);

      const err = $('[data-error="scores"]');
      err.textContent = `กรุณาประเมินให้ครบทุกข้อ (${parts.join(' · ')})`;
      err.classList.add('show');
      await A.alertWarning('ประเมินไม่ครบทุกข้อ', parts.join('<br/>'));
      const firstRow = document.querySelector(`tr[data-indicator-row="${missing[0].id}"]`);
      if (firstRow) firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const comment = $('#comment').value.trim();
    if (comment.length < (state.settings.commentMinLength || 10)) {
      A.setFieldError($('#comment'), `กรุณากรอกข้อคิดเห็น/ข้อเสนอแนะ อย่างน้อย ${state.settings.commentMinLength || 10} ตัวอักษร`);
      await A.alertWarning('ยังไม่ได้กรอกข้อคิดเห็น', `กรุณากรอกข้อคิดเห็น/ข้อเสนอแนะ อย่างน้อย ${state.settings.commentMinLength || 10} ตัวอักษร`);
      $('#comment').focus();
      return;
    }

    const files = state.uploader ? state.uploader.getFiles() : [];
    if (state.settings.requireImages && state.settings.uploadsAvailable !== false && !files.length) {
      A.setFieldError($('#image-uploader'), 'กรุณาแนบรูปภาพการเยี่ยมชั้นเรียนอย่างน้อย 1 รูป');
      await A.alertWarning('ยังไม่ได้แนบรูปภาพ', 'ผู้ดูแลระบบกำหนดให้ต้องแนบรูปภาพอย่างน้อย 1 รูป');
      return;
    }

    const confirmed = await A.confirmAction(
      'ยืนยันการบันทึกผลการประเมิน',
      `<div style="text-align:left" class="text-sm text-slate-600">คะแนนรวม <b>${computeSummary().total}</b> จาก <b>${computeSummary().maximum}</b> คะแนน` +
      `<br/>รูปภาพแนบ ${files.length} รูป</div>`,
      'บันทึกผลการประเมิน'
    );
    if (!confirmed) return;

    const g = generalValues();
    const fd = new FormData();
    Object.entries(g).forEach(([k, v]) => fd.append(k, v));
    fd.append('comment', comment);
    fd.append('scores', JSON.stringify(state.data.indicators.map((i) => ({
      indicatorId: i.id,
      score: state.scores.get(String(i.id)),
      practice: state.practices.get(String(i.id)),
    }))));
    files.forEach((f) => fd.append('images', f, f.name));

    state.saving = true;
    const btn = $('#btn-save');
    btn.disabled = true;
    $('#btn-back').disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span><span>กำลังบันทึก...</span>';
    if (files.length) $('#upload-progress').classList.remove('hidden');
    A.showLoading('กำลังบันทึกผลการเยี่ยมชั้นเรียน...');

    try {
      const res = await A.apiUpload('/api/public/evaluations', fd, (p) => {
        $('#upload-percent').textContent = `${p}%`;
        $('#upload-bar').style.width = `${p}%`;
      });
      A.hideLoading(true);
      const d = res.data;
      await A.alertSuccess('บันทึกผลการประเมินเรียบร้อยแล้ว',
        `<div class="text-sm text-slate-600">เลขอ้างอิงรายการประเมิน</div>` +
        `<div class="my-2 rounded-xl bg-brand-50 px-4 py-2 text-lg font-extrabold text-brand-600">${d.referenceNumber}</div>` +
        `<div class="text-sm text-slate-600">คะแนนรวม ${d.totalScore}/${d.maximumScore} คะแนน · ร้อยละ ${Number(d.percentage).toFixed(2)} · ระดับคุณภาพ ${d.qualityLevel}</div>`);
      resetForm();
    } catch (err) {
      A.hideLoading(true);
      await A.alertError('บันทึกไม่สำเร็จ', err.message);
    } finally {
      state.saving = false;
      btn.disabled = false;
      $('#btn-back').disabled = false;
      btn.innerHTML = originalHtml;
      $('#upload-progress').classList.add('hidden');
      $('#upload-bar').style.width = '0%';
    }
  }

  function resetForm() {
    state.scores.clear();
    state.practices.clear();
    state.educationLevel = '';
    $$('.score-btn').forEach((b) => b.setAttribute('aria-checked', 'false'));
    $$('.practice-btn').forEach((b) => b.setAttribute('aria-checked', 'false'));
    $$('#education-level .level-btn').forEach((b) => b.setAttribute('aria-checked', 'false'));
    $('#subject-block').classList.add('hidden');
    $('#subjectName').value = '';
    $('#subjectCode').value = '';
    state.selects.learningArea.setValue('', true);
    $$('tr[data-indicator-row]').forEach((r) => r.classList.remove('bg-danger-500/5'));
    $('#comment').value = '';
    $('#comment-count').textContent = '0';
    if (state.uploader) state.uploader.reset();
    $('#semesterId').value = '';
    $('#academicYearId').value = '';
    $('#visitDate').value = A.todayISO();
    state.selects.teacher.setValue('', true);
    state.selects.classroom.setValue('', true);
    state.selects.visitor.setValue('', true);
    A.clearAllErrors(document);
    clearDraft();
    updateSummary();
    goStep(1);
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#fab-admin').addEventListener('click', A.openPinModal);
    bootstrap();
  });
})();
