import type { Locale } from '@income-expenses/shared';
import type { MailMessage } from '../../lib/mailer.js';

interface Copy {
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  expires: (minutes: number) => string;
  ignore: string;
  signature: string;
}

/** Email copy per account language (users.locale). Lao: written by AI — needs native review. */
const COPY: Record<Locale, Copy> = {
  th: {
    subject: 'รหัสสำหรับตั้งรหัสผ่านใหม่',
    greeting: (name) => `สวัสดี ${name}`,
    intro: 'มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ ใช้รหัสนี้ในหน้า "ลืมรหัสผ่าน":',
    expires: (minutes) => `รหัสนี้ใช้ได้ ${minutes} นาที และใช้ได้ครั้งเดียว`,
    ignore: 'ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ และอย่าบอกรหัสนี้กับใคร',
    signature: 'Income & Expenses',
  },
  en: {
    subject: 'Your password reset code',
    greeting: (name) => `Hello ${name}`,
    intro:
      'Someone asked to reset the password of your account. Enter this code on the "Forgot password" page:',
    expires: (minutes) => `The code works for ${minutes} minutes, and only once.`,
    ignore:
      'If this was not you, do nothing — your password stays the same. Never share this code with anyone.',
    signature: 'Income & Expenses',
  },
  lo: {
    subject: 'ລະຫັດສຳລັບຕັ້ງລະຫັດຜ່ານໃໝ່',
    greeting: (name) => `ສະບາຍດີ ${name}`,
    intro: 'ມີຄຳຂໍຕັ້ງລະຫັດຜ່ານໃໝ່ສຳລັບບັນຊີຂອງທ່ານ ໃຫ້ໃຊ້ລະຫັດນີ້ໃນໜ້າ "ລືມລະຫັດຜ່ານ":',
    expires: (minutes) => `ລະຫັດນີ້ໃຊ້ໄດ້ ${minutes} ນາທີ ແລະ ໃຊ້ໄດ້ຄັ້ງດຽວ`,
    ignore:
      'ຖ້າທ່ານບໍ່ໄດ້ຂໍ ບໍ່ຕ້ອງເຮັດຫຍັງ ລະຫັດຜ່ານເດີມຍັງໃຊ້ໄດ້ຕາມປົກກະຕິ ແລະ ຢ່າບອກລະຫັດນີ້ໃຫ້ໃຜ',
    signature: 'Income & Expenses',
  },
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export function buildResetEmail(input: {
  to: string;
  displayName: string;
  code: string;
  locale: Locale;
  minutes: number;
}): MailMessage {
  const copy = COPY[input.locale];
  // The display name is user input: escaped in HTML, and kept out of the subject line.
  const name = escapeHtml(input.displayName);
  const text = [
    copy.greeting(input.displayName),
    '',
    copy.intro,
    '',
    `    ${input.code}`,
    '',
    copy.expires(input.minutes),
    copy.ignore,
    '',
    copy.signature,
  ].join('\n');

  const html = `<!doctype html>
<html lang="${input.locale}">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:'Noto Sans Thai','Noto Sans Lao','Phetsarath OT',Arial,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
    <p style="margin:0 0 12px">${copy.greeting(name)}</p>
    <p style="margin:0 0 20px;line-height:1.6">${escapeHtml(copy.intro)}</p>
    <p style="margin:0 0 20px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;font-family:Consolas,monospace">${input.code}</p>
    <p style="margin:0 0 8px;color:#475569;line-height:1.6">${escapeHtml(copy.expires(input.minutes))}</p>
    <p style="margin:0 0 20px;color:#475569;line-height:1.6">${escapeHtml(copy.ignore)}</p>
    <p style="margin:0;color:#64748b;font-size:13px">${copy.signature}</p>
  </div>
</body>
</html>`;

  return { to: input.to, subject: copy.subject, text, html };
}
