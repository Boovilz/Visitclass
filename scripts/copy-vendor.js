'use strict';
/** คัดลอกไลบรารีจาก node_modules มาไว้ที่ public/vendor เพื่อให้ระบบทำงานได้แม้ไม่มีอินเทอร์เน็ต */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'vendor');
fs.mkdirSync(OUT, { recursive: true });

const FILES = [
  ['sweetalert2/dist/sweetalert2.all.min.js', 'sweetalert2.all.min.js'],
  ['chart.js/dist/chart.umd.js', 'chart.umd.js'],
];

for (const [from, to] of FILES) {
  const src = path.join(ROOT, 'node_modules', from);
  if (!fs.existsSync(src)) {
    console.error(`ไม่พบไฟล์: ${from} (ข้าม)`);
    continue;
  }
  fs.copyFileSync(src, path.join(OUT, to));
  console.log(`copied ${to}`);
}
