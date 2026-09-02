/* หน้ารายละเอียดสรุปผลการเยี่ยมชั้นเรียน (เฉลี่ยจากผู้เยี่ยมทุกคนในกลุ่มเดียวกัน) */
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

  function scoreChip(score, muted) {
    if (score === null || score === undefined) return el('span', { class: 'text-slate-300', text: '-' });
    return el('span', {
      class: 'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white',
      style: `background:${muted ? '#cbd5e1' : (A.SCORE_COLORS[score] || '#94a3b8')}${score === 3 && !muted ? ';color:#5A3B00' : ''}`,
      text: String(score),
    });
  }

  async function load() {
    const q = new URLSearchParams(location.search);
    const required = ['semesterId', 'academicYearId', 'classroomTeacherId', 'classroomId'];
    clear(view());
    view().appendChild(A.skeletonRows(8, 4));

    if (required.some((k) => !q.get(k))) {
      clear(view());
      view().appendChild(A.errorState('ข้อมูลอ้างอิงไม่ครบถ้วน กรุณากลับไปเลือกรายการจากหน้าสรุปผลอีกครั้ง'));
      return;
    }

    let data;
    try {
      data = (await A.api(`/api/admin/summary/detail?${required.map((k) => `${k}=${encodeURIComponent(q.get(k))}`).join('&')}`)).data;
    } catch (err) {
      clear(view());
      view().appendChild(A.errorState(err.message, load));
      return;
    }

    clear(view());
    const wrap = el('div', { class: 'space-y-4' });
    const s = data.scope;

    /* ---- ข้อมูลกลุ่ม ---- */
    wrap.appendChild(el('section', { class: 'card card-pad' }, [
      el('div', { class: 'mb-4 flex flex-wrap items-start justify-between gap-3' }, [
        el('div', {}, [
          el('h2', { class: 'text-lg font-extrabold text-plum', text: s.teacherName }),
          el('p', { class: 'text-xs text-slate-500', text: `${s.teacherPosition || ''} · ชั้นเรียน ${s.classroomName}` }),
        ]),
        el('div', { class: 'flex gap-2 no-print' }, [
          el('button', { type: 'button', class: 'btn-secondary btn-sm', html: `${icon('print', 'h-4 w-4')}<span>ดูเอกสาร / พิมพ์ PDF</span>`, onclick: () => A.showDocument(A.buildSummaryDetailDoc(data, settings), `แบบบันทึกสรุปการตรวจเยี่ยมชั้นเรียน ${s.teacherName}`) }),
          el('a', { href: '/admin#/summary', class: 'btn-secondary btn-sm', html: `${icon('back', 'h-4 w-4')}<span>กลับไปหน้าสรุปผล</span>` }),
        ]),
      ]),
      el('div', { class: 'grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4' }, [
        infoItem('ภาคเรียน', s.semesterName),
        infoItem('ปีการศึกษา', s.academicYearName),
        infoItem('ชั้นเรียน', s.classroomName),
        infoItem('จำนวนผู้เยี่ยมชั้นเรียนทั้งหมด', `${A.num(data.summary.visitCount)} คน`),
      ]),
    ]));

    /* ---- รายชื่อผู้เยี่ยมและวันที่ ---- */
    const visitorTable = el('table', { class: 'table' });
    visitorTable.appendChild(el('thead', {}, el('tr', {}, [
      el('th', { class: 'w-14 text-center', text: 'ที่' }),
      el('th', { text: 'ผู้เยี่ยมชั้นเรียน' }),
      el('th', { text: 'วันที่ประเมิน' }),
      el('th', { class: 'text-center', text: 'คะแนนรวม' }),
      el('th', { class: 'text-center', text: 'ร้อยละ' }),
      el('th', { class: 'text-center', text: 'ระดับคุณภาพ' }),
      el('th', { class: 'w-24 text-center no-print', text: 'รายละเอียด' }),
    ])));
    const vBody = el('tbody');
    data.evaluations.forEach((e, i) => {
      vBody.appendChild(el('tr', {}, [
        el('td', { class: 'text-center text-slate-500', text: String(i + 1) }),
        el('td', {}, [
          el('p', { class: 'font-semibold text-slate-700', text: e.visitorName }),
          el('p', { class: 'text-xs text-slate-400', text: `${e.visitorPosition || ''} · ${e.referenceNumber}` }),
        ]),
        el('td', { class: 'whitespace-nowrap', text: A.thaiDate(e.visitDate) }),
        el('td', { class: 'whitespace-nowrap text-center font-bold text-plum', text: `${A.num(e.totalScore)}/${A.num(e.maximumScore)}` }),
        el('td', { class: 'text-center font-bold', text: `${A.num(e.percentage, 2)}%` }),
        el('td', { class: 'text-center' }, el('span', { class: A.qualityBadge(e.qualityLevel), text: e.qualityLevel })),
        el('td', { class: 'text-center no-print' }, el('a', {
          href: `/admin/evaluation?id=${e.id}`, class: 'icon-btn text-[#0288D1] hover:bg-[#0288D1]/10',
          title: 'ดูรายละเอียดการประเมินครั้งนี้', 'aria-label': 'ดูรายละเอียด', html: icon('eye', 'h-4 w-4'),
        })),
      ]));
    });
    visitorTable.appendChild(vBody);
    wrap.appendChild(el('section', { class: 'card' }, [
      el('div', { class: 'border-b border-slate-100 px-4 py-3 sm:px-6' },
        el('h3', { class: 'text-sm font-bold text-plum', text: 'รายชื่อผู้เยี่ยมชั้นเรียนและวันที่ประเมิน' })),
      el('div', { class: 'table-wrap px-4 py-2 sm:px-6' }, visitorTable),
    ]));

    /* ---- Summary cards ---- */
    wrap.appendChild(el('div', { class: 'grid gap-3 sm:grid-cols-3' }, [
      el('div', { class: 'stat-card border-l-4 border-l-brand-500' }, [
        el('p', { class: 'text-xs font-semibold text-slate-500', text: 'คะแนนรวมเฉลี่ยจากผู้เยี่ยมทั้งหมด' }),
        el('p', { class: 'mt-1 text-3xl font-extrabold text-brand-500' }, [
          el('span', { text: A.num(data.summary.averageTotalScore, 2) }),
          el('span', { class: 'text-lg font-bold text-slate-400', text: `/${A.num(data.summary.averageMaximumScore)}` }),
        ]),
        el('p', { class: 'mt-1 text-xs text-slate-400', text: `เฉลี่ยจากผู้เยี่ยม ${A.num(data.summary.visitCount)} คน` }),
      ]),
      el('div', { class: 'stat-card border-l-4 border-l-[#0288D1]' }, [
        el('p', { class: 'text-xs font-semibold text-slate-500', text: 'ร้อยละเฉลี่ย' }),
        el('p', { class: 'mt-1 text-3xl font-extrabold text-[#0288D1]', text: `${A.num(data.summary.averagePercentage, 2)}%` }),
      ]),
      el('div', { class: 'stat-card border-l-4 border-l-teal-500' }, [
        el('p', { class: 'text-xs font-semibold text-slate-500', text: 'ระดับคุณภาพ' }),
        el('p', { class: 'mt-2' }, el('span', { class: `${A.qualityBadge(data.summary.qualityLevel)} text-base`, text: data.summary.qualityLevel })),
      ]),
    ]));

    /* ---- ตารางสรุปรายตัวชี้วัด ---- */
    const table = el('table', { class: 'table' });
    const headRow = el('tr', {}, [
      el('th', { class: 'w-14 text-center', text: 'ลำดับ' }),
      el('th', { text: 'รายการตัวชี้วัด' }),
    ]);
    data.evaluations.forEach((e) => headRow.appendChild(el('th', { class: 'w-28 text-center', text: e.visitorName })));
    headRow.appendChild(el('th', { class: 'w-28 text-center', text: 'คะแนนเฉลี่ย' }));
    headRow.appendChild(el('th', { class: 'w-32 text-center', text: 'ระดับคุณภาพ' }));
    table.appendChild(el('thead', {}, headRow));

    const tbody = el('tbody');
    data.indicators.forEach((ind, i) => {
      const tr = el('tr', {}, [
        el('td', { class: 'text-center text-slate-500', text: String(i + 1) }),
        el('td', { class: 'min-w-[18rem] leading-relaxed', text: ind.indicatorName }),
      ]);
      data.evaluations.forEach((e) => {
        const score = ind.scores[e.id];
        tr.appendChild(el('td', { class: 'text-center' }, scoreChip(score === undefined ? null : score)));
      });
      tr.appendChild(el('td', { class: 'text-center font-extrabold text-plum', text: A.num(ind.averageScore, 2) }));
      tr.appendChild(el('td', { class: 'text-center' }, el('span', { class: A.qualityBadge(ind.qualityLevel), text: ind.qualityLevel })));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(el('section', { class: 'card' }, [
      el('div', { class: 'border-b border-slate-100 px-4 py-3 sm:px-6' }, [
        el('h3', { class: 'text-sm font-bold text-plum', text: 'ตารางสรุปคะแนนรายตัวชี้วัด' }),
        el('p', { class: 'text-xs text-slate-500', text: 'แสดงคะแนนของผู้เยี่ยมแต่ละคน พร้อมคะแนนเฉลี่ยและระดับคุณภาพของตัวชี้วัด' }),
      ]),
      el('div', { class: 'table-wrap px-4 py-2 sm:px-6' }, table),
    ]));

    /* ---- ข้อคิดเห็นทั้งหมด ---- */
    const comments = el('section', { class: 'card card-pad' }, [
      el('h3', { class: 'section-title mb-3' }, [
        el('span', { class: 'flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-500', html: icon('doc', 'h-4 w-4') }),
        el('span', { text: 'ข้อคิดเห็น/ข้อเสนอแนะจากผู้เยี่ยมทุกคน' }),
      ]),
    ]);
    const commentList = el('div', { class: 'space-y-3' });
    data.evaluations.forEach((e) => {
      commentList.appendChild(el('article', { class: 'rounded-xl border border-slate-100 bg-slate-50/70 p-4' }, [
        el('div', { class: 'mb-1.5 flex flex-wrap items-center gap-2' }, [
          el('span', { class: 'chip bg-white', text: e.visitorName }),
          el('span', { class: 'text-xs text-slate-400', text: `ประเมินเมื่อ ${A.thaiDate(e.visitDate)}` }),
        ]),
        el('p', { class: 'whitespace-pre-line text-sm leading-relaxed text-slate-700', text: e.comment || '-' }),
      ]));
    });
    comments.appendChild(commentList);
    wrap.appendChild(comments);

    /* ---- Gallery ---- */
    const gallery = el('section', { class: 'card card-pad' }, [
      el('h3', { class: 'section-title mb-3' }, [
        el('span', { class: 'flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-500', html: icon('image', 'h-4 w-4') }),
        el('span', { text: `รูปภาพการเยี่ยมชั้นเรียนทั้งหมด (${data.images.length} รูป)` }),
      ]),
    ]);
    if (!data.images.length) {
      gallery.appendChild(el('p', { class: 'rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400', text: 'ไม่มีรูปภาพประกอบในกลุ่มการประเมินนี้' }));
    } else {
      const items = data.images.map((img) => ({ src: img.imageUrl, caption: `${img.visitorName} · ${A.thaiDate(img.visitDate)} · ${img.referenceNumber}` }));
      const grid = el('div', { class: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' });
      data.images.forEach((img, i) => {
        grid.appendChild(el('figure', { class: 'overflow-hidden rounded-xl border border-slate-200 bg-white' }, [
          el('button', {
            type: 'button', class: 'block w-full', 'aria-label': 'ดูรูปขนาดใหญ่',
            onclick: () => A.openLightbox(items, i),
          }, el('img', { src: img.imageUrl, alt: img.fileName, loading: 'lazy', class: 'h-32 w-full object-cover transition hover:scale-105' })),
          el('figcaption', { class: 'px-2 py-1.5 text-[11px] leading-tight text-slate-500', text: `${img.visitorName} · ${A.thaiDate(img.visitDate, 'short')}` }),
        ]));
      });
      gallery.appendChild(grid);
    }
    wrap.appendChild(gallery);

    view().appendChild(wrap);
    document.title = `${s.teacherName} | สรุปผลการเยี่ยมชั้นเรียน`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    A.hydrateIcons();
    try { settings = await A.loadSettings(); A.applyBranding(settings); } catch { /* ไม่ขัดขวางการแสดงผล */ }
    load();
  });
})();
