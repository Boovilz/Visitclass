'use strict';
/**
 * ระบบแบบเยี่ยมชั้นเรียน — Express server
 * แยกชั้นการทำงาน: routes (HTTP) / lib (business logic + data access) / public (UI)
 */
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const pkg = require('./package.json');

const { cookieParser, errorHandler } = require('./src/lib/http');
const { requireAdmin, currentSession } = require('./src/lib/auth');
const { UPLOAD_DIR } = require('./src/lib/uploads');
const { migrate, closeDatabase } = require('./src/lib/db');
const { bootstrapIfEmpty } = require('./src/lib/bootstrap');
const { missingConfig, setupPage } = require('./src/lib/setup-check');

const publicRoutes = require('./src/routes/public');
const authRoutes = require('./src/routes/auth');
const settingsRoutes = require('./src/routes/settings');
const mastersRoutes = require('./src/routes/masters');
const evaluationRoutes = require('./src/routes/evaluations');
const summaryRoutes = require('./src/routes/summary');
const dashboardRoutes = require('./src/routes/dashboard');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ---------------- Security headers ---------------- */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ')
  );
  next();
});

// เตรียมโครงสร้างฐานข้อมูลครั้งเดียวต่อโปรเซส ก่อนให้บริการคำขอแรก
let readyPromise = null;
app.use((req, res, next) => {
  // ยังตั้งค่าไม่ครบ (deploy ครั้งแรกบน Vercel) — บอกขั้นตอนที่ค้างแทนการขึ้น error
  const missing = missingConfig();
  if (missing.length) {
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({
        ok: false,
        message: 'ระบบยังตั้งค่าไม่เสร็จ: ' + missing.map((m) => m.title).join(' · '),
      });
    }
    return res.status(503).type('html').send(setupPage(missing));
  }

  if (!readyPromise) {
    readyPromise = migrate()
      .then(() => bootstrapIfEmpty())
      .catch((err) => { readyPromise = null; throw err; }); // ให้ลองใหม่ได้เมื่อตั้งค่าเสร็จ
  }
  readyPromise.then(() => next()).catch(next);
});

app.use(cookieParser);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

/* ---------------- Static ---------------- */
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  index: false,
  setHeaders: (res) => {
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));
// ไฟล์ .html ต้องเข้าผ่าน route ของหน้าเว็บเท่านั้น (เพื่อให้ผ่านการตรวจสอบสิทธิ์และการใส่เวอร์ชันไฟล์)
const HTML_ALIASES = {
  '/index.html': '/',
  '/admin.html': '/admin',
  '/evaluation-detail.html': '/admin/evaluation',
  '/summary-detail.html': '/admin/summary-detail',
};
app.use((req, res, next) => {
  if (!req.path.toLowerCase().endsWith('.html')) return next();
  const alias = HTML_ALIASES[req.path.toLowerCase()];
  return alias ? res.redirect(301, alias) : res.status(404).json({ ok: false, message: 'ไม่พบหน้าที่ต้องการ' });
});
app.use(express.static(PUBLIC_DIR, {
  index: false,
  etag: true,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
}));

/* ---------------- API ---------------- */
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/settings', requireAdmin, settingsRoutes);
app.use('/api/admin/masters', requireAdmin, mastersRoutes);
app.use('/api/admin/evaluations', requireAdmin, evaluationRoutes);
app.use('/api/admin/summary', requireAdmin, summaryRoutes);
app.use('/api/admin/dashboard', requireAdmin, dashboardRoutes);

app.use('/api', (_req, res) => res.status(404).json({ ok: false, message: 'ไม่พบ API ที่เรียกใช้' }));

/* ---------------- Pages ---------------- */
/**
 * แทนที่ placeholder __ASSET_V__ ในไฟล์ HTML ด้วยเวอร์ชันที่คำนวณจากเวลาแก้ไขไฟล์จริง
 * ทำให้เบราว์เซอร์โหลด CSS/JS ใหม่ทันทีเมื่อระบบถูกอัปเดต โดยยังใช้ cache ได้ตามปกติ
 */
function assetVersion() {
  const targets = [path.join(PUBLIC_DIR, 'css'), path.join(PUBLIC_DIR, 'js')];
  let stamp = 0;
  for (const dir of targets) {
    for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      stamp = Math.max(stamp, fs.statSync(path.join(dir, name)).mtimeMs);
    }
  }
  return `${pkg.version}.${Math.floor(stamp).toString(36)}`;
}

const htmlCache = new Map();

const page = (file) => (_req, res, next) => {
  try {
    const version = assetVersion();
    const cached = htmlCache.get(file);
    let html = cached && cached.version === version ? cached.html : null;
    if (!html) {
      html = fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8').split('__ASSET_V__').join(version);
      htmlCache.set(file, { version, html });
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  } catch (err) {
    // ไฟล์หน้าเว็บหาย = การ deploy ไม่สมบูรณ์ (ไฟล์ public/ ไม่ถูกรวมเข้า bundle)
    next(new Error(`อ่านไฟล์หน้าเว็บ ${file} ไม่ได้ — การ deploy อาจไม่สมบูรณ์ (${err.code || err.message})`));
  }
};

/** ตรวจสอบสิทธิ์ก่อนเข้าหน้าผู้ดูแลทุกครั้ง — ถ้าเซสชันหมดอายุให้กลับไปหน้ากรอก PIN */
function adminPageGuard(req, res, next) {
  if (!currentSession(req)) return res.redirect('/?session=expired');
  next();
}

app.get('/', page('index.html'));
app.get('/admin', adminPageGuard, page('admin.html'));
app.get('/admin/evaluation', adminPageGuard, page('evaluation-detail.html'));
app.get('/admin/summary-detail', adminPageGuard, page('summary-detail.html'));

app.use((req, res, next) => { res.status(404); page("404.html")(req, res, next); });
app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`\n  ระบบแบบเยี่ยมชั้นเรียน พร้อมใช้งานที่ http://localhost:${PORT}\n`);
  });

  // ปิดระบบอย่างเรียบร้อยเมื่อถูกสั่งหยุด (สำคัญกับ SQLite เพื่อให้ WAL ถูก checkpoint ครบ)
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n  ได้รับสัญญาณ ${signal} — กำลังปิดระบบ...`);
    server.close(() => {
      closeDatabase().catch(() => {}).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref(); // กันค้างเกิน 10 วินาที
  };
  ['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));
}

module.exports = app;
