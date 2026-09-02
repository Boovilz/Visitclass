'use strict';
/**
 * เตรียมโฟลเดอร์ dist/ สำหรับให้ Vercel เสิร์ฟเป็นไฟล์สแตติกผ่าน CDN
 *
 * เอาเฉพาะไฟล์ที่เสิร์ฟตรง ๆ ได้ (css / js / vendor)
 * ไม่รวมไฟล์ .html เพราะหน้าเว็บต้องผ่านตัวแอปก่อน เพื่อ:
 *   - แทนที่ __ASSET_V__ ด้วยเลขเวอร์ชันไฟล์
 *   - ตรวจสอบสิทธิ์ก่อนเข้าหน้าผู้ดูแล
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'public');
const TARGET = path.join(ROOT, 'dist');
const FOLDERS = ['css', 'js', 'vendor'];

fs.rmSync(TARGET, { recursive: true, force: true });
fs.mkdirSync(TARGET, { recursive: true });

let copied = 0;
for (const folder of FOLDERS) {
  const from = path.join(SOURCE, folder);
  if (!fs.existsSync(from)) continue;
  const to = path.join(TARGET, folder);
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name);
    if (!fs.statSync(src).isFile()) continue;
    fs.copyFileSync(src, path.join(to, name));
    copied += 1;
  }
}

console.log(`เตรียมไฟล์สแตติกใน dist/ แล้ว ${copied} ไฟล์ (ไม่รวม .html ซึ่งต้องผ่านตัวแอป)`);
