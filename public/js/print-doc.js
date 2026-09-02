/* =========================================================================
   สร้างเอกสารสำหรับพิมพ์ / บันทึกเป็น PDF ในรูปแบบเอกสารราชการ
   ทุกเอกสารสร้างเป็น DOM ใหม่ใน #print-root แล้วเรียก window.print()
   ========================================================================= */
(function (global) {
  'use strict';
  const A = global.App;
  const { el, clear, icon, thaiDate, num } = A;

  const SCORE_COLUMNS = [5, 4, 3, 2, 1];
  const PRACTICE_COLUMNS = [
    { value: 'done', label: 'ปฏิบัติแล้ว' },
    { value: 'doing', label: 'กำลังปฏิบัติ' },
    { value: 'not_yet', label: 'ยังไม่ปฏิบัติ' },
  ];
  const TICK = '✓';

  /**
   * จัดเลขข้อแบบ "กลุ่ม.ลำดับ" และบอกว่าแถวไหนต้องขึ้นหัวข้อกลุ่มใหม่
   * @param {Array} rows แถวคะแนนที่เรียงตามกลุ่มมาแล้ว (มี groupSnapshot)
   */
  function numberRows(rows) {
    let groupIndex = 0;
    let itemIndex = 0;
    let currentGroup = null;
    let plainIndex = 0;

    return rows.map((row) => {
      const groupName = row.groupSnapshot || row.groupName || null;
      if (groupName) {
        const isNew = groupName !== currentGroup;
        if (isNew) { currentGroup = groupName; groupIndex += 1; itemIndex = 0; }
        itemIndex += 1;
        return { row, groupName, groupIndex, isFirstOfGroup: isNew, label: `${groupIndex}.${itemIndex}` };
      }
      currentGroup = null;
      plainIndex += 1;
      return { row, groupName: null, isFirstOfGroup: false, label: String(plainIndex) };
    });
  }

  /** แถวหัวข้อกลุ่มในตารางพิมพ์ */
  function groupRow(colspan, index, name) {
    return el('tr', { class: 'pd-group' }, el('td', { colspan }, `${index}  ${name}`));
  }

  /* ---------------- ตัวช่วยทั่วไป ---------------- */

  function printRoot() {
    let root = document.getElementById('print-root');
    if (!root) {
      root = el('div', { id: 'print-root' });
      document.body.appendChild(root);
    }
    return root;
  }

  /** ส่วนหัวเอกสาร: โลโก้ + ชื่อแบบฟอร์ม + ชื่อโรงเรียน/ต้นสังกัด */
  function docHead(settings, title, extraLine) {
    const head = el('div', { class: 'pd-head' });
    if (settings && settings.schoolLogo) {
      head.appendChild(el('img', { class: 'pd-logo', src: settings.schoolLogo, alt: '' }));
    }
    head.appendChild(el('h1', { class: 'pd-title', text: title }));
    head.appendChild(el('p', {
      class: 'pd-subtitle',
      text: `${(settings && settings.schoolName) || ''}   ${(settings && settings.affiliationName) || ''}`.trim(),
    }));
    if (extraLine) head.appendChild(el('p', { class: 'pd-subtitle', text: extraLine }));
    return head;
  }

  /** บรรทัดข้อมูล เช่น "ชื่อผู้รับการเยี่ยมชั้นเรียน: ..." */
  function metaRow(pairs) {
    const row = el('div', { class: 'pd-meta-row' });
    pairs.filter(Boolean).forEach(([label, value]) => {
      row.appendChild(el('span', {}, [
        el('span', { class: 'pd-label', text: `${label}: ` }),
        el('span', { text: value === null || value === undefined || value === '' ? '-' : String(value) }),
      ]));
    });
    return row;
  }

  /** บล็อกลายเซ็น */
  function signBlock(entries) {
    const wrap = el('div', { class: 'pd-signs' });
    entries.forEach((e) => {
      wrap.appendChild(el('div', { class: 'pd-sign' }, [
        el('div', { class: 'pd-sign-line', text: 'ลงชื่อ ................................................' }),
        el('div', { class: 'pd-sign-name', text: `( ${e.name || '.....................................'} )` }),
        el('div', { text: e.position || '' }),
        el('div', { text: e.role }),
      ]));
    });
    return wrap;
  }

  /** หน้ารูปภาพประกอบ */
  function photoPage(settings, title, meta, images) {
    const page = el('div', { class: 'pd-page' }, [docHead(settings, title)]);
    if (meta) page.appendChild(meta);
    page.appendChild(el('p', { class: 'pd-section-title', text: `ภาพประกอบการเยี่ยมชั้นเรียน (${images.length} ภาพ)` }));
    const grid = el('div', { class: 'pd-photos' });
    images.forEach((img) => {
      grid.appendChild(el('figure', { class: 'pd-photo' }, [
        el('img', { src: img.imageUrl, alt: '' }),
        img.caption ? el('figcaption', { text: img.caption }) : null,
      ]));
    });
    page.appendChild(grid);
    return page;
  }

  /** แถวสรุปคะแนนใต้ตาราง */
  function summaryBox(totalScore, maximumScore, percentage, qualityLevel, digits) {
    return el('div', { class: 'pd-box' },
      el('div', { class: 'pd-summary-row' }, [
        el('span', { text: `คะแนนรวม ${num(totalScore, digits === undefined ? 0 : digits)} จาก ${num(maximumScore)} คะแนน` }),
        el('span', { text: `คิดเป็นร้อยละ ${num(percentage, 2)}` }),
        el('span', { text: `ระดับคุณภาพ ${qualityLevel}` }),
      ]));
  }

  /* =======================================================================
     เอกสารที่ 1 — แบบบันทึกการตรวจเยี่ยมชั้นเรียน (รายครั้ง)
     ======================================================================= */
  function buildEvaluationDoc(data, settings) {
    const frag = document.createDocumentFragment();
    const round = data.visitRound ? `ครั้งที่ ${data.visitRound}  ` : '';
    const level = data.educationLevel ? `${data.educationLevel}  ` : '';
    const title = `แบบบันทึกการตรวจเยี่ยมชั้นเรียน  ${level}${round}ปีการศึกษา ${data.academicYearName}`;

    const meta = el('div', { class: 'pd-meta' }, [
      metaRow([
        ['ชื่อผู้รับการเยี่ยมชั้นเรียน', data.teacherName],
        ['ตำแหน่ง', data.teacherPosition],
      ]),
      metaRow([
        ['ชื่อผู้เยี่ยมชั้นเรียน', data.visitorName],
        ['ตำแหน่ง', data.visitorPosition],
      ]),
      metaRow([
        ['ชั้นเรียน', data.classroomName],
        ['ระดับการศึกษา', data.educationLevel],
        ['ภาคเรียน', data.semesterName],
        ['วันที่เยี่ยมชั้นเรียน', thaiDate(data.visitDate)],
      ]),
      // บรรทัดวิชาแสดงเฉพาะการเยี่ยมระดับขั้นพื้นฐาน
      data.subjectName
        ? metaRow([
          ['วิชา', data.subjectName],
          ['รหัสวิชา', data.subjectCode],
          ['กลุ่มสาระการเรียนรู้', data.learningAreaSnapshot],
        ])
        : null,
      metaRow([['เลขอ้างอิงรายการประเมิน', data.referenceNumber]]),
    ]);

    /* ---- ตารางรายการประเมิน ---- */
    const table = el('table', { class: 'pd-table' });
    const head1 = el('tr', {}, [
      el('th', { class: 'pd-num', rowspan: 2, text: 'ข้อที่' }),
      el('th', { rowspan: 2, text: 'รายการประเมิน' }),
      el('th', { colspan: PRACTICE_COLUMNS.length, text: 'การดำเนินการ' }),
      el('th', { colspan: SCORE_COLUMNS.length, text: 'ผลการดำเนินการ' }),
    ]);
    const head2 = el('tr', {}, [
      ...PRACTICE_COLUMNS.map((p) => el('th', { class: 'pd-practice', text: p.label })),
      ...SCORE_COLUMNS.map((s) => el('th', { class: 'pd-score', text: String(s) })),
    ]);
    table.appendChild(el('thead', {}, [head1, head2]));

    const totalCols = 2 + PRACTICE_COLUMNS.length + SCORE_COLUMNS.length;
    const tbody = el('tbody');
    numberRows(data.scores).forEach((item) => {
      if (item.isFirstOfGroup) tbody.appendChild(groupRow(totalCols, item.groupIndex, item.groupName));
      const s = item.row;
      const tr = el('tr', {}, [
        el('td', { class: 'pd-c', text: item.label }),
        el('td', { text: s.indicatorSnapshot }),
      ]);
      PRACTICE_COLUMNS.forEach((p) => {
        tr.appendChild(el('td', { class: 'pd-tick', text: s.practice === p.value ? TICK : '' }));
      });
      SCORE_COLUMNS.forEach((col) => {
        tr.appendChild(el('td', { class: 'pd-tick', text: s.score === col ? TICK : '' }));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    /* ---- หน้าที่ 1 ---- */
    const page1 = el('div', { class: 'pd-page' }, [
      docHead(settings, title),
      meta,
      table,
      summaryBox(data.totalScore, data.maximumScore, data.percentage, data.qualityLevel),
      el('p', { class: 'pd-section-title', text: 'ข้อคิดเห็น / ข้อเสนอแนะ' }),
      el('div', { class: 'pd-comment', text: data.comment || '' }),
      signBlock([
        { name: data.visitorName, position: data.visitorPosition, role: 'ผู้เยี่ยมชั้นเรียน' },
        { name: data.teacherName, position: data.teacherPosition, role: 'ผู้รับการเยี่ยมชั้นเรียน' },
      ]),
    ]);
    frag.appendChild(page1);

    /* ---- หน้ารูปภาพ ---- */
    if (data.images.length) {
      frag.appendChild(photoPage(
        settings,
        'ภาพประกอบการตรวจเยี่ยมชั้นเรียน',
        el('div', { class: 'pd-meta' }, [
          metaRow([
            ['ผู้รับการเยี่ยมชั้นเรียน', data.teacherName],
            ['ชั้นเรียน', data.classroomName],
            ['วันที่', thaiDate(data.visitDate)],
          ]),
        ]),
        data.images.map((img) => ({ imageUrl: img.imageUrl, caption: '' }))
      ));
    }
    return frag;
  }

  /* =======================================================================
     เอกสารที่ 2 — แบบบันทึกสรุปการตรวจเยี่ยมชั้นเรียน (รายบุคคล/รายกลุ่ม)
     ======================================================================= */
  function buildSummaryDetailDoc(data, settings) {
    const frag = document.createDocumentFragment();
    const s = data.scope;

    const meta = el('div', { class: 'pd-meta' }, [
      metaRow([
        ['ชื่อผู้รับการเยี่ยมชั้นเรียน', s.teacherName],
        ['ตำแหน่ง', s.teacherPosition],
      ]),
      metaRow([
        ['ชั้นเรียน', s.classroomName],
        ['ระดับการศึกษา', s.educationLevel],
        ['ภาคเรียน', s.semesterName],
        ['ปีการศึกษา', s.academicYearName],
        ['จำนวนผู้เยี่ยมชั้นเรียน', `${num(data.summary.visitCount)} คน`],
      ]),
      s.subjectName
        ? metaRow([
          ['วิชา', s.subjectName],
          ['รหัสวิชา', s.subjectCode],
          ['กลุ่มสาระการเรียนรู้', s.learningArea],
        ])
        : null,
    ]);

    /* ---- ตารางสรุปรายครั้ง ---- */
    const table = el('table', { class: 'pd-table' });
    table.appendChild(el('thead', {}, [
      el('tr', {}, [
        el('th', { rowspan: 2, text: 'ครั้งที่' }),
        el('th', { rowspan: 2, text: 'วันที่' }),
        el('th', { colspan: 3, text: 'รายการรับการเยี่ยมชั้นเรียน' }),
        el('th', { colspan: 2, text: 'สรุปผลการเยี่ยมชั้นเรียน' }),
      ]),
      el('tr', {}, [
        el('th', { text: 'ผู้เยี่ยมชั้นเรียน' }),
        el('th', { text: 'ชั้นเรียน' }),
        el('th', { text: 'ระดับการศึกษา' }),
        el('th', { text: 'คะแนน' }),
        el('th', { text: 'ระดับคุณภาพ' }),
      ]),
    ]));
    const tbody = el('tbody');
    data.evaluations.forEach((e, i) => {
      tbody.appendChild(el('tr', {}, [
        el('td', { class: 'pd-c', text: `ครั้งที่ ${i + 1}` }),
        el('td', { class: 'pd-c', text: thaiDate(e.visitDate, 'short') }),
        el('td', { text: e.visitorName }),
        el('td', { class: 'pd-c', text: s.classroomName }),
        el('td', { class: 'pd-c', text: e.educationLevel || '-' }),
        el('td', { class: 'pd-c pd-b', text: num(e.percentage, 2) }),
        el('td', { class: 'pd-c', text: e.qualityLevel }),
      ]));
    });
    table.appendChild(tbody);

    const page1 = el('div', { class: 'pd-page' }, [
      docHead(settings, 'แบบบันทึกสรุปการตรวจเยี่ยมชั้นเรียน'),
      meta,
      table,
      summaryBox(data.summary.averageTotalScore, data.summary.averageMaximumScore,
        data.summary.averagePercentage, data.summary.qualityLevel, 2),
      signBlock([
        { name: s.teacherName, position: s.teacherPosition, role: 'ผู้รับการเยี่ยมชั้นเรียน' },
        { name: '', position: '', role: 'ผู้อำนวยการโรงเรียน' },
      ]),
    ]);
    frag.appendChild(page1);

    /* ---- หน้าที่ 2: คะแนนรายตัวชี้วัดของผู้เยี่ยมแต่ละคน ---- */
    const detail = el('table', { class: 'pd-table' });
    const dHead = el('tr', {}, [
      el('th', { class: 'pd-num', text: 'ข้อที่' }),
      el('th', { text: 'รายการประเมิน' }),
    ]);
    data.evaluations.forEach((e, i) => dHead.appendChild(el('th', { text: `ครั้งที่ ${i + 1}` })));
    dHead.appendChild(el('th', { text: 'เฉลี่ย' }));
    dHead.appendChild(el('th', { text: 'ระดับคุณภาพ' }));
    detail.appendChild(el('thead', {}, dHead));

    const dBody = el('tbody');
    const detailCols = 2 + data.evaluations.length + 2;
    numberRows(data.indicators).forEach((item) => {
      if (item.isFirstOfGroup) dBody.appendChild(groupRow(detailCols, item.groupIndex, item.groupName));
      const ind = item.row;
      const tr = el('tr', {}, [
        el('td', { class: 'pd-c', text: item.label }),
        el('td', { text: ind.indicatorName }),
      ]);
      data.evaluations.forEach((e) => {
        const v = ind.scores[e.id];
        tr.appendChild(el('td', { class: 'pd-c', text: v === undefined ? '-' : String(v) }));
      });
      tr.appendChild(el('td', { class: 'pd-c pd-b', text: num(ind.averageScore, 2) }));
      tr.appendChild(el('td', { class: 'pd-c', text: ind.qualityLevel }));
      dBody.appendChild(tr);
    });
    detail.appendChild(dBody);

    const page2 = el('div', { class: 'pd-page' }, [
      docHead(settings, 'สรุปคะแนนรายตัวชี้วัด'),
      el('div', { class: 'pd-meta' }, [
        metaRow([
          ['ผู้รับการเยี่ยมชั้นเรียน', s.teacherName],
          ['ชั้นเรียน', s.classroomName],
          ['ภาคเรียน', s.semesterName],
          ['ปีการศึกษา', s.academicYearName],
        ]),
      ]),
      detail,
    ]);

    /* ข้อคิดเห็นจากผู้เยี่ยมทุกคน */
    page2.appendChild(el('p', { class: 'pd-section-title', text: 'ข้อคิดเห็น / ข้อเสนอแนะจากผู้เยี่ยมชั้นเรียน' }));
    data.evaluations.forEach((e, i) => {
      page2.appendChild(el('div', { class: 'pd-comment', style: 'min-height:auto;margin-bottom:6px' }, [
        el('div', { class: 'pd-label', text: `ครั้งที่ ${i + 1} — ${e.visitorName} (${thaiDate(e.visitDate)})` }),
        el('div', { text: e.comment || '-' }),
      ]));
    });
    frag.appendChild(page2);

    /* ---- หน้ารูปภาพ ---- */
    if (data.images.length) {
      frag.appendChild(photoPage(
        settings,
        'ภาพประกอบการตรวจเยี่ยมชั้นเรียน',
        el('div', { class: 'pd-meta' }, [
          metaRow([['ผู้รับการเยี่ยมชั้นเรียน', s.teacherName], ['ชั้นเรียน', s.classroomName]]),
        ]),
        data.images.map((img) => ({ imageUrl: img.imageUrl, caption: `${img.visitorName} · ${thaiDate(img.visitDate, 'short')}` }))
      ));
    }
    return frag;
  }

  /* =======================================================================
     เอกสารที่ 3 — สรุปผลการเยี่ยมชั้นเรียนทั้งโรงเรียน (รายชื่อทั้งหมด)
     ======================================================================= */
  function buildSummaryListDoc(rows, meta, settings) {
    const frag = document.createDocumentFragment();

    const table = el('table', { class: 'pd-table' });
    table.appendChild(el('thead', {}, el('tr', {}, [
      el('th', { class: 'pd-num', text: 'ที่' }),
      el('th', { text: 'ผู้รับการเยี่ยมชั้นเรียน' }),
      el('th', { text: 'ตำแหน่ง' }),
      el('th', { text: 'ชั้นเรียน' }),
      el('th', { text: 'ระดับการศึกษา' }),
      el('th', { text: 'จำนวนผู้เยี่ยม' }),
      el('th', { text: 'คะแนนเฉลี่ย' }),
      el('th', { text: 'ร้อยละเฉลี่ย' }),
      el('th', { text: 'ระดับคุณภาพ' }),
    ])));
    const tbody = el('tbody');
    rows.forEach((r, i) => {
      tbody.appendChild(el('tr', {}, [
        el('td', { class: 'pd-c', text: String(i + 1) }),
        el('td', { text: r.teacherName }),
        el('td', { text: r.teacherPosition || '-' }),
        el('td', { class: 'pd-c', text: r.classroomName }),
        el('td', { class: 'pd-c', text: r.educationLevel || '-' }),
        el('td', { class: 'pd-c', text: `${num(r.visitCount)} คน` }),
        el('td', { class: 'pd-c', text: `${num(r.averageTotalScore, 2)}/${num(r.averageMaximumScore)}` }),
        el('td', { class: 'pd-c pd-b', text: num(r.averagePercentage, 2) }),
        el('td', { class: 'pd-c', text: r.qualityLevel }),
      ]));
    });
    table.appendChild(tbody);

    frag.appendChild(el('div', { class: 'pd-page' }, [
      docHead(settings, 'แบบบันทึกสรุปผลการเยี่ยมชั้นเรียน',
        `${meta.semesterName}  ปีการศึกษา ${meta.academicYearName}`),
      table,
      el('div', { class: 'pd-box' },
        el('div', { class: 'pd-summary-row' }, [
          el('span', { text: `รวมทั้งสิ้น ${num(rows.length)} รายการ` }),
          el('span', {
            text: `ร้อยละเฉลี่ยรวม ${num(rows.length ? rows.reduce((a, b) => a + b.averagePercentage, 0) / rows.length : 0, 2)}`,
          }),
        ])),
      signBlock([{ name: '', position: '', role: 'ผู้อำนวยการโรงเรียน' }]),
    ]));
    return frag;
  }

  /* =======================================================================
     ตัวสั่งพิมพ์ — รอให้รูปภาพโหลดครบก่อนเปิดหน้าต่างพิมพ์
     ======================================================================= */
  async function printDocument(fragment, title) {
    const root = printRoot();
    clear(root);
    root.appendChild(fragment);

    const previousTitle = document.title;
    if (title) document.title = title; // ใช้เป็นชื่อไฟล์เริ่มต้นตอนบันทึก PDF

    const images = Array.from(root.querySelectorAll('img'));
    if (images.length) {
      A.showLoading('กำลังเตรียมเอกสารสำหรับพิมพ์...');
      await Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }))));
      A.hideLoading(true);
    }

    // คืนชื่อหน้าเดิมเมื่อพิมพ์เสร็จ (มี timeout สำรองเผื่อบางเบราว์เซอร์ไม่ยิง afterprint)
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      document.title = previousTitle;
    };
    window.addEventListener('afterprint', restore, { once: true });
    setTimeout(restore, 60000);

    setTimeout(() => window.print(), 60);
  }

  /* =======================================================================
     ตัวแสดงเอกสารบนหน้าจอ — เห็นหน้ากระดาษ A4 ก่อนสั่งพิมพ์หรือบันทึก PDF
     ======================================================================= */
  const A4_WIDTH_PX = 794; // 210mm ที่ 96dpi

  function previewDocument(fragment, title) {
    const backdrop = el('div', {
      class: 'pdv-backdrop',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title || 'ตัวอย่างเอกสาร',
    });

    const stage = el('div', { class: 'pdv-stage' });
    stage.appendChild(fragment);
    const pageCount = stage.querySelectorAll('.pd-page').length;

    // sizer กำหนดพื้นที่จริงหลังย่อ/ขยาย (transform ไม่เปลี่ยนขนาด layout)
    const sizer = el('div', { class: 'pdv-sizer' }, stage);
    const scroll = el('div', { class: 'pdv-scroll' }, sizer);

    /* ---- ซูม ---- */
    let zoom = 1;
    const zoomLabel = el('span', { text: '100%' });

    function applyZoom() {
      stage.style.transform = `scale(${zoom})`;
      sizer.style.width = `${A4_WIDTH_PX * zoom}px`;
      sizer.style.height = `${stage.offsetHeight * zoom}px`;
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    }

    function setZoom(value) {
      zoom = Math.min(2, Math.max(0.3, Math.round(value * 100) / 100));
      applyZoom();
    }

    /** ย่อให้พอดีความกว้างจอ (สำคัญมากบนมือถือ) */
    function fitWidth() {
      const available = scroll.clientWidth - 24;
      setZoom(Math.min(1, available / A4_WIDTH_PX));
    }

    /* ---- แถบเครื่องมือ ---- */
    const printBtn = el('button', {
      type: 'button',
      class: 'pdv-btn pdv-btn-primary',
      html: `${icon('print', 'h-4 w-4')}<span>พิมพ์ / บันทึก PDF</span>`,
      onclick: () => {
        // โคลนเนื้อหาที่เห็นอยู่ไปพิมพ์ เพื่อให้ได้เอกสารตรงกับที่แสดงบนจอ
        const clone = document.createDocumentFragment();
        Array.from(stage.children).forEach((n) => clone.appendChild(n.cloneNode(true)));
        printDocument(clone, title);
      },
    });

    const closeBtn = el('button', {
      type: 'button',
      class: 'pdv-btn pdv-btn-icon',
      'aria-label': 'ปิด',
      title: 'ปิด (Esc)',
      html: icon('close', 'h-5 w-5'),
      onclick: () => close(),
    });

    const toolbar = el('div', { class: 'pdv-toolbar' }, [
      el('span', { class: 'pdv-title', text: title || 'ตัวอย่างเอกสาร' }),
      el('span', { class: 'pdv-pages', text: `${pageCount} หน้า` }),
      el('div', { class: 'pdv-zoom' }, [
        el('button', { type: 'button', 'aria-label': 'ย่อ', text: '−', onclick: () => setZoom(zoom - 0.1) }),
        zoomLabel,
        el('button', { type: 'button', 'aria-label': 'ขยาย', text: '+', onclick: () => setZoom(zoom + 0.1) }),
      ]),
      el('button', { type: 'button', class: 'pdv-btn', text: 'พอดีความกว้าง', onclick: fitWidth }),
      printBtn,
      closeBtn,
    ]);

    backdrop.appendChild(toolbar);
    backdrop.appendChild(scroll);

    function onKey(e) {
      if (e.key === 'Escape') close();
      else if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); printBtn.click(); }
    }

    function onResize() { if (scroll.clientWidth - 24 < A4_WIDTH_PX) fitWidth(); }

    function close() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = '';
      backdrop.remove();
    }

    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    // เริ่มต้นให้พอดีความกว้างเมื่อจอเล็กกว่ากระดาษ A4
    fitWidth();
    closeBtn.focus();

    return { close, stage };
  }

  /** เปิดตัวอย่างเอกสาร โดยรอให้รูปภาพโหลดเสร็จก่อน */
  async function showDocument(fragment, title) {
    A.showLoading('กำลังจัดเตรียมเอกสาร...');
    const holder = el('div');
    holder.appendChild(fragment);
    const images = Array.from(holder.querySelectorAll('img'));
    await Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }))));
    A.hideLoading(true);

    const ready = document.createDocumentFragment();
    Array.from(holder.children).forEach((n) => ready.appendChild(n));
    return previewDocument(ready, title);
  }

  A.previewDocument = previewDocument;
  A.showDocument = showDocument;
  A.buildEvaluationDoc = buildEvaluationDoc;
  A.buildSummaryDetailDoc = buildSummaryDetailDoc;
  A.buildSummaryListDoc = buildSummaryListDoc;
  A.printDocument = printDocument;
})(window);
