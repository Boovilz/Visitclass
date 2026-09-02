/**
 * ค่าตั้งต้นสำหรับรันด้วย PM2
 *   pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup      (ให้เริ่มเองอัตโนมัติเมื่อเซิร์ฟเวอร์รีบูต)
 */
module.exports = {
  apps: [
    {
      name: 'classroom-visit',
      script: 'server.js',
      instances: 1,          // ต้องเป็น 1 เท่านั้น — SQLite ไม่รองรับหลายโปรเซสเขียนพร้อมกัน
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      kill_timeout: 10000,   // ให้เวลาปิดฐานข้อมูลอย่างเรียบร้อย
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        SECURE_COOKIE: '1',  // ลบบรรทัดนี้ถ้ายังไม่ได้ติดตั้ง HTTPS
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      time: true,
    },
  ],
};
