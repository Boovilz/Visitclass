'use strict';
/** ตั้งค่าระบบ: ชื่อโรงเรียน / ต้นสังกัด / โลโก้ / PIN ผู้ดูแล */
const express = require('express');
const { run, getSettings, now } = require('../lib/db');
const { requiredText, toBool, pin4, bad } = require('../lib/validate');
const { uploadLogo, storeFile, removeFile } = require('../lib/uploads');
const auth = require('../lib/auth');

const router = express.Router();

async function publicSettings() {
  const s = await getSettings();
  // ไม่คืนค่า admin_pin_hash / admin_pin_salt ให้ frontend เด็ดขาด
  return {
    schoolName: s.school_name,
    affiliationName: s.affiliation_name,
    schoolLogo: s.school_logo,
    requireImages: !!s.require_images,
    pinConfigured: !!s.admin_pin_hash,
    updatedAt: s.updated_at,
  };
}

router.get('/', async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await publicSettings() });
  } catch (e) {
    next(e);
  }
});

router.put('/', (req, res, next) => {
  uploadLogo(req, res, async (err) => {
    if (err) return next(err);
    let storedLogo = null;
    try {
      const body = req.body || {};
      const schoolName = requiredText(body.schoolName, 'ชื่อโรงเรียน', { min: 2, max: 200 });
      const affiliationName = requiredText(body.affiliationName, 'ชื่อหน่วยงานต้นสังกัด', { min: 2, max: 200 });
      const requireImages = toBool(body.requireImages) ? 1 : 0;

      const current = await getSettings();
      let logo = current.school_logo;
      if (req.file) {
        storedLogo = await storeFile(req.file);
        logo = storedLogo.url;
      } else if (toBool(body.removeLogo)) {
        logo = null;
      }

      // เปลี่ยน PIN เฉพาะเมื่อมีการกรอกเข้ามา
      const wantsPinChange = body.pin !== undefined && String(body.pin).trim() !== '';
      if (wantsPinChange) {
        const pin = pin4(body.pin, 'PIN ผู้ดูแลระบบ');
        const confirm = pin4(body.pinConfirm, 'การยืนยัน PIN');
        if (pin !== confirm) throw bad('PIN และการยืนยัน PIN ไม่ตรงกัน', { field: 'pinConfirm' });
        if (/^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '0123') {
          throw bad('PIN คาดเดาง่ายเกินไป กรุณาตั้ง PIN ที่ปลอดภัยกว่านี้', { field: 'pin' });
        }
        await auth.setPin(pin);
      }

      await run(
        `UPDATE system_settings SET school_name = $1, affiliation_name = $2, school_logo = $3,
         require_images = $4, updated_at = $5 WHERE id = 1`,
        [schoolName, affiliationName, logo, requireImages, now()]
      );

      // ลบโลโก้เดิมหลังบันทึกสำเร็จแล้วเท่านั้น
      if (storedLogo && current.school_logo && current.school_logo !== logo) {
        await removeFile(current.school_logo);
      }

      res.json({ ok: true, message: 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว', data: await publicSettings() });
    } catch (e) {
      if (storedLogo) await removeFile(storedLogo.url);
      next(e);
    }
  });
});

module.exports = router;
