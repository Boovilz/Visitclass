/* คอมโพเนนต์ที่ใช้ซ้ำทั้งระบบ: Searchable Dropdown, ตัวอัปโหลดรูปภาพ, Modal กรอก PIN */
(function (global) {
  'use strict';
  const { el, icon, $, $$, clear, api, alertError, toast, showLoading, hideLoading } = global.App;

  /* ==================================================================
   * SearchableSelect — dropdown ที่พิมพ์ค้นหาภาษาไทยได้
   * ================================================================== */
  class SearchableSelect {
    /**
     * @param {HTMLElement} mount จุดที่ต้องการวางคอมโพเนนต์
     * @param {object} options { placeholder, searchPlaceholder, items:[{value,label,sublabel}], onChange, allowClear }
     */
    constructor(mount, options) {
      this.mount = mount;
      this.opts = Object.assign({ placeholder: '-- เลือก --', searchPlaceholder: 'พิมพ์เพื่อค้นหา...', allowClear: false }, options || {});
      this.items = this.opts.items || [];
      this.value = this.opts.value != null ? String(this.opts.value) : '';
      this.open = false;
      this.activeIndex = -1;
      this.filtered = this.items.slice();
      this.render();
    }

    render() {
      clear(this.mount);
      this.mount.classList.add('relative');

      this.button = el('button', {
        type: 'button',
        class: 'input flex items-center justify-between gap-2 text-left',
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false',
        onclick: () => this.toggle(),
        onkeydown: (e) => {
          if (['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); this.toggle(true); }
        },
      });
      this.labelNode = el('span', { class: 'truncate text-slate-400', text: this.opts.placeholder });
      this.button.appendChild(this.labelNode);
      this.button.appendChild(el('span', { class: 'shrink-0 text-slate-400', html: icon('arrowDown', 'h-4 w-4') }));

      this.panel = el('div', {
        class: 'absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card',
      });
      const searchWrap = el('div', { class: 'relative border-b border-slate-100 p-2' });
      this.search = el('input', {
        type: 'text',
        class: 'w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
        placeholder: this.opts.searchPlaceholder,
        autocomplete: 'off',
        oninput: () => this.filter(),
        onkeydown: (e) => this.onSearchKey(e),
      });
      searchWrap.appendChild(el('span', { class: 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400', html: icon('search', 'h-4 w-4') }));
      searchWrap.appendChild(this.search);

      this.list = el('ul', { class: 'max-h-56 overflow-y-auto py-1', role: 'listbox' });
      this.panel.appendChild(searchWrap);
      this.panel.appendChild(this.list);

      this.mount.appendChild(this.button);
      this.mount.appendChild(this.panel);

      this.onDocClick = (e) => { if (!this.mount.contains(e.target)) this.close(); };
      document.addEventListener('mousedown', this.onDocClick);

      this.syncLabel();
      this.filter();
    }

    setItems(items, keepValue) {
      this.items = items || [];
      if (!keepValue) this.value = '';
      this.filter();
      this.syncLabel();
    }

    setValue(value, silent) {
      this.value = value == null ? '' : String(value);
      this.syncLabel();
      if (!silent && this.opts.onChange) this.opts.onChange(this.value, this.selectedItem());
    }

    selectedItem() {
      return this.items.find((i) => String(i.value) === this.value) || null;
    }

    syncLabel() {
      const item = this.selectedItem();
      this.labelNode.textContent = item ? item.label : this.opts.placeholder;
      this.labelNode.className = item ? 'truncate text-slate-800' : 'truncate text-slate-400';
    }

    filter() {
      const q = (this.search ? this.search.value : '').trim().toLowerCase();
      this.filtered = !q
        ? this.items.slice()
        : this.items.filter((i) => `${i.label} ${i.sublabel || ''}`.toLowerCase().includes(q));
      this.renderList();
    }

    renderList() {
      clear(this.list);
      if (!this.filtered.length) {
        this.list.appendChild(el('li', { class: 'px-3 py-6 text-center text-sm text-slate-400', text: 'ไม่พบข้อมูลที่ค้นหา' }));
        return;
      }
      this.filtered.forEach((item, index) => {
        const selected = String(item.value) === this.value;
        const li = el('li', {
          role: 'option',
          'aria-selected': selected ? 'true' : 'false',
          class: `flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm transition ${
            index === this.activeIndex ? 'bg-brand-50' : ''} ${selected ? 'font-bold text-brand-600' : 'text-slate-700 hover:bg-slate-50'}`,
          onmousedown: (e) => { e.preventDefault(); this.choose(item); },
          onmouseenter: () => { this.activeIndex = index; this.highlight(); },
        }, [
          el('span', { class: 'flex flex-col' }, [
            el('span', { text: item.label }),
            item.sublabel ? el('span', { class: 'text-xs font-normal text-slate-400', text: item.sublabel }) : null,
          ]),
          selected ? el('span', { class: 'text-brand-500', html: icon('check', 'h-4 w-4') }) : null,
        ]);
        this.list.appendChild(li);
      });
      this.highlight();
    }

    highlight() {
      Array.from(this.list.children).forEach((li, i) => li.classList.toggle('bg-brand-50', i === this.activeIndex));
    }

    onSearchKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.activeIndex = Math.min(this.filtered.length - 1, this.activeIndex + 1); this.highlight(); this.scrollActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.activeIndex = Math.max(0, this.activeIndex - 1); this.highlight(); this.scrollActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (this.filtered[this.activeIndex]) this.choose(this.filtered[this.activeIndex]); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); this.button.focus(); }
    }

    scrollActive() {
      const node = this.list.children[this.activeIndex];
      if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
    }

    choose(item) {
      this.setValue(item.value);
      this.close();
      this.button.focus();
      global.App.clearFieldError(this.button);
    }

    toggle(forceOpen) {
      if (this.open && !forceOpen) this.close();
      else this.openPanel();
    }

    openPanel() {
      this.open = true;
      this.panel.classList.remove('hidden');
      this.button.setAttribute('aria-expanded', 'true');
      this.activeIndex = this.filtered.findIndex((i) => String(i.value) === this.value);
      this.search.value = '';
      this.filter();
      setTimeout(() => this.search.focus(), 30);
    }

    close() {
      this.open = false;
      this.panel.classList.add('hidden');
      this.button.setAttribute('aria-expanded', 'false');
    }

    destroy() {
      document.removeEventListener('mousedown', this.onDocClick);
    }
  }

  /* ==================================================================
   * ImageUploader — drag & drop + preview + ย่อขนาดก่อนอัปโหลด
   * ================================================================== */
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024;
  const MAX_FILES = 10;
  const MAX_DIMENSION = 1600;

  class ImageUploader {
    constructor(mount, options) {
      this.mount = mount;
      this.opts = options || {};
      this.files = []; // { id, file, previewUrl, name, size }
      this.render();
    }

    render() {
      clear(this.mount);
      this.dropzone = el('div', {
        class: 'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50',
        tabindex: '0',
        role: 'button',
        'aria-label': 'เลือกหรือลากไฟล์รูปภาพมาวางที่นี่',
      });
      this.dropzone.appendChild(el('span', { class: 'text-brand-500', html: icon('upload', 'h-8 w-8') }));
      this.dropzone.appendChild(el('p', { class: 'text-sm font-bold text-plum', text: 'ลากไฟล์รูปภาพมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์' }));
      this.dropzone.appendChild(el('p', { class: 'text-xs text-slate-500', text: `รองรับ JPG, JPEG, PNG, WEBP ขนาดไม่เกิน 5 MB ต่อไฟล์ (สูงสุด ${MAX_FILES} ไฟล์)` }));

      this.input = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'hidden' });
      this.input.addEventListener('change', () => { this.addFiles(Array.from(this.input.files || [])); this.input.value = ''; });

      this.dropzone.addEventListener('click', () => this.input.click());
      this.dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.input.click(); } });
      ['dragenter', 'dragover'].forEach((ev) => this.dropzone.addEventListener(ev, (e) => {
        e.preventDefault(); this.dropzone.classList.add('border-brand-500', 'bg-brand-100/70');
      }));
      ['dragleave', 'drop'].forEach((ev) => this.dropzone.addEventListener(ev, (e) => {
        e.preventDefault(); this.dropzone.classList.remove('border-brand-500', 'bg-brand-100/70');
      }));
      this.dropzone.addEventListener('drop', (e) => {
        const dropped = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
        this.addFiles(dropped);
      });

      this.grid = el('div', { class: 'mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' });
      this.counter = el('p', { class: 'mt-3 text-xs font-semibold text-slate-500' });

      this.mount.appendChild(this.dropzone);
      this.mount.appendChild(this.input);
      this.mount.appendChild(this.grid);
      this.mount.appendChild(this.counter);
      this.renderList();
    }

    async addFiles(list) {
      const errors = [];
      for (const file of list) {
        if (this.files.length >= MAX_FILES) { errors.push(`เลือกได้สูงสุด ${MAX_FILES} ไฟล์`); break; }
        if (!ALLOWED_TYPES.includes(file.type)) { errors.push(`"${file.name}" ไม่ใช่ไฟล์ JPG, PNG หรือ WEBP`); continue; }
        if (file.size > MAX_SIZE) { errors.push(`"${file.name}" มีขนาดเกิน 5 MB`); continue; }
        if (this.files.some((f) => f.name === file.name && f.rawSize === file.size)) continue;

        const processed = await this.compress(file);
        this.files.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: processed,
          rawSize: file.size,
          name: file.name,
          size: processed.size,
          previewUrl: URL.createObjectURL(processed),
        });
      }
      this.renderList();
      if (errors.length) alertError('ไฟล์บางรายการไม่ถูกต้อง', errors.map((e) => `<div class="text-sm">${e.replace(/[<>]/g, '')}</div>`).join(''));
      if (this.opts.onChange) this.opts.onChange(this.files);
    }

    /** ย่อรูปด้วย canvas เพื่อลดขนาดไฟล์ก่อนอัปโหลด (ถ้าย่อแล้วไม่เล็กลงจะใช้ไฟล์เดิม) */
    compress(file) {
      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
          if (scale === 1 && file.size < 1024 * 1024) { URL.revokeObjectURL(url); return resolve(file); }
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url);
            if (!blob || blob.size >= file.size) return resolve(file);
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.85);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
      });
    }

    remove(id) {
      const idx = this.files.findIndex((f) => f.id === id);
      if (idx < 0) return;
      URL.revokeObjectURL(this.files[idx].previewUrl);
      this.files.splice(idx, 1);
      this.renderList();
      if (this.opts.onChange) this.opts.onChange(this.files);
    }

    renderList() {
      clear(this.grid);
      this.files.forEach((f) => {
        const card = el('figure', { class: 'group relative overflow-hidden rounded-xl border border-slate-200 bg-white' });
        card.appendChild(el('img', {
          src: f.previewUrl, alt: f.name, class: 'h-28 w-full cursor-zoom-in object-cover',
          onclick: () => global.App.openLightbox(this.files.map((x) => ({ src: x.previewUrl, caption: x.name })), this.files.indexOf(f)),
        }));
        card.appendChild(el('figcaption', { class: 'truncate px-2 py-1.5 text-[11px] text-slate-500', text: `${f.name} · ${(f.size / 1024).toFixed(0)} KB` }));
        card.appendChild(el('button', {
          type: 'button',
          class: 'absolute left-1.5 top-1.5 rounded-full bg-danger-600 p-1.5 text-white opacity-90 transition hover:bg-[#B71C1C]',
          'aria-label': `ลบรูป ${f.name}`,
          html: icon('close', 'h-3.5 w-3.5'),
          onclick: () => this.remove(f.id),
        }));
        this.grid.appendChild(card);
      });
      this.counter.textContent = this.files.length ? `เลือกรูปภาพแล้ว ${this.files.length} จาก ${MAX_FILES} ไฟล์` : 'ยังไม่ได้เลือกรูปภาพ (ไม่บังคับ)';
    }

    reset() {
      this.files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      this.files = [];
      this.renderList();
    }

    getFiles() { return this.files.map((f) => f.file); }
  }

  /* ==================================================================
   * PinModal — เข้าสู่ระบบผู้ดูแลด้วย PIN 4 หลัก
   * ================================================================== */
  function openPinModal() {
    let pin = '';
    let busy = false;

    const dots = el('div', { class: 'flex justify-center gap-3' });
    const dotNodes = [];
    for (let i = 0; i < 4; i += 1) {
      const d = el('div', {
        class: 'flex h-12 w-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 text-2xl font-bold text-plum sm:h-14 sm:w-12',
      });
      dotNodes.push(d);
      dots.appendChild(d);
    }

    const hint = el('p', { class: 'mt-3 text-center text-xs text-slate-500', text: 'กรุณาใส่รหัส PIN 4 หลัก' });

    function paint() {
      dotNodes.forEach((d, i) => {
        d.textContent = i < pin.length ? '•' : '';
        d.className = `flex h-12 w-11 items-center justify-center rounded-xl border-2 text-2xl font-bold text-plum sm:h-14 sm:w-12 ${
          i < pin.length ? 'border-brand-500 bg-brand-50' : i === pin.length ? 'border-brand-300 bg-white' : 'border-slate-200 bg-slate-50'}`;
      });
    }

    const keypad = el('div', { class: 'mt-5 grid grid-cols-3 gap-2.5' });
    const keyBtn = (label, handler, extraClass, ariaLabel) => el('button', {
      type: 'button',
      class: `flex h-14 items-center justify-center rounded-xl text-xl font-bold transition active:scale-95 ${extraClass || 'bg-slate-100 text-plum hover:bg-brand-50'}`,
      'aria-label': ariaLabel || label,
      onclick: handler,
    }, typeof label === 'string' ? label : undefined);

    function push(n) {
      if (busy || pin.length >= 4) return;
      pin += n;
      paint();
      if (pin.length === 4) setTimeout(submit, 120);
    }
    function backspace() { if (busy) return; pin = pin.slice(0, -1); paint(); }

    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((n) => keypad.appendChild(keyBtn(n, () => push(n))));
    const delBtn = keyBtn('', backspace, 'bg-amber2-500/20 text-[#7A4F01] hover:bg-amber2-500/30', 'ลบตัวเลข');
    delBtn.innerHTML = icon('back', 'h-6 w-6');
    keypad.appendChild(delBtn);
    keypad.appendChild(keyBtn('0', () => push('0')));
    const okBtn = keyBtn('', () => submit(), 'bg-brand-500 text-white hover:bg-brand-600', 'ยืนยัน');
    okBtn.innerHTML = icon('check', 'h-6 w-6');
    keypad.appendChild(okBtn);

    const content = el('div', {}, [
      el('div', { class: 'mb-4 flex flex-col items-center gap-2' }, [
        el('div', { class: 'flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500', html: icon('lock', 'h-7 w-7') }),
        el('p', { class: 'text-sm text-slate-500', text: 'เฉพาะผู้ดูแลระบบเท่านั้น' }),
      ]),
      dots, hint, keypad,
    ]);

    const modal = global.App.openModal({
      title: 'เข้าสู่ระบบผู้ดูแล',
      subtitle: 'ระบบแบบเยี่ยมชั้นเรียน',
      content,
      onClose: () => document.removeEventListener('keydown', onKey),
    });

    function onKey(e) {
      if (/^\d$/.test(e.key)) { e.preventDefault(); push(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    }
    document.addEventListener('keydown', onKey);
    paint();

    async function submit() {
      if (busy) return;
      if (pin.length !== 4) {
        hint.textContent = 'กรุณาใส่รหัส PIN ให้ครบ 4 หลัก';
        hint.className = 'mt-3 text-center text-xs font-semibold text-danger-600';
        return;
      }
      busy = true;
      showLoading('กำลังตรวจสอบรหัส PIN...');
      try {
        await api('/api/auth/login', { method: 'POST', body: { pin }, skipAuthRedirect: true });
        hideLoading();
        modal.close();
        toast('success', 'เข้าสู่ระบบสำเร็จ');
        setTimeout(() => { window.location.href = '/admin'; }, 500);
      } catch (err) {
        hideLoading();
        busy = false;
        pin = '';
        paint();
        hint.textContent = err.message;
        hint.className = 'mt-3 text-center text-xs font-semibold text-danger-600';
        await alertError('เข้าสู่ระบบไม่สำเร็จ', err.message);
      }
    }
  }

  global.App.SearchableSelect = SearchableSelect;
  global.App.ImageUploader = ImageUploader;
  global.App.openPinModal = openPinModal;
})(window);
