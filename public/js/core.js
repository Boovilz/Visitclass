/* ระบบแบบเยี่ยมชั้นเรียน — โมดูลกลางที่ทุกหน้าเรียกใช้ร่วมกัน */
(function (global) {
  'use strict';

  /* ============ Icons (inline SVG — ไม่พึ่ง CDN) ============ */
  const ICON_PATHS = {
    home: '<path d="M2.25 12l8.954-8.955a1.125 1.125 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/>',
    chart: '<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>',
    settings: '<path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.03 7.03 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
    calendar: '<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>',
    academic: '<path d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/>',
    users: '<path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>',
    user: '<path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>',
    building: '<path d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/>',
    clipboard: '<path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>',
    list: '<path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>',
    report: '<path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>',
    logout: '<path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>',
    plus: '<path d="M12 4.5v15m7.5-7.5h-15"/>',
    search: '<path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>',
    edit: '<path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/>',
    trash: '<path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>',
    eye: '<path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
    close: '<path d="M6 18L18 6M6 6l12 12"/>',
    check: '<path d="M4.5 12.75l6 6 9-13.5"/>',
    menu: '<path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>',
    upload: '<path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5 7.5 12M12 7.5v12"/>',
    image: '<path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>',
    lock: '<path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>',
    back: '<path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>',
    print: '<path d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"/>',
    info: '<path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>',
    warning: '<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z"/>',
    star: '<path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>',
    percent: '<path d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>',
    badge: '<path d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.746 3.746 0 0121 12z"/>',
    empty: '<path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>',
    arrowUp: '<path d="M4.5 15.75l7.5-7.5 7.5 7.5"/>',
    arrowDown: '<path d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>',
    filter: '<path d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/>',
    refresh: '<path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>',
    doc: '<path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>',
    school: '<path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>',
  };

  function icon(name, cls) {
    const d = ICON_PATHS[name] || ICON_PATHS.info;
    return `<svg class="${cls || 'h-5 w-5'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }

  /* ============ DOM helpers (ใช้ textContent เสมอเพื่อกัน XSS) ============ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v; // ใช้เฉพาะ markup ที่ระบบสร้างเอง เช่น icon()
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  const clear = (node) => { while (node && node.firstChild) node.removeChild(node.firstChild); };

  /* ============ Formatting ============ */
  const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  function thaiDate(iso, style) {
    if (!iso) return '-';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!m) return String(iso);
    const [, y, mo, d] = m;
    const be = Number(y) + 543;
    if (style === 'short') return `${Number(d)} ${THAI_MONTHS_FULL[Number(mo) - 1].slice(0, 3)}. ${be}`;
    return `${Number(d)} ${THAI_MONTHS_FULL[Number(mo) - 1]} ${be}`;
  }

  const num = (v, digits) => Number(v || 0).toLocaleString('th-TH', {
    minimumFractionDigits: digits === undefined ? 0 : digits,
    maximumFractionDigits: digits === undefined ? 0 : digits,
  });

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const QUALITY_BADGES = {
    'ดีมาก': 'badge-q1',
    'ดี': 'badge-q2',
    'ปานกลาง': 'badge-q3',
    'พอใช้': 'badge-q4',
    'ปรับปรุงแก้ไข': 'badge-q5',
  };
  const qualityBadge = (level) => QUALITY_BADGES[level] || 'badge-off';

  const SCORE_COLORS = { 1: '#D32F2F', 2: '#F57C00', 3: '#FBC02D', 4: '#0288D1', 5: '#26A69A' };

  /** สถานะการดำเนินการของตัวชี้วัด (ต้องตรงกับ src/lib/constants.js) */
  const PRACTICE_LABELS = { done: 'ปฏิบัติแล้ว', doing: 'กำลังปฏิบัติ', not_yet: 'ยังไม่ปฏิบัติ' };
  const PRACTICE_BADGES = {
    done: 'badge bg-teal-500/15 text-teal-600',
    doing: 'badge bg-amber2-500/25 text-[#7A4F01]',
    not_yet: 'badge bg-danger-500/15 text-danger-600',
  };
  const practiceLabel = (v) => PRACTICE_LABELS[v] || '-';
  const practiceBadge = (v) => PRACTICE_BADGES[v] || 'badge-off';
  const SCORE_LABELS = {
    5: 'ปฏิบัติได้ระดับดีมาก',
    4: 'ปฏิบัติได้ระดับดี',
    3: 'ปฏิบัติได้ระดับปานกลาง',
    2: 'ปฏิบัติได้ระดับพอใช้',
    1: 'ควรปรับปรุงแก้ไข',
  };

  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait || 300);
    };
  }

  /* ============ Loading overlay ============ */
  let overlayCount = 0;
  function overlayEl() {
    let node = document.getElementById('app-loading');
    if (!node) {
      node = el('div', {
        id: 'app-loading',
        class: 'fixed inset-0 z-[1200] hidden items-center justify-center bg-white/70 backdrop-blur-sm',
        role: 'status',
        'aria-live': 'polite',
      });
      node.innerHTML =
        '<div class="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-card">' +
        '<span class="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500"></span>' +
        '<span class="text-sm font-semibold text-plum" data-loading-text>กำลังโหลดข้อมูล...</span></div>';
      document.body.appendChild(node);
    }
    return node;
  }

  function showLoading(text) {
    const node = overlayEl();
    node.querySelector('[data-loading-text]').textContent = text || 'กำลังดำเนินการ...';
    node.classList.remove('hidden');
    node.classList.add('flex');
    overlayCount += 1;
  }

  function hideLoading(force) {
    overlayCount = force ? 0 : Math.max(0, overlayCount - 1);
    if (overlayCount === 0) {
      const node = document.getElementById('app-loading');
      if (node) { node.classList.add('hidden'); node.classList.remove('flex'); }
    }
  }

  /* ============ SweetAlert wrappers ============ */
  const swalBase = {
    confirmButtonColor: '#F13596',
    cancelButtonColor: '#94a3b8',
    customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl px-5 py-2.5', cancelButton: 'rounded-xl px-5 py-2.5' },
  };

  const toast = (icon_, title) => Swal.fire({
    toast: true, position: 'top-end', icon: icon_, title, showConfirmButton: false,
    timer: 2600, timerProgressBar: true, customClass: { popup: 'rounded-xl' },
  });

  const alertSuccess = (title, html) => Swal.fire({ ...swalBase, icon: 'success', title, html, confirmButtonText: 'ตกลง' });
  const alertError = (title, html) => Swal.fire({ ...swalBase, icon: 'error', title: title || 'เกิดข้อผิดพลาด', html, confirmButtonText: 'ตกลง' });
  const alertWarning = (title, html) => Swal.fire({ ...swalBase, icon: 'warning', title, html, confirmButtonText: 'ตกลง' });

  const confirmDelete = (title, html, confirmText) => Swal.fire({
    ...swalBase, icon: 'warning', title: title || 'ยืนยันการลบข้อมูล', html,
    showCancelButton: true, confirmButtonText: confirmText || 'ลบข้อมูล', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#D32F2F', reverseButtons: true, focusCancel: true,
  }).then((r) => r.isConfirmed);

  const confirmAction = (title, html, confirmText) => Swal.fire({
    ...swalBase, icon: 'question', title, html,
    showCancelButton: true, confirmButtonText: confirmText || 'ยืนยัน', cancelButtonText: 'ยกเลิก', reverseButtons: true,
  }).then((r) => r.isConfirmed);

  /* ============ API client ============ */
  class ApiError extends Error {
    constructor(message, status, details) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }

  async function api(path, options) {
    const opts = options || {};
    const init = {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest', ...(opts.headers || {}) },
    };
    if (opts.formData) {
      init.body = opts.formData;
    } else if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }

    let res;
    try {
      res = await fetch(path, init);
    } catch (e) {
      throw new ApiError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง', 0);
    }

    let payload = null;
    try { payload = await res.json(); } catch { payload = null; }

    if (res.status === 401 && !opts.skipAuthRedirect) {
      hideLoading(true);
      await alertWarning('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบผู้ดูแลอีกครั้ง');
      window.location.href = '/?session=expired';
      throw new ApiError('เซสชันหมดอายุ', 401);
    }
    if (!res.ok || (payload && payload.ok === false)) {
      throw new ApiError((payload && payload.message) || 'เกิดข้อผิดพลาดในการทำงาน', res.status, payload && payload.details);
    }
    return payload;
  }

  /** อัปโหลดพร้อมแสดง progress (fetch ยังไม่รองรับ upload progress) */
  function apiUpload(path, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', path);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.withCredentials = true;
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        let payload = null;
        try { payload = JSON.parse(xhr.responseText); } catch { payload = null; }
        if (xhr.status >= 200 && xhr.status < 300 && payload && payload.ok !== false) resolve(payload);
        else reject(new ApiError((payload && payload.message) || 'บันทึกข้อมูลไม่สำเร็จ', xhr.status, payload && payload.details));
      });
      xhr.addEventListener('error', () => reject(new ApiError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 0)));
      xhr.send(formData);
    });
  }

  /* ============ Lightbox ============ */
  let lightboxState = { items: [], index: 0 };

  function buildLightbox() {
    let node = document.getElementById('app-lightbox');
    if (node) return node;
    node = el('div', {
      id: 'app-lightbox',
      class: 'fixed inset-0 z-[1300] hidden items-center justify-center bg-black/85 p-4',
      role: 'dialog', 'aria-modal': 'true', 'aria-label': 'ดูรูปภาพขนาดใหญ่',
    });
    node.innerHTML =
      '<button type="button" data-lb-close class="absolute right-3 top-3 rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/30" aria-label="ปิด">' + icon('close', 'h-6 w-6') + '</button>' +
      '<button type="button" data-lb-prev class="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/30 sm:left-6" aria-label="รูปก่อนหน้า">' + icon('back', 'h-6 w-6') + '</button>' +
      '<button type="button" data-lb-next class="absolute right-2 top-1/2 -translate-y-1/2 rotate-180 rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/30 sm:right-6" aria-label="รูปถัดไป">' + icon('back', 'h-6 w-6') + '</button>' +
      '<figure class="flex max-h-full max-w-5xl flex-col items-center gap-3">' +
      '<img data-lb-img alt="" class="max-h-[78vh] max-w-full rounded-xl object-contain shadow-2xl" />' +
      '<figcaption data-lb-caption class="text-center text-sm text-white/80"></figcaption></figure>';
    document.body.appendChild(node);

    node.querySelector('[data-lb-close]').addEventListener('click', closeLightbox);
    node.querySelector('[data-lb-prev]').addEventListener('click', () => stepLightbox(-1));
    node.querySelector('[data-lb-next]').addEventListener('click', () => stepLightbox(1));
    node.addEventListener('click', (e) => { if (e.target === node) closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (node.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') stepLightbox(-1);
      if (e.key === 'ArrowRight') stepLightbox(1);
    });
    return node;
  }

  function renderLightbox() {
    const node = buildLightbox();
    const item = lightboxState.items[lightboxState.index];
    if (!item) return;
    node.querySelector('[data-lb-img]').src = item.src;
    node.querySelector('[data-lb-img]').alt = item.caption || 'รูปภาพการเยี่ยมชั้นเรียน';
    node.querySelector('[data-lb-caption]').textContent =
      `${item.caption || ''}${lightboxState.items.length > 1 ? `  (${lightboxState.index + 1}/${lightboxState.items.length})` : ''}`.trim();
    const multi = lightboxState.items.length > 1;
    node.querySelector('[data-lb-prev]').classList.toggle('hidden', !multi);
    node.querySelector('[data-lb-next]').classList.toggle('hidden', !multi);
  }

  function openLightbox(items, index) {
    lightboxState = { items: items || [], index: index || 0 };
    const node = buildLightbox();
    node.classList.remove('hidden');
    node.classList.add('flex');
    document.body.style.overflow = 'hidden';
    renderLightbox();
  }

  function stepLightbox(delta) {
    const n = lightboxState.items.length;
    if (!n) return;
    lightboxState.index = (lightboxState.index + delta + n) % n;
    renderLightbox();
  }

  function closeLightbox() {
    const node = document.getElementById('app-lightbox');
    if (node) { node.classList.add('hidden'); node.classList.remove('flex'); }
    document.body.style.overflow = '';
  }

  /* ============ Empty state & skeleton ============ */
  function emptyState(title, description, actionNode) {
    return el('div', { class: 'flex flex-col items-center justify-center gap-3 px-4 py-12 text-center' }, [
      el('div', { class: 'flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-400', html: icon('empty', 'h-8 w-8') }),
      el('p', { class: 'text-base font-bold text-plum', text: title || 'ยังไม่มีข้อมูล' }),
      el('p', { class: 'max-w-md text-sm text-slate-500', text: description || 'เมื่อมีการบันทึกข้อมูลเข้าสู่ระบบ รายการจะแสดงที่นี่' }),
      actionNode || null,
    ]);
  }

  function errorState(message, onRetry) {
    return el('div', { class: 'flex flex-col items-center justify-center gap-3 px-4 py-12 text-center' }, [
      el('div', { class: 'flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-500/10 text-danger-600', html: icon('warning', 'h-8 w-8') }),
      el('p', { class: 'text-base font-bold text-danger-600', text: 'ไม่สามารถโหลดข้อมูลได้' }),
      el('p', { class: 'max-w-md text-sm text-slate-500', text: message || 'กรุณาลองใหม่อีกครั้ง' }),
      onRetry ? el('button', { class: 'btn-secondary', type: 'button', onclick: onRetry, html: icon('refresh', 'h-4 w-4') + '<span>ลองใหม่อีกครั้ง</span>' }) : null,
    ]);
  }

  function skeletonRows(rows, cols) {
    const wrap = el('div', { class: 'space-y-2 p-4' });
    for (let i = 0; i < (rows || 5); i += 1) {
      const row = el('div', { class: 'flex items-center gap-3' });
      for (let c = 0; c < (cols || 4); c += 1) {
        row.appendChild(el('div', { class: `skeleton h-5 ${c === 1 ? 'flex-[3]' : 'flex-1'}` }));
      }
      wrap.appendChild(row);
    }
    return wrap;
  }

  /* ============ Pagination ============ */
  function pagination(meta, onGo) {
    const { page, totalPages, total, pageSize } = meta;
    const wrap = el('div', { class: 'flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row' });
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    wrap.appendChild(el('p', { class: 'text-xs text-slate-500', text: `แสดง ${num(from)}–${num(to)} จากทั้งหมด ${num(total)} รายการ` }));

    const nav = el('div', { class: 'flex flex-wrap items-center justify-center gap-1' });
    const btn = (label, target, disabled, active) => el('button', {
      type: 'button',
      class: `min-w-[2.25rem] rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
        active ? 'bg-brand-500 text-white' : disabled ? 'cursor-not-allowed text-slate-300' : 'text-slate-600 hover:bg-brand-50'}`,
      disabled: disabled ? true : null,
      text: label,
      onclick: disabled ? null : () => onGo(target),
    });

    nav.appendChild(btn('ก่อนหน้า', page - 1, page <= 1));
    const pages = [];
    for (let p = 1; p <= totalPages; p += 1) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
      else if (pages[pages.length - 1] !== '...') pages.push('...');
    }
    pages.forEach((p) => {
      if (p === '...') nav.appendChild(el('span', { class: 'px-1 text-xs text-slate-400', text: '...' }));
      else nav.appendChild(btn(String(p), p, false, p === page));
    });
    nav.appendChild(btn('ถัดไป', page + 1, page >= totalPages));
    wrap.appendChild(nav);
    return wrap;
  }

  /* ============ Modal ============ */
  function openModal(options) {
    const opts = options || {};
    const backdrop = el('div', {
      class: 'fixed inset-0 z-[1100] flex items-end justify-center bg-plum/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4',
      role: 'dialog', 'aria-modal': 'true',
    });
    const panel = el('div', {
      class: `w-full ${opts.size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] animate-pop overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl`,
    });

    const header = el('div', { class: 'sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4' }, [
      el('div', {}, [
        el('h3', { class: 'text-base font-bold text-plum sm:text-lg', text: opts.title || '' }),
        opts.subtitle ? el('p', { class: 'mt-0.5 text-xs text-slate-500', text: opts.subtitle }) : null,
      ]),
      el('button', { type: 'button', class: 'icon-btn text-slate-400 hover:bg-slate-100', 'aria-label': 'ปิด', html: icon('close', 'h-5 w-5'), onclick: () => close() }),
    ]);

    const body = el('div', { class: 'px-5 py-4' });
    if (opts.content) body.appendChild(opts.content);
    panel.appendChild(header);
    panel.appendChild(body);
    if (opts.footer) panel.appendChild(el('div', { class: 'sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end' }, opts.footer));
    backdrop.appendChild(panel);

    function close() {
      document.body.style.overflow = '';
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop && !opts.disableBackdropClose) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    const focusable = panel.querySelector('input, select, textarea, button');
    if (focusable) setTimeout(() => focusable.focus(), 60);
    return { close, panel, body };
  }

  /* ============ Field error helpers ============ */
  function setFieldError(input, message) {
    if (!input) return;
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');
    const holder = input.closest('[data-field]');
    const help = holder && holder.querySelector('[data-error]');
    if (help) { help.textContent = message; help.classList.add('show'); }
  }

  function clearFieldError(input) {
    if (!input) return;
    input.classList.remove('input-error');
    input.removeAttribute('aria-invalid');
    const holder = input.closest('[data-field]');
    const help = holder && holder.querySelector('[data-error]');
    if (help) { help.textContent = ''; help.classList.remove('show'); }
  }

  function clearAllErrors(root) {
    $$('[data-error]', root).forEach((e) => { e.textContent = ''; e.classList.remove('show'); });
    $$('.input-error', root).forEach((e) => e.classList.remove('input-error'));
  }

  /* ============ Settings / branding ============ */
  let settingsCache = null;
  async function loadSettings(force) {
    if (settingsCache && !force) return settingsCache;
    const res = await api('/api/public/settings', { skipAuthRedirect: true });
    settingsCache = res.data;
    return settingsCache;
  }

  function applyBranding(settings) {
    $$('[data-school-name]').forEach((n) => { n.textContent = settings.schoolName || ''; });
    $$('[data-affiliation-name]').forEach((n) => { n.textContent = settings.affiliationName || ''; });
    $$('[data-current-year]').forEach((n) => { n.textContent = String(new Date().getFullYear() + 543); });
    $$('[data-school-logo]').forEach((node) => {
      if (settings.schoolLogo) {
        const img = el('img', { src: settings.schoolLogo, alt: 'ตราสัญลักษณ์โรงเรียน', class: 'h-full w-full rounded-full object-cover' });
        clear(node);
        node.appendChild(img);
      } else {
        node.innerHTML = icon('school', 'h-2/3 w-2/3');
      }
    });
  }

  /** แทนที่ placeholder <span data-icon="ชื่อไอคอน"> ด้วย SVG จริง */
  function hydrateIcons(root) {
    $$('[data-icon]', root || document).forEach((node) => {
      if (node.dataset.iconDone) return;
      const size = node.className.match(/\bh-(\d+)\b/);
      node.innerHTML = icon(node.dataset.icon, size ? `h-${size[1]} w-${size[1]}` : 'h-5 w-5');
      node.dataset.iconDone = '1';
    });
  }

  global.App = {
    icon, hydrateIcons, $, $$, el, clear, thaiDate, num, todayISO, debounce,
    qualityBadge, SCORE_COLORS, SCORE_LABELS, PRACTICE_LABELS, practiceLabel, practiceBadge,
    showLoading, hideLoading, toast, alertSuccess, alertError, alertWarning, confirmDelete, confirmAction,
    api, apiUpload, ApiError,
    openLightbox, closeLightbox, emptyState, errorState, skeletonRows, pagination, openModal,
    setFieldError, clearFieldError, clearAllErrors,
    loadSettings, applyBranding,
  };
})(window);
