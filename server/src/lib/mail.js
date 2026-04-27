const nodemailer = require('nodemailer');

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error('Missing SMTP config (SMTP_HOST/SMTP_USER/SMTP_PASS)');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendMail({ to, subject, html }) {
  const from = process.env.SMTP_FROM || 'StreamTalk <no-reply@streamtalk.local>';
  const transport = getTransport();
  await transport.sendMail({ from, to, subject, html });
}

module.exports = { sendMail };

