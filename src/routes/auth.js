'use strict';
/** เข้าสู่ระบบผู้ดูแลด้วย PIN 4 หลัก (มีการหน่วงเวลาเมื่อกรอกผิดหลายครั้ง) */
const express = require('express');
const { wrap } = require('../lib/http');
const { getSettings } = require('../lib/db');
const { pin4, HttpError } = require('../lib/validate');
const auth = require('../lib/auth');

const router = express.Router();

const clientIp = (req) => req.ip || req.socket.remoteAddress || 'unknown';

router.get('/session', wrap(async (req, res) => {
  const session = auth.currentSession(req);
  res.json({ ok: true, data: { authenticated: !!session, expiresAt: session ? session.exp : null } });
}));

router.post('/login', wrap(async (req, res) => {
  const ip = clientIp(req);
  const state = await auth.throttleState(ip);
  if (state.locked) {
    throw new HttpError(429, `กรอก PIN ผิดหลายครั้งเกินไป กรุณารอ ${state.retryAfter} วินาที แล้วลองใหม่อีกครั้ง`);
  }

  const settings = await getSettings();
  if (!settings.admin_pin_hash) {
    throw new HttpError(409, 'ระบบยังไม่ได้ตั้งค่า PIN ผู้ดูแล กรุณาตั้งค่าที่ไฟล์เริ่มต้นระบบก่อน');
  }

  const pin = pin4(req.body && req.body.pin);
  if (!(await auth.verifyPin(pin))) {
    const after = await auth.registerFailure(ip);
    const message = after.locked
      ? `กรอก PIN ผิดหลายครั้งเกินไป ระบบระงับการเข้าสู่ระบบชั่วคราว ${after.retryAfter} วินาที`
      : `PIN ไม่ถูกต้อง เหลือโอกาสอีก ${after.remaining} ครั้ง`;
    throw new HttpError(after.locked ? 429 : 401, message);
  }

  await auth.resetFailures(ip);
  const session = auth.issueSession(res);
  res.json({ ok: true, message: 'เข้าสู่ระบบสำเร็จ', data: { expiresAt: session.exp } });
}));

router.post('/logout', wrap(async (req, res) => {
  auth.clearSession(res);
  res.json({ ok: true, message: 'ออกจากระบบเรียบร้อยแล้ว', data: {} });
}));

module.exports = router;
