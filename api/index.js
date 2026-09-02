'use strict';
/**
 * จุดเข้าใช้งานสำหรับ Vercel Serverless Function
 * Vercel จะส่งทุกคำขอมาที่ไฟล์นี้ (ดูการตั้งค่า rewrites ใน vercel.json)
 */
module.exports = require('../server.js');
