/* หน้ารายละเอียดผลการเยี่ยมชั้นเรียน (หน้าเฉพาะ ไม่ใช่ Modal) */
(function () {
  'use strict';
  const A = window.App;
  const { $, el, icon, clear } = A;

  let settings = null;

  const view = () => $('#view');

  function infoItem(label, value) {
    return el('div', { class: 'rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5' }, [
      el('p', { class: 'text-[11px] font-semibold uppercase tracking-wide text-slate-400', text: label }),
      el('p', { class: 'mt-0.5 text-sm font-semibold text-slate-700', text: value || '-' }),
    ]);
  }

  function statCard(label, valueNode, accent, sub) {
    return el('div', { class: `stat-card border-l-4 ${accent}` }, [
      el('p', { class: 'text-xs font-semibold text-slate-500', text: label }),
      valueNode,
      sub ? el('p', { class: 'mt-1 text-xs text-slate-400', text: sub }) : null,
    ]);
  }

  function scoreChip(score) {
    return el('span', {
      class: 'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white',
      style: `background:${A.SCORE_COLORS[score] || '#94a3b8'}${score === 3 ? ';color:#5A3B00' : ''}`,
      text: String(score),
    });
  }

  async function load() {
    const id = new URLSearchParams(location.search).get('id');
    clear(view());
    view().appendChild(A.skeletonRows(8, 3));

    if (!id) {
      clear(view());
      view().appendChild(A.errorState('ไม่พบเลขอ้างอิงของรายการที่ต้องการดู'));
      return;
    }

    let data;
    try {
      data = (await A.api(`/api/admin/evaluations/${id}`)).data;
    } catch (err) {
      clear(view());
      view().appendChild(A.errorState(err.message, load));
      return;
    }

    clear(view());
    const wrap = el('div', { class: 'space-y-4' });

    /* ---- ข้อมูลทั่วไป ---- */
    const head = el('section', { class: 'card card-pad' }, [
      el('div', { class: 'mb-4 flex flex-wrap items-start justify-between gap-3' }, [
        el('div', {}, [
          el('p', { class: 'text-xs font-semibold text-slate-400', text: 'เลขอ้างอิงรายการประเมิน' }),
          el('p', { class: 'font-mono text-lg font-extrabold text-brand-600', text: data.referenceNumber }),
        ]),
        el('div', { class: 'flex gap-2 no-print' }, [
          el('button', {
            type: 'button', class: 'btn-secondary btn-sm',
            html: `${icon('print', 'h-4 w-4')}<span>ดูเอกสาร / พิมพ์ PDF</span>`,
            onclick: () => A.showDocument(
              A.buildEvaluationDoc(data, settings),
              `แบบบันทึกการตรวจเยี่ยมชั้นเรียน ${data.teacherName} ${data.referenceNumber}`
            ),
          }),
          el('a', { href: '/admin#/evaluations', class: 'btn-secondary btn-sm', html: `${icon('back', 'h-4 w-4')}<span>กลับไปรายการทั้งหมด</span>` }),
        ]),
      ]),
      el('div', { class: 'grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4' }, [
        infoItem('วันที่ประเมิน', A.thaiDate(data.visitDate)),
        infoItem('ภาคเรียน', data.semesterName),
        infoItem('ปีการศึกษา', data.academicYearName),
        infoItem('ชั้นเรียน', data.classroomName),
        infoItem('ผู้รับผิดชอบชั้นเรียน', data.teacherName),
        infoItem('ตำแหน่ง (ผู้รับการเยี่ยม)', data.teacherPosition),
        infoItem('ผู้เยี่ยมชั้นเรียน', data.visitorName),
        infoItem('ตำแหน่ง (ผู้เยี่ยม)', data.visitorPosition),
        infoItem('ระดับการศึกษา', data.educationLevel),
        data.subjectName ? infoItem('วิชา', data.subjectName) : null,
        data.subjectCode ? infoItem('รหัสวิชา', data.subjectCode) : null,
        data.learningAreaSnapshot ? infoItem('กลุ่มสาระการเรียนรู้', data.learningAreaSnapshot) : null,
      ]),
    ]);
    wrap.appendChild(head);

    /* ---- Summary cards ---- */
    wrap.appendChild(el('div', { class: 'grid gap-3 sm:grid-cols-3' }, [
      statCard('คะแนนรวม',
        el('p', { class: 'mt-1 text-3xl font-extrabold text-brand-500' }, [
          el('span', { text: A.num(data.totalScore) }),
          el('span', { class: 'text-lg font-bold text-slate-400', text: `/${A.num(data.maximumScore)}` }),
        ]),
        'border-l-brand-500', `จากตัวชี้วัด ${data.scores.length} ข้อ`),
      statCard('ร้อยละ',
        el('p', { class: 'mt-1 text-3xl font-extrabold text-[#0288D1]', text: `${A.num(data.percentage, 2)}%` }),
        'border-l-[#0288D1]'),
      statCard('ระดับคุณภาพ',
        el('p', { class: 'mt-2' }, el('span', { class: `${A.qualityBadge(data.qualityLevel)} text-base`, text: data.qualityLevel })),
        'border-l-teal-500'),
    ]));

    /* ---- ตารางรายละเอียด ---- */
    const table = el('table', { class: 'table min-w-[52rem]' });
    table.appendChild(el('thead', {}, el('tr', {}, [
      el('th', { class: 'w-16 text-center', text: 'ข้อที่' }),
      el('th', { text: 'รายการตัวชี้วัด' }),
      el('th', { class: 'w-36 text-center', text: 'การดำเนินการ' }),
      el('th', { class: 'w-24 text-center', text: 'คะแนน' }),
      el('th', { class: 'w-52 text-center', text: 'ระดับของคะแนน' }),
    ])));
    const tbody = el('tbody');

    // จัดเลขข้อแบบ "กลุ่ม.ลำดับ" และแทรกแถวหัวข้อกลุ่ม
    let groupIndex = 0;
    let itemIndex = 0;
    let currentGroup = null;
    let plainIndex = 0;

    data.scores.forEach((s) => {
      const groupName = s.groupSnapshot || null;
      let label;
      if (groupName) {
        if (groupName !== currentGroup) {
          currentGroup = groupName;
          groupIndex += 1;
          itemIndex = 0;
          tbody.appendChild(el('tr', { class: 'group-row' },
            el('td', { colspan: 5 }, [
              el('span', { class: 'mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-500 text-xs text-white', text: String(groupIndex) }),
              el('span', { text: groupName }),
            ])));
        }
        itemIndex += 1;
        label = `${groupIndex}.${itemIndex}`;
      } else {
        currentGroup = null;
        plainIndex += 1;
        label = String(plainIndex);
      }

      tbody.appendChild(el('tr', {}, [
        el('td', { class: 'whitespace-nowrap text-center text-slate-500', text: label }),
        el('td', { class: 'min-w-[18rem] leading-relaxed', text: s.indicatorSnapshot }),
        el('td', { class: 'text-center' },
          el('span', { class: A.practiceBadge(s.practice), text: A.practiceLabel(s.practice) })),
        el('td', { class: 'text-center' }, scoreChip(s.score)),
        el('td', { class: 'text-center text-sm text-slate-600', text: A.SCORE_LABELS[s.score] || '-' }),
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(el('section', { class: 'card' }, [
      el('div', { class: 'border-b border-slate-100 px-4 py-3 sm:px-6' },
        el('h2', { class: 'text-sm font-bold text-plum sm:text-base', text: 'รายละเอียดคะแนนรายตัวชี้วัด' })),
      el('div', { class: 'table-wrap px-4 py-2 sm:px-6' }, table),
    ]));

    /* ---- ข้อคิดเห็น ---- */
    wrap.appendChild(el('section', { class: 'card card-pad' }, [
      el('h2', { class: 'section-title mb-3' }, [
        el('span', { class: 'flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-500', html: icon('doc', 'h-4 w-4') }),
        el('span', { text: 'ข้อคิดเห็น/ข้อเสนอแนะ' }),
      ]),
      el('p', { class: 'whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700', text: data.comment || '-' }),
    ]));

    /* ---- รูปภาพ ---- */
    const gallery = el('section', { class: 'card card-pad' }, [
      el('h2', { class: 'section-title mb-3' }, [
        el('span', { class: 'flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-500', html: icon('image', 'h-4 w-4') }),
        el('span', { text: `รูปภาพการเยี่ยมชั้นเรียน (${data.images.length} รูป)` }),
      ]),
    ]);
    if (!data.images.length) {
      gallery.appendChild(el('p', { class: 'rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400', text: 'ไม่มีรูปภาพประกอบการประเมินครั้งนี้' }));
    } else {
      const items = data.images.map((img) => ({ src: img.imageUrl, caption: img.fileName }));
      const grid = el('div', { class: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' });
      data.images.forEach((img, i) => {
        grid.appendChild(el('button', {
          type: 'button',
          class: 'group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-card',
          'aria-label': `ดูรูป ${img.fileName} ขนาดใหญ่`,
          onclick: () => A.openLightbox(items, i),
        }, el('img', { src: img.imageUrl, alt: img.fileName, loading: 'lazy', class: 'h-32 w-full object-cover transition group-hover:scale-105' })));
      });
      gallery.appendChild(grid);
    }
    wrap.appendChild(gallery);

    view().appendChild(wrap);
    document.title = `${data.referenceNumber} | รายละเอียดผลการเยี่ยมชั้นเรียน`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    A.hydrateIcons();
    try { settings = await A.loadSettings(); A.applyBranding(settings); } catch { /* ไม่ขัดขวางการแสดงผล */ }
    load();
  });
})();
