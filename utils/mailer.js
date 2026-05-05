const nodemailer = require('nodemailer')

function createTransport() {
  const host = process.env.SMTP_HOST
  if (!host) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  })
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} [html]
 */
async function sendMail({ to, subject, text, html }) {
  const tx = createTransport()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@healthguardian.local'

  if (!tx) {
    console.log('\n[mailer:dev] ─────────────────────────────────────')
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(text)
    console.log('[mailer:dev] ─────────────────────────────────────\n')
    return { skipped: true }
  }

  await tx.sendMail({ from, to, subject, text, html: html || text.replace(/\n/g, '<br/>') })
  return { skipped: false }
}

async function sendOtpEmail(to, code, purpose) {
  const subject =
    purpose === 'login'
      ? 'Your HealthGuardian sign-in code'
      : 'Verify your HealthGuardian email'
  const text = `Your verification code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, you can ignore this message.`
  return sendMail({ to, subject, text })
}

module.exports = { sendMail, sendOtpEmail, createTransport }
