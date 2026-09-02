'use strict';
/**
 * จุดเข้าใช้งานสำหรับ Vercel Serverless Function
 * Vercel ส่งทุกคำขอมาที่ไฟล์นี้ (ดูการตั้งค่า rewrites ใน vercel.json)
 *
 * ถ้าโหลดตัวแอปไม่สำเร็จ Vercel จะขึ้นแค่ FUNCTION_INVOCATION_FAILED
 * ซึ่งไม่บอกสาเหตุอะไรเลย จึงดักไว้เองเพื่อให้เห็นข้อความจริง
 */
let app = null;
let loadError = null;

try {
  app = require('../server.js');
} catch (err) {
  loadError = err;
  console.error('[startup] โหลดระบบไม่สำเร็จ:', err && err.stack ? err.stack : err);
}

module.exports = (req, res) => {
  if (app) return app(req, res);

  const detail = loadError ? `${loadError.code ? loadError.code + ': ' : ''}${loadError.message}` : 'ไม่ทราบสาเหตุ';
  res.statusCode = 500;

  if (req.url && req.url.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, message: `ระบบเริ่มทำงานไม่สำเร็จ — ${detail}` }));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>ระบบเริ่มทำงานไม่สำเร็จ</title>
<style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;
justify-content:center;padding:24px;background:#F8FAFC;color:#334155}
.c{max-width:620px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:26px}
h1{margin:0 0 8px;font-size:19px;color:#B91C1C}
pre{background:#0f172a;color:#fca5a5;padding:12px;border-radius:10px;overflow:auto;font-size:13px;white-space:pre-wrap}
p{font-size:14px;line-height:1.6}</style></head>
<body><div class="c"><h1>ระบบเริ่มทำงานไม่สำเร็จ</h1>
<p>เกิดข้อผิดพลาดตอนโหลดระบบ ข้อความจากเซิร์ฟเวอร์:</p>
<pre>${String(detail).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>
<p>ตรวจดูรายละเอียดเพิ่มเติมได้ที่ Vercel &rarr; Deployment &rarr; <b>Runtime Logs</b></p>
</div></body></html>`);
};
