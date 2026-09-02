/* หน้าผู้ดูแลระบบ — Router, Sidebar, แดชบอร์ด, ตั้งค่าระบบ, จัดการข้อมูลพื้นฐาน, ผลการเยี่ยม และสรุปผล */
(function () {
  'use strict';
  const A = window.App;
  const { $, $$, el, icon, clear } = A;

  /* ================= ค่ากำหนดของเมนูจัดการข้อมูลพื้นฐาน ================= */
  const MASTERS = {
    semesters: {
      title: 'จัดการภาคเรียน', icon: 'calendar', singular: 'ภาคเรียน',
      columns: [{ key: 'name', label: 'ชื่อภาคเรียน' }],
      fields: [{ name: 'name', label: 'ชื่อภาคเรียน', type: 'text', required: true, placeholder: 'เช่น ภาคเรียนที่ 1' }],
    },
    'academic-years': {
      title: 'จัดการปีการศึกษา', icon: 'academic', singular: 'ปีการศึกษา',
      columns: [{ key: 'name', label: 'ชื่อปีการศึกษา' }],
      fields: [{ name: 'name', label: 'ชื่อปีการศึกษา', type: 'text', required: true, placeholder: 'เช่น 2569' }],
    },
    'classroom-teachers': {
      title: 'จัดการผู้รับผิดชอบชั้นเรียน', icon: 'user', singular: 'ผู้รับผิดชอบชั้นเรียน',
      columns: [{ key: 'fullName', label: 'ชื่อ-นามสกุล' }, { key: 'position', label: 'ตำแหน่ง' }],
      fields: [
        { name: 'fullName', label: 'ชื่อ-นามสกุล', type: 'text', required: true, placeholder: 'เช่น นางสาวศิริพร ใจดี' },
        { name: 'position', label: 'ตำแหน่ง', type: 'text', placeholder: 'เช่น ครูชำนาญการ' },
      ],
    },
    visitors: {
      title: 'จัดการผู้เยี่ยมชั้นเรียน', icon: 'users', singular: 'ผู้เยี่ยมชั้นเรียน',
      columns: [{ key: 'fullName', label: 'ชื่อ-นามสกุล' }, { key: 'position', label: 'ตำแหน่ง' }],
      fields: [
        { name: 'fullName', label: 'ชื่อ-นามสกุลผู้เยี่ยมชั้นเรียน', type: 'text', required: true, placeholder: 'เช่น นายสมชาย ผู้บริหาร' },
        { name: 'position', label: 'ตำแหน่ง', type: 'text', placeholder: 'เช่น ผู้อำนวยการโรงเรียน' },
      ],
    },
    classrooms: {
      title: 'จัดการชั้นเรียน', icon: 'building', singular: 'ชั้นเรียน',
      columns: [{ key: 'name', label: 'ชื่อชั้นเรียน' }, { key: 'sortOrder', label: 'ลำดับการแสดงผล', align: 'center' }],
      fields: [
        { name: 'name', label: 'ชื่อชั้นเรียน', type: 'text', required: true, placeholder: 'เช่น ประถมศึกษาปีที่ 1' },
        { name: 'sortOrder', label: 'ลำดับการแสดงผล', type: 'number', placeholder: 'เว้นว่างเพื่อต่อท้ายอัตโนมัติ' },
      ],
    },
    indicators: {
      title: 'จัดการแบบเยี่ยมชั้นเรียน', icon: 'list', singular: 'รายการตัวชี้วัด', reorder: true,
      columns: [
        { key: 'sortOrder', label: 'ลำดับ', align: 'center', width: 'w-20' },
        { key: 'groupName', label: 'หัวข้อกลุ่ม', width: 'w-56' },
        { key: 'indicatorName', label: 'รายการตัวชี้วัด' },
      ],
      fields: [
        { name: 'indicatorName', label: 'ชื่อรายการตัวชี้วัด', type: 'textarea', required: true, placeholder: 'เช่น มีความสะอาด เป็นระเบียบ และถูกสุขลักษณะภายในห้องเรียน' },
        { name: 'groupId', label: 'หัวข้อกลุ่ม', type: 'select', source: 'indicator-groups', placeholder: 'ไม่อยู่ในกลุ่มใด' },
        { name: 'sortOrder', label: 'ลำดับภายในกลุ่ม', type: 'number', placeholder: 'เว้นว่างเพื่อต่อท้ายอัตโนมัติ' },
      ],
    },
    'indicator-groups': {
      title: 'จัดการหัวข้อกลุ่มตัวชี้วัด', icon: 'clipboard', singular: 'หัวข้อกลุ่มตัวชี้วัด', reorder: true,
      columns: [
        { key: 'sortOrder', label: 'ลำดับ', align: 'center', width: 'w-20' },
        { key: 'name', label: 'ชื่อหัวข้อกลุ่ม' },
      ],
      fields: [
        { name: 'name', label: 'ชื่อหัวข้อกลุ่ม', type: 'text', required: true, placeholder: 'เช่น แผนการจัดการเรียนรู้' },
        { name: 'sortOrder', label: 'ลำดับ', type: 'number', placeholder: 'เว้นว่างเพื่อต่อท้ายอัตโนมัติ' },
      ],
    },
    'learning-areas': {
      title: 'จัดการกลุ่มสาระการเรียนรู้', icon: 'doc', singular: 'กลุ่มสาระการเรียนรู้',
      columns: [{ key: 'name', label: 'ชื่อกลุ่มสาระการเรียนรู้' }],
      fields: [{ name: 'name', label: 'ชื่อกลุ่มสาระการเรียนรู้', type: 'text', required: true, placeholder: 'เช่น ภาษาไทย' }],
    },
  };

  const MENU = [
    { hash: '#/dashboard', label: 'แดชบอร์ด', icon: 'chart' },
    { hash: '#/settings', label: 'ตั้งค่าระบบ', icon: 'settings' },
    { hash: '#/semesters', label: 'จัดการภาคเรียน', icon: 'calendar' },
    { hash: '#/academic-years', label: 'จัดการปีการศึกษา', icon: 'academic' },
    { hash: '#/classroom-teachers', label: 'จัดการผู้รับผิดชอบชั้นเรียน', icon: 'user' },
    { hash: '#/visitors', label: 'จัดการผู้เยี่ยมชั้นเรียน', icon: 'users' },
    { hash: '#/classrooms', label: 'จัดการชั้นเรียน', icon: 'building' },
    { hash: '#/learning-areas', label: 'จัดการกลุ่มสาระการเรียนรู้', icon: 'doc' },
    { hash: '#/indicator-groups', label: 'จัดการหัวข้อกลุ่มตัวชี้วัด', icon: 'clipboard' },
    { hash: '#/indicators', label: 'จัดการแบบเยี่ยมชั้นเรียน', icon: 'list' },
    { hash: '#/evaluations', label: 'ผลการเยี่ยมชั้นเรียนทั้งหมด', icon: 'clipboard' },
    { hash: '#/summary', label: 'สรุปผลการเยี่ยมชั้นเรียน', icon: 'report' },
    { hash: '#logout', label: 'ออกจากระบบ', icon: 'logout', danger: true },
  ];

  const state = { options: null, charts: {} };

  /* ================= Sidebar ================= */
  function buildMenu() {
    const nav = $('#sidebar-menu');
    clear(nav);
    MENU.forEach((item) => {
      const link = el('a', {
        href: item.hash,
        class: 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white',
        dataset: { menu: item.hash },
      });
      link.appendChild(el('span', { class: 'shrink-0', html: icon(item.icon, 'h-5 w-5') }));
      link.appendChild(el('span', { class: 'flex-1 truncate', text: item.label }));
      if (item.danger) link.classList.add('mt-2', 'text-[#FFB4B4]', 'hover:bg-danger-500/20');
      if (item.hash === '#logout') link.addEventListener('click', (e) => { e.preventDefault(); logout(); });
      else link.addEventListener('click', closeSidebar);
      nav.appendChild(link);
    });
  }

  function markActive(hash) {
    $$('[data-menu]').forEach((n) => {
      const active = n.dataset.menu === hash;
      n.classList.toggle('bg-white', active);
      n.classList.toggle('text-brand-600', active);
      n.classList.toggle('shadow-md', active);
      n.classList.toggle('text-white/75', !active && n.dataset.menu !== '#logout');
    });
  }

  const openSidebar = () => {
    $('#sidebar').classList.remove('-translate-x-full');
    $('#sidebar-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };
  const closeSidebar = () => {
    if (window.innerWidth >= 1024) return;
    $('#sidebar').classList.add('-translate-x-full');
    $('#sidebar-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  };

  async function logout() {
    const confirmed = await A.confirmAction('ยืนยันการออกจากระบบ', 'คุณต้องการออกจากระบบผู้ดูแลใช่หรือไม่', 'ออกจากระบบ');
    if (!confirmed) return;
    A.showLoading('กำลังออกจากระบบ...');
    try {
      await A.api('/api/auth/logout', { method: 'POST', skipAuthRedirect: true });
    } catch { /* ถึงแม้เกิดข้อผิดพลาดก็ให้กลับหน้าแรก */ }
    A.hideLoading(true);
    window.location.href = '/';
  }

  /* ================= Helpers ================= */
  function setHeader(title, subtitle) {
    $('#page-title').textContent = title;
    $('#page-subtitle').textContent = subtitle || '';
    document.title = `${title} | ระบบแบบเยี่ยมชั้นเรียน`;
  }

  function card(children, cls) {
    return el('section', { class: `card ${cls || ''}` }, children);
  }

  function toolbar(children) {
    return el('div', { class: 'flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between' }, children);
  }

  function searchBox(placeholder, onInput, value) {
    const wrap = el('div', { class: 'relative w-full sm:max-w-xs' });
    wrap.appendChild(el('span', { class: 'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400', html: icon('search', 'h-4 w-4') }));
    const input = el('input', { type: 'search', class: 'input pl-9', placeholder, value: value || '' });
    input.addEventListener('input', A.debounce(() => onInput(input.value.trim()), 350));
    wrap.appendChild(input);
    return wrap;
  }

  function statusBadge(status) {
    return el('span', { class: status ? 'badge-on' : 'badge-off', text: status ? 'เปิดใช้งาน' : 'ปิดใช้งาน' });
  }

  function iconAction(name, title, cls, onClick) {
    return el('button', {
      type: 'button', class: `icon-btn ${cls}`, title, 'aria-label': title,
      html: icon(name, 'h-4 w-4'), onclick: onClick,
    });
  }

  /** โหลดตัวเลือก (ภาคเรียน/ปีการศึกษา/ครู/ชั้นเรียน) ใช้ร่วมกันหลายหน้า */
  async function loadOptions(force) {
    if (state.options && !force) return state.options;
    const res = await A.api('/api/public/form-data');
    state.options = res.data;
    return state.options;
  }

  function selectField(items, labelKey, value, onChange, placeholder) {
    const sel = el('select', { class: 'input' });
    sel.appendChild(el('option', { value: '', text: placeholder || 'ทั้งหมด' }));
    items.forEach((i) => sel.appendChild(el('option', { value: String(i.id), text: i[labelKey], selected: String(i.id) === String(value) ? true : null })));
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  /* ==================================================================
   * มุมมอง: แดชบอร์ด
   * ================================================================== */
  async function viewDashboard(view) {
    setHeader('แดชบอร์ด', 'ภาพรวมผลการเยี่ยมชั้นเรียนของสถานศึกษา');
    const filters = { semesterId: '', academicYearId: '' };

    const filterBar = card([], 'p-4');
    const statsWrap = el('div', { class: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' });
    const chartsWrap = el('div', { class: 'grid gap-4 xl:grid-cols-2' });
    const recentWrap = el('div');
    view.appendChild(el('div', { class: 'space-y-4' }, [filterBar, statsWrap, chartsWrap, recentWrap]));

    const options = await loadOptions();
    const row = el('div', { class: 'grid gap-3 sm:grid-cols-3' });
    row.appendChild(el('div', {}, [
      el('label', { class: 'label', text: 'ภาคเรียน' }),
      selectField(options.semesters, 'name', '', (v) => { filters.semesterId = v; load(); }, 'ทุกภาคเรียน'),
    ]));
    row.appendChild(el('div', {}, [
      el('label', { class: 'label', text: 'ปีการศึกษา' }),
      selectField(options.academicYears, 'name', '', (v) => { filters.academicYearId = v; load(); }, 'ทุกปีการศึกษา'),
    ]));
    row.appendChild(el('div', { class: 'flex items-end' }, [
      el('button', { class: 'btn-secondary w-full', type: 'button', html: `${icon('refresh', 'h-4 w-4')}<span>โหลดข้อมูลใหม่</span>`, onclick: () => load() }),
    ]));
    filterBar.appendChild(row);

    function statCard(label, value, sub, iconName, color) {
      return el('div', { class: 'stat-card' }, [
        el('div', { class: 'flex items-start justify-between gap-3' }, [
          el('div', {}, [
            el('p', { class: 'text-xs font-semibold text-slate-500', text: label }),
            el('p', { class: 'mt-1 text-2xl font-extrabold text-plum', text: value }),
            sub ? el('p', { class: 'mt-0.5 text-xs text-slate-400', text: sub }) : null,
          ]),
          el('span', { class: `flex h-11 w-11 items-center justify-center rounded-xl ${color}`, html: icon(iconName, 'h-6 w-6') }),
        ]),
      ]);
    }

    /** การ์ดสรุปจำนวนผลการประเมินแยกตามระดับคุณภาพ */
    function qualityBreakdownCard(byQuality) {
      const card_ = el('div', { class: 'stat-card sm:col-span-2 xl:col-span-1' }, [
        el('p', { class: 'text-xs font-semibold text-slate-500', text: 'ผลการประเมินแยกตามระดับคุณภาพ' }),
      ]);
      const list = el('div', { class: 'mt-2 flex flex-wrap gap-1.5' });
      byQuality.forEach((q) => {
        list.appendChild(el('span', { class: A.qualityBadge(q.label) }, [
          el('span', { text: q.label }),
          el('span', { class: 'rounded-full bg-white/35 px-1.5 text-[11px]', text: A.num(q.count) }),
        ]));
      });
      card_.appendChild(list);
      return card_;
    }

    async function load() {
      clear(statsWrap); clear(chartsWrap); clear(recentWrap);
      for (let i = 0; i < 6; i += 1) statsWrap.appendChild(el('div', { class: 'skeleton h-24' }));
      chartsWrap.appendChild(el('div', { class: 'skeleton h-72' }));
      chartsWrap.appendChild(el('div', { class: 'skeleton h-72' }));

      let data;
      try {
        const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
        const res = await A.api(`/api/admin/dashboard${qs ? `?${qs}` : ''}`);
        data = res.data;
      } catch (err) {
        clear(statsWrap); clear(chartsWrap);
        statsWrap.appendChild(A.errorState(err.message, load));
        return;
      }

      const s = data.summary;
      clear(statsWrap);
      [
        statCard('จำนวนผู้รับการเยี่ยมชั้นเรียน', A.num(s.classroomTeachers), `ถูกประเมินแล้ว ${A.num(s.teachersEvaluated)} คน`, 'user', 'bg-brand-50 text-brand-500'),
        statCard('จำนวนผู้เยี่ยมชั้นเรียน', A.num(s.visitors), `ปฏิบัติหน้าที่แล้ว ${A.num(s.visitorsActive)} คน`, 'users', 'bg-[#0288D1]/10 text-[#0288D1]'),
        statCard('รายการประเมินทั้งหมด', A.num(s.totalEvaluations), `ตัวชี้วัด ${A.num(s.indicators)} ข้อ · ชั้นเรียน ${A.num(s.classrooms)} ห้อง`, 'clipboard', 'bg-teal-500/10 text-teal-600'),
        statCard('คะแนนเฉลี่ยรวม', `${A.num(s.averageTotalScore, 2)}`, `จากคะแนนเต็มเฉลี่ย ${A.num(s.averageMaximumScore, 2)}`, 'star', 'bg-amber2-500/20 text-[#7A4F01]'),
        statCard('ร้อยละเฉลี่ยรวม', `${A.num(s.averagePercentage, 2)}%`, 'ค่าเฉลี่ยจากทุกรายการประเมิน', 'percent', 'bg-[#FF8A65]/15 text-[#C2410C]'),
        qualityBreakdownCard(data.byQuality),
      ].forEach((n) => statsWrap.appendChild(n));

      clear(chartsWrap);
      chartsWrap.appendChild(chartCard('จำนวนการเยี่ยมชั้นเรียนแยกตามเดือน', 'chart-month'));
      chartsWrap.appendChild(chartCard('จำนวนผลการประเมินแยกตามระดับคุณภาพ', 'chart-quality'));
      chartsWrap.appendChild(chartCard('ร้อยละเฉลี่ยแยกตามชั้นเรียน', 'chart-classroom', 'xl:col-span-2'));

      renderCharts(data);
      renderRecent(data.recent);
    }

    function chartCard(title, canvasId, extraCls) {
      return card([
        el('div', { class: 'border-b border-slate-100 px-4 py-3' }, el('h3', { class: 'text-sm font-bold text-plum', text: title })),
        el('div', { class: 'p-4' }, el('div', { class: 'relative h-64 w-full' }, el('canvas', { id: canvasId }))),
      ], extraCls);
    }

    function destroyChart(key) {
      if (state.charts[key]) { state.charts[key].destroy(); delete state.charts[key]; }
    }

    function renderCharts(data) {
      Chart.defaults.font.family = 'Sarabun, sans-serif';
      Chart.defaults.color = '#64748b';

      // ถ้าผู้ใช้เปลี่ยนเมนูระหว่างที่ข้อมูลยังโหลดไม่เสร็จ canvas จะถูกถอดออกไปแล้ว
      if (!$('#chart-month') || !$('#chart-quality') || !$('#chart-classroom')) return;

      destroyChart('month');
      state.charts.month = new Chart($('#chart-month'), {
        type: 'line',
        data: {
          labels: data.byMonth.map((m) => m.label),
          datasets: [{
            label: 'จำนวนครั้ง', data: data.byMonth.map((m) => m.count),
            borderColor: '#F13596', backgroundColor: 'rgba(241,53,150,.14)', fill: true, tension: .35,
            pointBackgroundColor: '#F13596', pointRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });

      destroyChart('quality');
      state.charts.quality = new Chart($('#chart-quality'), {
        type: 'doughnut',
        data: {
          labels: data.byQuality.map((q) => q.label),
          datasets: [{
            data: data.byQuality.map((q) => q.count),
            backgroundColor: ['#26A69A', '#AED581', '#FFCA28', '#FF8A65', '#EF5350'],
            borderWidth: 2, borderColor: '#fff',
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'bottom' } } },
      });

      destroyChart('classroom');
      state.charts.classroom = new Chart($('#chart-classroom'), {
        type: 'bar',
        data: {
          labels: data.byClassroom.map((c) => c.label),
          datasets: [{
            label: 'ร้อยละเฉลี่ย', data: data.byClassroom.map((c) => c.percentage),
            backgroundColor: '#F97AB6', borderRadius: 8, maxBarThickness: 42,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `ร้อยละ ${c.parsed.y.toFixed(2)}` } } },
          scales: { y: { beginAtZero: true, max: 100 } },
        },
      });
    }

    function renderRecent(recent) {
      const box = card([
        el('div', { class: 'border-b border-slate-100 px-4 py-3' }, el('h3', { class: 'text-sm font-bold text-plum', text: 'รายการประเมินล่าสุด' })),
      ]);
      if (!recent.length) {
        box.appendChild(A.emptyState('ยังไม่มีรายการประเมิน', 'เมื่อมีการบันทึกแบบการเยี่ยมชั้นเรียน รายการจะแสดงที่นี่'));
      } else {
        const wrap = el('div', { class: 'table-wrap p-4' });
        const table = el('table', { class: 'table' });
        table.appendChild(el('thead', {}, el('tr', {}, [
          el('th', { text: 'เลขอ้างอิง' }), el('th', { text: 'ผู้รับการเยี่ยม' }), el('th', { text: 'ชั้นเรียน' }),
          el('th', { text: 'ผู้เยี่ยม' }), el('th', { text: 'วันที่' }), el('th', { class: 'text-center', text: 'ร้อยละ' }),
          el('th', { class: 'text-center', text: 'ระดับคุณภาพ' }),
        ])));
        const tbody = el('tbody');
        recent.forEach((r) => tbody.appendChild(el('tr', {}, [
          el('td', { class: 'font-mono text-xs font-bold text-brand-600', text: r.referenceNumber }),
          el('td', { text: r.teacherName }),
          el('td', { class: 'whitespace-nowrap', text: r.classroomName }),
          el('td', { text: r.visitorName }),
          el('td', { class: 'whitespace-nowrap', text: A.thaiDate(r.visitDate, 'short') }),
          el('td', { class: 'text-center font-bold', text: `${A.num(r.percentage, 2)}%` }),
          el('td', { class: 'text-center' }, el('span', { class: A.qualityBadge(r.qualityLevel), text: r.qualityLevel })),
        ])));
        table.appendChild(tbody);
        wrap.appendChild(table);
        box.appendChild(wrap);
      }
      clear(recentWrap);
      recentWrap.appendChild(box);
    }

    load();
  }

  /* ==================================================================
   * มุมมอง: ตั้งค่าระบบ
   * ================================================================== */
  async function viewSettings(view) {
    setHeader('ตั้งค่าระบบ', 'ข้อมูลโรงเรียน ตราสัญลักษณ์ และรหัส PIN ผู้ดูแล');
    const wrap = el('div', { class: 'skeleton h-96' });
    view.appendChild(wrap);

    let settings;
    try {
      settings = (await A.api('/api/admin/settings')).data;
    } catch (err) {
      wrap.replaceWith(A.errorState(err.message, () => route()));
      return;
    }

    let logoFile = null;
    let removeLogo = false;

    const logoPreview = el('div', { class: 'flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-slate-300' });
    function paintLogo(src) {
      clear(logoPreview);
      if (src) logoPreview.appendChild(el('img', { src, alt: 'ตราสัญลักษณ์โรงเรียน', class: 'h-full w-full object-cover' }));
      else logoPreview.innerHTML = icon('school', 'h-10 w-10');
    }
    paintLogo(settings.schoolLogo);

    const logoInput = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'hidden' });
    logoInput.addEventListener('change', () => {
      const f = logoInput.files && logoInput.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { A.alertError('ไฟล์ใหญ่เกินไป', 'โลโก้ต้องมีขนาดไม่เกิน 2 MB'); logoInput.value = ''; return; }
      logoFile = f;
      removeLogo = false;
      paintLogo(URL.createObjectURL(f));
    });

    const field = (label, node, hint, required) => el('div', { class: 'space-y-1.5', dataset: { field: '1' } }, [
      el('label', { class: `label ${required ? 'req' : ''}`, text: label }),
      node,
      hint ? el('p', { class: 'text-xs text-slate-400', text: hint }) : null,
      el('p', { class: 'help-error', 'data-error': '1' }),
    ]);

    const schoolName = el('input', { type: 'text', class: 'input', value: settings.schoolName, maxlength: 200 });
    const affiliation = el('input', { type: 'text', class: 'input', value: settings.affiliationName, maxlength: 200 });
    const pin = el('input', { type: 'password', class: 'input tracking-[0.5em]', inputmode: 'numeric', maxlength: 4, placeholder: '••••', autocomplete: 'new-password' });
    const pinConfirm = el('input', { type: 'password', class: 'input tracking-[0.5em]', inputmode: 'numeric', maxlength: 4, placeholder: '••••', autocomplete: 'new-password' });
    [pin, pinConfirm].forEach((i) => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, ''); A.clearFieldError(i); }));

    const requireImages = el('input', { type: 'checkbox', class: 'h-5 w-5 rounded border-slate-300 text-brand-500 focus:ring-brand-500', checked: settings.requireImages ? true : null });

    const saveBtn = el('button', { type: 'submit', class: 'btn-primary', html: `${icon('check', 'h-4 w-4')}<span>บันทึกการตั้งค่า</span>` });

    const form = el('form', { class: 'space-y-5', novalidate: true }, [
      card([
        el('div', { class: 'border-b border-slate-100 px-4 py-3 sm:px-6' }, el('h3', { class: 'text-sm font-bold text-plum', text: 'ข้อมูลสถานศึกษา' })),
        el('div', { class: 'grid gap-4 p-4 sm:p-6' }, [
          field('ชื่อโรงเรียน', schoolName, null, true),
          field('ชื่อหน่วยงานต้นสังกัด', affiliation, null, true),
          el('div', { class: 'space-y-1.5' }, [
            el('label', { class: 'label', text: 'ตราสัญลักษณ์โรงเรียน' }),
            el('div', { class: 'flex flex-wrap items-center gap-4' }, [
              logoPreview,
              el('div', { class: 'flex flex-col gap-2' }, [
                el('button', { type: 'button', class: 'btn-secondary btn-sm', html: `${icon('upload', 'h-4 w-4')}<span>เลือกไฟล์โลโก้</span>`, onclick: () => logoInput.click() }),
                el('button', {
                  type: 'button', class: 'btn-ghost btn-sm text-danger-600',
                  html: `${icon('trash', 'h-4 w-4')}<span>ลบโลโก้</span>`,
                  onclick: () => { logoFile = null; removeLogo = true; logoInput.value = ''; paintLogo(null); },
                }),
                el('p', { class: 'text-xs text-slate-400', text: 'รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 2 MB' }),
              ]),
              logoInput,
            ]),
          ]),
          el('label', { class: 'flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3' }, [
            requireImages,
            el('span', {}, [
              el('span', { class: 'block text-sm font-semibold text-slate-700', text: 'บังคับแนบรูปภาพการเยี่ยมชั้นเรียน' }),
              el('span', { class: 'block text-xs text-slate-500', text: 'เมื่อเปิดใช้งาน ผู้บันทึกต้องแนบรูปภาพอย่างน้อย 1 รูปทุกครั้ง' }),
            ]),
          ]),
        ]),
      ]),
      card([
        el('div', { class: 'border-b border-slate-100 px-4 py-3 sm:px-6' }, [
          el('h3', { class: 'text-sm font-bold text-plum', text: 'รหัส PIN ผู้ดูแลระบบ' }),
          el('p', { class: 'text-xs text-slate-500', text: 'เว้นว่างไว้หากไม่ต้องการเปลี่ยน PIN — ระบบจัดเก็บ PIN แบบเข้ารหัส (scrypt) ไม่เก็บเป็นข้อความธรรมดา' }),
        ]),
        el('div', { class: 'grid gap-4 p-4 sm:grid-cols-2 sm:p-6' }, [
          field('PIN ใหม่ (ตัวเลข 4 หลัก)', pin),
          field('ยืนยัน PIN ใหม่', pinConfirm),
        ]),
      ]),
      el('div', { class: 'flex justify-end' }, saveBtn),
    ]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      A.clearAllErrors(form);
      if (!schoolName.value.trim()) { A.setFieldError(schoolName, 'กรุณากรอกชื่อโรงเรียน'); return; }
      if (!affiliation.value.trim()) { A.setFieldError(affiliation, 'กรุณากรอกชื่อหน่วยงานต้นสังกัด'); return; }
      if (pin.value || pinConfirm.value) {
        if (!/^\d{4}$/.test(pin.value)) { A.setFieldError(pin, 'PIN ต้องเป็นตัวเลข 4 หลัก'); return; }
        if (pin.value !== pinConfirm.value) { A.setFieldError(pinConfirm, 'PIN และการยืนยัน PIN ไม่ตรงกัน'); return; }
      }

      const fd = new FormData();
      fd.append('schoolName', schoolName.value.trim());
      fd.append('affiliationName', affiliation.value.trim());
      fd.append('requireImages', requireImages.checked ? '1' : '0');
      if (removeLogo) fd.append('removeLogo', '1');
      if (logoFile) fd.append('logo', logoFile, logoFile.name);
      if (pin.value) { fd.append('pin', pin.value); fd.append('pinConfirm', pinConfirm.value); }

      saveBtn.disabled = true;
      A.showLoading('กำลังบันทึกการตั้งค่า...');
      try {
        const res = await A.api('/api/admin/settings', { method: 'PUT', formData: fd });
        A.hideLoading(true);
        pin.value = ''; pinConfirm.value = '';
        logoFile = null; removeLogo = false;
        paintLogo(res.data.schoolLogo);
        await A.loadSettings(true).then(A.applyBranding);
        A.alertSuccess('บันทึกเรียบร้อย', res.message);
      } catch (err) {
        A.hideLoading(true);
        A.alertError('บันทึกไม่สำเร็จ', err.message);
      } finally {
        saveBtn.disabled = false;
      }
    });

    wrap.replaceWith(form);
  }

  /* ==================================================================
   * มุมมอง: จัดการข้อมูลพื้นฐาน (ใช้ร่วมกันทั้ง 6 เมนู)
   * ================================================================== */
  function viewMaster(view, resource) {
    const cfg = MASTERS[resource];
    setHeader(cfg.title, `เพิ่ม แก้ไข ลบ และค้นหา${cfg.singular}ในระบบ`);

    const query = { search: '', page: 1, pageSize: 10 };
    const body = el('div');
    const box = card([]);

    const addBtn = el('button', {
      type: 'button', class: 'btn-primary btn-sm sm:btn',
      html: `${icon('plus', 'h-4 w-4')}<span>เพิ่ม${cfg.singular}</span>`,
      onclick: () => openForm(null),
    });
    const reorderBtn = cfg.reorder ? el('button', {
      type: 'button', class: 'btn-secondary btn-sm sm:btn',
      html: `${icon('list', 'h-4 w-4')}<span>เปลี่ยนลำดับ</span>`,
      onclick: () => openReorder(),
    }) : null;

    box.appendChild(toolbar([
      searchBox(`ค้นหา${cfg.singular}...`, (v) => { query.search = v; query.page = 1; load(); }),
      el('div', { class: 'flex gap-2' }, [reorderBtn, addBtn].filter(Boolean)),
    ]));
    box.appendChild(body);
    view.appendChild(box);

    async function load() {
      clear(body);
      body.appendChild(A.skeletonRows(5, cfg.columns.length + 2));
      let res;
      try {
        const qs = new URLSearchParams({ search: query.search, page: query.page, pageSize: query.pageSize });
        res = await A.api(`/api/admin/masters/${resource}?${qs}`);
      } catch (err) {
        clear(body);
        body.appendChild(A.errorState(err.message, load));
        return;
      }

      clear(body);
      if (!res.data.length) {
        body.appendChild(A.emptyState(
          query.search ? 'ไม่พบข้อมูลที่ค้นหา' : `ยังไม่มี${cfg.singular}ในระบบ`,
          query.search ? `ไม่พบ${cfg.singular}ที่ตรงกับคำค้น "${query.search}"` : `เริ่มต้นด้วยการเพิ่ม${cfg.singular}รายการแรก`,
          el('button', { type: 'button', class: 'btn-primary mt-2', html: `${icon('plus', 'h-4 w-4')}<span>เพิ่ม${cfg.singular}</span>`, onclick: () => openForm(null) })
        ));
        return;
      }

      const wrap = el('div', { class: 'table-wrap px-4' });
      const table = el('table', { class: 'table' });
      const headRow = el('tr', {}, [el('th', { class: 'w-14 text-center', text: 'ที่' })]);
      cfg.columns.forEach((c) => headRow.appendChild(el('th', { class: `${c.align === 'center' ? 'text-center' : ''} ${c.width || ''}`, text: c.label })));
      headRow.appendChild(el('th', { class: 'w-32 text-center', text: 'สถานะ' }));
      headRow.appendChild(el('th', { class: 'w-32 text-center', text: 'จัดการ' }));
      table.appendChild(el('thead', {}, headRow));

      const tbody = el('tbody');
      res.data.forEach((item, index) => {
        const tr = el('tr', {});
        tr.appendChild(el('td', { class: 'text-center text-slate-500', text: String((res.meta.page - 1) * res.meta.pageSize + index + 1) }));
        cfg.columns.forEach((c) => {
          const value = item[c.key];
          tr.appendChild(el('td', {
            class: `${c.align === 'center' ? 'text-center' : ''} ${c.key === 'indicatorName' ? 'min-w-[20rem] leading-relaxed' : ''}`,
            text: value === null || value === undefined || value === '' ? '-' : String(value),
          }));
        });
        tr.appendChild(el('td', { class: 'text-center' }, el('button', {
          type: 'button', title: 'คลิกเพื่อเปิด/ปิดการใช้งาน', class: 'cursor-pointer', onclick: () => toggleStatus(item),
        }, statusBadge(item.status))));
        tr.appendChild(el('td', { class: 'text-center' }, el('div', { class: 'flex items-center justify-center gap-1' }, [
          iconAction('edit', `แก้ไข${cfg.singular}`, 'text-[#0288D1] hover:bg-[#0288D1]/10', () => openForm(item)),
          iconAction('trash', `ลบ${cfg.singular}`, 'text-danger-600 hover:bg-danger-500/10', () => remove(item)),
        ])));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      body.appendChild(wrap);
      body.appendChild(A.pagination(res.meta, (p) => { query.page = p; load(); }));
    }

    function fieldValue(item, name) {
      if (!item) return '';
      const v = item[name];
      return v === null || v === undefined ? '' : String(v);
    }

    async function openForm(item) {
      // โหลดตัวเลือกของฟิลด์แบบ dropdown (เช่น หัวข้อกลุ่มของตัวชี้วัด)
      const sources = {};
      for (const f of cfg.fields.filter((x) => x.type === 'select')) {
        try {
          sources[f.name] = (await A.api(`/api/admin/masters/${f.source}?page=1&pageSize=100&status=1`)).data;
        } catch {
          sources[f.name] = [];
        }
      }

      const inputs = {};
      const content = el('div', { class: 'space-y-4' });
      cfg.fields.forEach((f) => {
        let node;
        if (f.type === 'select') {
          node = el('select', { class: 'input' });
          node.appendChild(el('option', { value: '', text: f.placeholder || '-- เลือก --' }));
          (sources[f.name] || []).forEach((o) => {
            node.appendChild(el('option', { value: String(o.id), text: o.name || o.indicatorName || o.fullName }));
          });
        } else if (f.type === 'textarea') {
          node = el('textarea', { class: 'input resize-y', rows: 3, placeholder: f.placeholder || '', maxlength: 500 });
        } else {
          node = el('input', { type: f.type === 'number' ? 'number' : 'text', class: 'input', placeholder: f.placeholder || '', min: f.type === 'number' ? 0 : null, maxlength: f.type === 'number' ? null : 200 });
        }
        node.value = fieldValue(item, f.name);
        node.addEventListener(f.type === 'select' ? 'change' : 'input', () => A.clearFieldError(node));
        inputs[f.name] = node;
        content.appendChild(el('div', { class: 'space-y-1.5', dataset: { field: '1' } }, [
          el('label', { class: `label ${f.required ? 'req' : ''}`, text: f.label }),
          node,
          el('p', { class: 'help-error', 'data-error': '1' }),
        ]));
      });

      const statusToggle = el('input', { type: 'checkbox', class: 'h-5 w-5 rounded border-slate-300 text-brand-500 focus:ring-brand-500', checked: item ? (item.status ? true : null) : true });
      content.appendChild(el('label', { class: 'flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3' }, [
        statusToggle,
        el('span', { class: 'text-sm font-semibold text-slate-700', text: 'เปิดใช้งานรายการนี้' }),
      ]));

      const submitBtn = el('button', { type: 'button', class: 'btn-primary', html: `${icon('check', 'h-4 w-4')}<span>${item ? 'บันทึกการแก้ไข' : 'เพิ่มข้อมูล'}</span>` });
      const modal = A.openModal({
        title: item ? `แก้ไข${cfg.singular}` : `เพิ่ม${cfg.singular}`,
        subtitle: cfg.title,
        content,
        footer: [
          el('button', { type: 'button', class: 'btn-secondary', text: 'ยกเลิก', onclick: () => modal.close() }),
          submitBtn,
        ],
      });

      submitBtn.addEventListener('click', async () => {
        A.clearAllErrors(content);
        const payload = { status: statusToggle.checked ? 1 : 0 };
        let invalid = false;
        cfg.fields.forEach((f) => {
          const value = inputs[f.name].value.trim();
          if (f.required && !value) { A.setFieldError(inputs[f.name], `กรุณากรอก${f.label}`); invalid = true; }
          payload[f.name] = f.type === 'number' ? (value === '' ? 0 : Number(value)) : value;
          if (f.type === 'select' && value === '') payload[f.name] = null;
        });
        if (invalid) return;

        submitBtn.disabled = true;
        const original = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span><span>กำลังบันทึก...</span>';
        try {
          const res = item
            ? await A.api(`/api/admin/masters/${resource}/${item.id}`, { method: 'PUT', body: payload })
            : await A.api(`/api/admin/masters/${resource}`, { method: 'POST', body: payload });
          modal.close();
          A.toast('success', res.message);
          state.options = null;
          load();
        } catch (err) {
          A.alertError('บันทึกไม่สำเร็จ', err.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
        }
      });
    }

    async function toggleStatus(item) {
      try {
        const res = await A.api(`/api/admin/masters/${resource}/${item.id}/status`, { method: 'PATCH', body: { status: item.status ? 0 : 1 } });
        A.toast('success', res.message);
        state.options = null;
        load();
      } catch (err) {
        A.alertError('ไม่สำเร็จ', err.message);
      }
    }

    async function remove(item) {
      const name = item.fullName || item.name || item.indicatorName;
      const used = item.usageCount > 0
        ? `<div class="mt-2 rounded-xl bg-amber2-500/15 px-3 py-2 text-xs text-[#7A4F01]">ข้อมูลนี้ถูกใช้ในผลการประเมินแล้ว ${item.usageCount} รายการ ระบบจะซ่อนออกจากรายการแต่ยังเก็บไว้เบื้องหลังเพื่อไม่ให้รายงานเดิมเสียหาย</div>`
        : '';
      const confirmed = await A.confirmDelete(`ยืนยันการลบ${cfg.singular}`,
        `<div style="text-align:left" class="text-sm text-slate-600">คุณต้องการลบ<br/><b class="text-plum">${String(name).replace(/[<>&]/g, '')}</b><br/>ออกจากระบบใช่หรือไม่</div>${used}`);
      if (!confirmed) return;

      A.showLoading('กำลังลบข้อมูล...');
      try {
        const res = await A.api(`/api/admin/masters/${resource}/${item.id}`, { method: 'DELETE' });
        A.hideLoading(true);
        A.alertSuccess('ลบข้อมูลเรียบร้อย', res.message);
        state.options = null;
        load();
      } catch (err) {
        A.hideLoading(true);
        A.alertError('ลบไม่สำเร็จ', err.message);
      }
    }

    /** เปลี่ยนลำดับตัวชี้วัดด้วยปุ่มขึ้น/ลง (ใช้งานง่ายบนมือถือกว่าการลาก) */
    async function openReorder() {
      A.showLoading('กำลังโหลดรายการ...');
      let items;
      try {
        items = (await A.api(`/api/admin/masters/${resource}?page=1&pageSize=100`)).data;
      } catch (err) {
        A.hideLoading(true);
        A.alertError('โหลดข้อมูลไม่สำเร็จ', err.message);
        return;
      }
      A.hideLoading(true);

      const list = el('ul', { class: 'space-y-2' });
      function paint() {
        clear(list);
        items.forEach((item, index) => {
          list.appendChild(el('li', { class: 'flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5' }, [
            el('span', { class: 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600', text: String(index + 1) }),
            el('span', { class: 'flex-1 text-sm leading-snug text-slate-700', text: item.indicatorName || item.name }),
            iconAction('arrowUp', 'เลื่อนขึ้น', 'text-slate-500 hover:bg-slate-100', () => { if (index > 0) { items.splice(index - 1, 0, items.splice(index, 1)[0]); paint(); } }),
            iconAction('arrowDown', 'เลื่อนลง', 'text-slate-500 hover:bg-slate-100', () => { if (index < items.length - 1) { items.splice(index + 1, 0, items.splice(index, 1)[0]); paint(); } }),
          ]));
        });
      }
      paint();

      const saveBtn = el('button', { type: 'button', class: 'btn-primary', html: `${icon('check', 'h-4 w-4')}<span>บันทึกลำดับ</span>` });
      const modal = A.openModal({
        title: 'เปลี่ยนลำดับรายการ', subtitle: cfg.title, size: 'lg', content: list,
        footer: [el('button', { type: 'button', class: 'btn-secondary', text: 'ยกเลิก', onclick: () => modal.close() }), saveBtn],
      });

      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        try {
          const res = await A.api(`/api/admin/masters/${resource}/reorder`, {
            method: 'POST',
            body: { orders: items.map((item, i) => ({ id: item.id, sortOrder: i + 1 })) },
          });
          modal.close();
          A.toast('success', res.message);
          state.options = null;
          load();
        } catch (err) {
          saveBtn.disabled = false;
          A.alertError('บันทึกไม่สำเร็จ', err.message);
        }
      });
    }

    load();
  }

  /* ==================================================================
   * มุมมอง: ผลการเยี่ยมชั้นเรียนทั้งหมด
   * ================================================================== */
  async function viewEvaluations(view) {
    setHeader('ผลการเยี่ยมชั้นเรียนทั้งหมด', 'ค้นหา กรอง และจัดการผลการประเมินที่บันทึกไว้');
    const query = { search: '', classroomTeacherId: '', semesterId: '', academicYearId: '', page: 1, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' };

    const filterCard = card([], 'p-4');
    const listCard = card([]);
    const body = el('div');
    listCard.appendChild(body);
    view.appendChild(el('div', { class: 'space-y-4' }, [filterCard, listCard]));

    const options = await loadOptions();
    const teacherMount = el('div');
    const grid = el('div', { class: 'grid gap-3 lg:grid-cols-4' });
    grid.appendChild(el('div', {}, [el('label', { class: 'label', text: 'ผู้รับการเยี่ยมชั้นเรียน' }), teacherMount]));
    const semesterSel = selectField(options.semesters, 'name', '', (v) => { query.semesterId = v; }, 'ทุกภาคเรียน');
    const yearSel = selectField(options.academicYears, 'name', '', (v) => { query.academicYearId = v; }, 'ทุกปีการศึกษา');
    grid.appendChild(el('div', {}, [el('label', { class: 'label', text: 'ภาคเรียน' }), semesterSel]));
    grid.appendChild(el('div', {}, [el('label', { class: 'label', text: 'ปีการศึกษา' }), yearSel]));
    grid.appendChild(el('div', { class: 'flex items-end gap-2' }, [
      el('button', { type: 'button', class: 'btn-primary flex-1', html: `${icon('search', 'h-4 w-4')}<span>ค้นหา</span>`, onclick: () => { query.page = 1; load(); } }),
      el('button', { type: 'button', class: 'btn-secondary', title: 'ล้างตัวกรอง', html: `${icon('refresh', 'h-4 w-4')}<span class="sr-only">ล้างตัวกรอง</span>`, onclick: () => resetFilters() }),
    ]));
    filterCard.appendChild(grid);

    const teacherSelect = new A.SearchableSelect(teacherMount, {
      placeholder: 'ทุกคน',
      searchPlaceholder: 'พิมพ์ชื่อเพื่อค้นหา...',
      items: [{ value: '', label: 'ทุกคน' }].concat(options.classroomTeachers.map((t) => ({ value: t.id, label: t.fullName, sublabel: t.position }))),
      onChange: (v) => { query.classroomTeacherId = v; },
    });

    function resetFilters() {
      query.search = ''; query.classroomTeacherId = ''; query.semesterId = ''; query.academicYearId = ''; query.page = 1;
      teacherSelect.setValue('', true);
      semesterSel.value = ''; yearSel.value = '';
      const s = listCard.querySelector('input[type="search"]');
      if (s) s.value = '';
      load();
    }

    listCard.insertBefore(toolbar([
      searchBox('ค้นหาเลขอ้างอิง / ชื่อผู้รับการเยี่ยม / ชั้นเรียน...', (v) => { query.search = v; query.page = 1; load(); }),
      el('div', { class: 'flex items-center gap-2' }, [
        el('label', { class: 'text-xs font-semibold text-slate-500', text: 'เรียงตาม' }),
        (() => {
          const sel = el('select', { class: 'input py-2 text-xs' });
          [['createdAt|desc', 'บันทึกล่าสุด'], ['visitDate|desc', 'วันที่เยี่ยม (ใหม่-เก่า)'], ['visitDate|asc', 'วันที่เยี่ยม (เก่า-ใหม่)'],
           ['percentage|desc', 'ร้อยละ (มาก-น้อย)'], ['percentage|asc', 'ร้อยละ (น้อย-มาก)'], ['teacher|asc', 'ชื่อผู้รับการเยี่ยม']]
            .forEach(([v, l]) => sel.appendChild(el('option', { value: v, text: l })));
          sel.addEventListener('change', () => {
            const [by, dir] = sel.value.split('|');
            query.sortBy = by; query.sortDir = dir; query.page = 1; load();
          });
          return sel;
        })(),
      ]),
    ]), body);

    async function load() {
      clear(body);
      body.appendChild(A.skeletonRows(6, 7));
      let res;
      try {
        const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v !== null));
        res = await A.api(`/api/admin/evaluations?${qs}`);
      } catch (err) {
        clear(body); body.appendChild(A.errorState(err.message, load)); return;
      }

      clear(body);
      if (!res.data.length) {
        body.appendChild(A.emptyState('ไม่พบผลการเยี่ยมชั้นเรียน', 'ลองปรับเงื่อนไขการค้นหา หรือรอให้มีการบันทึกแบบการเยี่ยมชั้นเรียนเข้ามาในระบบ'));
        return;
      }

      const wrap = el('div', { class: 'table-wrap px-4' });
      const table = el('table', { class: 'table' });
      table.appendChild(el('thead', {}, el('tr', {}, [
        el('th', { class: 'w-14 text-center', text: 'ที่' }),
        el('th', { text: 'ผู้รับผิดชอบชั้นเรียน' }),
        el('th', { text: 'ชั้นเรียน' }),
        el('th', { text: 'ภาคเรียน' }),
        el('th', { text: 'ปีการศึกษา' }),
        el('th', { class: 'text-center', text: 'คะแนนรวม' }),
        el('th', { class: 'text-center', text: 'ร้อยละ' }),
        el('th', { class: 'text-center', text: 'ระดับคุณภาพ' }),
        el('th', { class: 'w-28 text-center', text: 'จัดการ' }),
      ])));
      const tbody = el('tbody');
      res.data.forEach((r, i) => {
        tbody.appendChild(el('tr', {}, [
          el('td', { class: 'text-center text-slate-500', text: String((res.meta.page - 1) * res.meta.pageSize + i + 1) }),
          el('td', {}, [
            el('p', { class: 'font-semibold text-slate-700', text: r.teacherName }),
            el('p', { class: 'text-xs text-slate-400', text: `${r.referenceNumber} · ผู้เยี่ยม: ${r.visitorName}` }),
          ]),
          el('td', { class: 'whitespace-nowrap', text: r.classroomName }),
          el('td', { class: 'whitespace-nowrap', text: r.semesterName }),
          el('td', { class: 'whitespace-nowrap', text: r.academicYearName }),
          el('td', { class: 'whitespace-nowrap text-center font-bold text-plum', text: `${A.num(r.totalScore)}/${A.num(r.maximumScore)}` }),
          el('td', { class: 'text-center font-bold', text: `${A.num(r.percentage, 2)}%` }),
          el('td', { class: 'text-center' }, el('span', { class: A.qualityBadge(r.qualityLevel), text: r.qualityLevel })),
          el('td', { class: 'text-center' }, el('div', { class: 'flex items-center justify-center gap-1' }, [
            el('a', {
              href: `/admin/evaluation?id=${r.id}`, class: 'icon-btn text-[#0288D1] hover:bg-[#0288D1]/10',
              title: 'ดูรายละเอียด', 'aria-label': 'ดูรายละเอียด', html: icon('eye', 'h-4 w-4'),
            }),
            iconAction('trash', 'ลบผลการประเมิน', 'text-danger-600 hover:bg-danger-500/10', () => removeEvaluation(r)),
          ])),
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      body.appendChild(wrap);
      body.appendChild(A.pagination(res.meta, (p) => { query.page = p; load(); }));
    }

    async function removeEvaluation(r) {
      const confirmed = await A.confirmDelete('ยืนยันการลบผลการเยี่ยมชั้นเรียน',
        `<div style="text-align:left" class="text-sm text-slate-600">เลขอ้างอิง <b>${r.referenceNumber}</b><br/>ผู้รับการเยี่ยม: <b>${String(r.teacherName).replace(/[<>&]/g, '')}</b>` +
        `<div class="mt-2 rounded-xl bg-danger-500/10 px-3 py-2 text-xs text-danger-600">ระบบจะลบคะแนนรายตัวชี้วัดและรูปภาพที่เกี่ยวข้องทั้งหมด และไม่สามารถกู้คืนได้</div></div>`);
      if (!confirmed) return;
      A.showLoading('กำลังลบข้อมูล...');
      try {
        const res = await A.api(`/api/admin/evaluations/${r.id}`, { method: 'DELETE' });
        A.hideLoading(true);
        A.alertSuccess('ลบข้อมูลเรียบร้อย', res.message);
        load();
      } catch (err) {
        A.hideLoading(true);
        A.alertError('ลบไม่สำเร็จ', err.message);
      }
    }

    load();
  }

  /* ==================================================================
   * มุมมอง: สรุปผลการเยี่ยมชั้นเรียน
   * ================================================================== */
  async function viewSummary(view) {
    setHeader('สรุปผลการเยี่ยมชั้นเรียน', 'เลือกภาคเรียนและปีการศึกษา แล้วกดแสดงผลสรุป');
    const query = { semesterId: '', academicYearId: '' };

    const filterCard = card([], 'p-4');
    const resultWrap = el('div');
    view.appendChild(el('div', { class: 'space-y-4' }, [filterCard, resultWrap]));

    const options = await loadOptions();
    const semesterSel = selectField(options.semesters, 'name', '', (v) => { query.semesterId = v; }, '-- เลือกภาคเรียน --');
    const yearSel = selectField(options.academicYears, 'name', '', (v) => { query.academicYearId = v; }, '-- เลือกปีการศึกษา --');

    filterCard.appendChild(el('div', { class: 'grid gap-3 sm:grid-cols-3' }, [
      el('div', { dataset: { field: '1' } }, [el('label', { class: 'label req', text: 'ภาคเรียน' }), semesterSel, el('p', { class: 'help-error', 'data-error': '1' })]),
      el('div', { dataset: { field: '1' } }, [el('label', { class: 'label req', text: 'ปีการศึกษา' }), yearSel, el('p', { class: 'help-error', 'data-error': '1' })]),
      el('div', { class: 'flex items-end' }, el('button', {
        type: 'button', class: 'btn-primary w-full', html: `${icon('report', 'h-4 w-4')}<span>แสดงผลสรุป</span>`, onclick: () => load(),
      })),
    ]));

    resultWrap.appendChild(A.emptyState('ยังไม่ได้เลือกเงื่อนไข', 'กรุณาเลือกภาคเรียนและปีการศึกษา แล้วกดปุ่ม "แสดงผลสรุป" เพื่อดูข้อมูล'));

    async function load() {
      A.clearAllErrors(filterCard);
      if (!query.semesterId) { A.setFieldError(semesterSel, 'กรุณาเลือกภาคเรียน'); }
      if (!query.academicYearId) { A.setFieldError(yearSel, 'กรุณาเลือกปีการศึกษา'); }
      if (!query.semesterId || !query.academicYearId) {
        A.alertWarning('เลือกเงื่อนไขไม่ครบ', 'กรุณาเลือกทั้งภาคเรียนและปีการศึกษาก่อนแสดงผลสรุป');
        return;
      }

      clear(resultWrap);
      resultWrap.appendChild(A.skeletonRows(6, 6));
      let res;
      try {
        res = await A.api(`/api/admin/summary?semesterId=${query.semesterId}&academicYearId=${query.academicYearId}`);
      } catch (err) {
        clear(resultWrap); resultWrap.appendChild(A.errorState(err.message, load)); return;
      }

      clear(resultWrap);
      const box = card([]);
      box.appendChild(el('div', { class: 'flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4' }, [
        el('div', {}, [
          el('h3', { class: 'text-sm font-bold text-plum', text: 'ผลสรุปการเยี่ยมชั้นเรียน' }),
          el('p', { class: 'text-xs text-slate-500', text: `${res.meta.semesterName} · ปีการศึกษา ${res.meta.academicYearName} · ทั้งหมด ${A.num(res.meta.total)} รายการ` }),
        ]),
        el('button', {
          type: 'button', class: 'btn-secondary btn-sm no-print',
          html: `${icon('print', 'h-4 w-4')}<span>ดูเอกสาร / พิมพ์ PDF</span>`,
          onclick: async () => A.showDocument(
            A.buildSummaryListDoc(res.data, res.meta, await A.loadSettings()),
            `แบบบันทึกสรุปผลการเยี่ยมชั้นเรียน ${res.meta.semesterName} ${res.meta.academicYearName}`
          ),
        }),
      ]));

      if (!res.data.length) {
        box.appendChild(A.emptyState('ไม่พบข้อมูลตามเงื่อนไข', 'ยังไม่มีการบันทึกผลการเยี่ยมชั้นเรียนในภาคเรียนและปีการศึกษาที่เลือก'));
        resultWrap.appendChild(box);
        return;
      }

      const wrap = el('div', { class: 'table-wrap px-4' });
      const table = el('table', { class: 'table' });
      table.appendChild(el('thead', {}, el('tr', {}, [
        el('th', { class: 'w-14 text-center', text: 'ที่' }),
        el('th', { text: 'ผู้รับการเยี่ยมชั้นเรียน' }),
        el('th', { text: 'ชั้นเรียน' }),
        el('th', { class: 'text-center', text: 'ระดับการศึกษา' }),
        el('th', { class: 'text-center', text: 'จำนวนผู้เยี่ยม' }),
        el('th', { class: 'text-center', text: 'คะแนนรวมเฉลี่ย' }),
        el('th', { class: 'text-center', text: 'ร้อยละเฉลี่ย' }),
        el('th', { class: 'text-center', text: 'ระดับคุณภาพ' }),
        el('th', { class: 'w-28 text-center no-print', text: 'จัดการ' }),
      ])));
      const tbody = el('tbody');
      res.data.forEach((r, i) => {
        const detailUrl = `/admin/summary-detail?semesterId=${query.semesterId}&academicYearId=${query.academicYearId}` +
          `&classroomTeacherId=${r.classroomTeacherId}&classroomId=${r.classroomId}`;
        tbody.appendChild(el('tr', {}, [
          el('td', { class: 'text-center text-slate-500', text: String(i + 1) }),
          el('td', {}, [
            el('p', { class: 'font-semibold text-slate-700', text: r.teacherName }),
            r.teacherPosition ? el('p', { class: 'text-xs text-slate-400', text: r.teacherPosition }) : null,
          ]),
          el('td', { class: 'whitespace-nowrap', text: r.classroomName }),
          el('td', { class: 'whitespace-nowrap text-center', text: r.educationLevel || '-' }),
          el('td', { class: 'text-center', text: `${A.num(r.visitCount)} คน` }),
          el('td', { class: 'whitespace-nowrap text-center font-bold text-plum', text: `${A.num(r.averageTotalScore, 2)}/${A.num(r.averageMaximumScore)}` }),
          el('td', { class: 'text-center font-bold', text: `${A.num(r.averagePercentage, 2)}%` }),
          el('td', { class: 'text-center' }, el('span', { class: A.qualityBadge(r.qualityLevel), text: r.qualityLevel })),
          el('td', { class: 'text-center no-print' }, el('div', { class: 'flex items-center justify-center gap-1' }, [
            el('a', { href: detailUrl, class: 'icon-btn text-[#0288D1] hover:bg-[#0288D1]/10', title: 'ดูรายละเอียด', 'aria-label': 'ดูรายละเอียด', html: icon('eye', 'h-4 w-4') }),
            iconAction('trash', 'ลบข้อมูลการเยี่ยมของกลุ่มนี้', 'text-danger-600 hover:bg-danger-500/10', () => removeGroup(r)),
          ])),
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      box.appendChild(wrap);
      resultWrap.appendChild(box);
    }

    async function removeGroup(r) {
      const confirmed = await A.confirmDelete('ยืนยันการลบข้อมูลสรุป',
        `<div style="text-align:left" class="text-sm text-slate-600">ระบบจะลบ<b>ผลการเยี่ยมชั้นเรียนต้นทางทั้งหมด ${r.visitCount} รายการ</b> ของ` +
        `<br/><b class="text-plum">${String(r.teacherName).replace(/[<>&]/g, '')}</b> · ชั้นเรียน ${String(r.classroomName).replace(/[<>&]/g, '')}` +
        `<br/>ในภาคเรียนและปีการศึกษาที่เลือก` +
        `<div class="mt-2 rounded-xl bg-danger-500/10 px-3 py-2 text-xs text-danger-600">คะแนนรายตัวชี้วัดและรูปภาพทั้งหมดจะถูกลบด้วย และไม่สามารถกู้คืนได้</div></div>`,
        'ลบทั้งกลุ่ม');
      if (!confirmed) return;
      A.showLoading('กำลังลบข้อมูล...');
      try {
        const qs = new URLSearchParams({
          semesterId: query.semesterId, academicYearId: query.academicYearId,
          classroomTeacherId: r.classroomTeacherId, classroomId: r.classroomId,
        });
        const res = await A.api(`/api/admin/summary/group?${qs}`, { method: 'DELETE' });
        A.hideLoading(true);
        A.alertSuccess('ลบข้อมูลเรียบร้อย', res.message);
        load();
      } catch (err) {
        A.hideLoading(true);
        A.alertError('ลบไม่สำเร็จ', err.message);
      }
    }
  }

  /* ================= Router ================= */
  async function route() {
    const hash = window.location.hash || '#/dashboard';
    markActive(hash);
    const view = $('#view');
    Object.keys(state.charts).forEach((k) => { state.charts[k].destroy(); delete state.charts[k]; });
    clear(view);

    const key = hash.replace('#/', '');
    try {
      if (key === 'dashboard' || hash === '#/') await viewDashboard(view);
      else if (key === 'settings') await viewSettings(view);
      else if (MASTERS[key]) viewMaster(view, key);
      else if (key === 'evaluations') await viewEvaluations(view);
      else if (key === 'summary') await viewSummary(view);
      else window.location.hash = '#/dashboard';
    } catch (err) {
      clear(view);
      view.appendChild(A.errorState(err.message, route));
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    A.hydrateIcons();
    buildMenu();
    $('#sidebar-open').addEventListener('click', openSidebar);
    $('#sidebar-close').addEventListener('click', closeSidebar);
    $('#sidebar-overlay').addEventListener('click', closeSidebar);
    window.addEventListener('hashchange', route);

    try {
      const settings = await A.loadSettings(true);
      A.applyBranding(settings);
    } catch { /* ยังแสดงหน้าได้แม้โหลด branding ไม่สำเร็จ */ }

    if (!window.location.hash) window.location.hash = '#/dashboard';
    route();
  });
})();
