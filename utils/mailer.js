const nodemailer = require('nodemailer')

function cleanEnv(value) {
  return String(value || '').trim()
}

function cleanSmtpPassword(value, host) {
  const password = cleanEnv(value)

  // Google shows app passwords in four-character groups. SMTP auth expects the
  // 16 generated characters, so remove copied spacing for Gmail only.
  if (/gmail/i.test(host || '')) {
    return password.replace(/\s+/g, '')
  }

  return password
}

function explainMailError(err, host) {
  if (
    /gmail/i.test(host || '') &&
    (err.code === 'EAUTH' ||
      /535-5\.7\.8|BadCredentials|Username and Password not accepted/i.test(err.message || ''))
  ) {
    err.message = [
      'Gmail SMTP authentication failed.',
      'Use the Gmail address in SMTP_USER and a fresh 16-character Google App Password in SMTP_PASS.',
      'Do not use your normal Gmail password.',
    ].join(' ')
  }

  return err
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || process.env.CLIENT_URL || '')
    .trim()
    .replace(/\/+$/, '')
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createTransport() {
  const host = cleanEnv(process.env.SMTP_HOST)
  if (!host) return null

  const user = cleanEnv(process.env.SMTP_USER)
  const pass = cleanSmtpPassword(process.env.SMTP_PASS, host)

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: user && pass ? { user, pass } : undefined,
  })
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} [html]
 */
async function sendMail({ to, subject, text, html, suppressDevLog = false }) {
  const tx = createTransport()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@healthguardian.local'

  if (!tx) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service is not configured')
    }

    if (suppressDevLog) {
      console.log(`[mailer:dev] ${subject} email prepared for ${to}. Configure SMTP_* env vars to send it.`)
      return { skipped: true }
    }

    console.log('\n[mailer:dev] ─────────────────────────────────────')
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(text)
    console.log('[mailer:dev] ─────────────────────────────────────\n')
    return { skipped: true }
  }

  try {
    await tx.sendMail({ from, to, subject, text, html: html || text.replace(/\n/g, '<br/>') })
  } catch (err) {
    throw explainMailError(err, process.env.SMTP_HOST)
  }

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

async function sendPasswordResetEmail(to, resetUrl, expiresInMinutes = 15) {
  const subject = 'Reset your HealthGuardian password'
  const text = [
    'Hello,',
    '',
    'We received a request to reset your HealthGuardian password.',
    `Open this secure link to choose a new password: ${resetUrl}`,
    '',
    `This link expires in ${expiresInMinutes} minutes.`,
    'If you did not request this, you can safely ignore this email.',
    '',
    'HealthGuardian',
  ].join('\n')

  const html = [
    '<p>Hello,</p>',
    '<p>We received a request to reset your HealthGuardian password.</p>',
    `<p><a href="${resetUrl}">Reset your password</a></p>`,
    `<p>This link expires in ${expiresInMinutes} minutes.</p>`,
    '<p>If you did not request this, you can safely ignore this email.</p>',
    '<p>HealthGuardian</p>',
  ].join('')

  return sendMail({ to, subject, text, html, suppressDevLog: true })
}

async function sendDoctorApprovalEmail(doctor) {
  const to = doctor.email
  const name = doctor.name || 'Doctor'
  const frontendUrl = getFrontendUrl()
  const loginUrl = frontendUrl ? `${frontendUrl}/login` : ''
  const subject = 'Your HealthGuardian doctor request was approved'

  const text = [
    `Hello ${name},`,
    '',
    'Good news. Your request to join HealthGuardian as a doctor has been approved by the admin team.',
    'You can now sign in to your HealthGuardian account and access doctor features.',
    loginUrl ? `Sign in here: ${loginUrl}` : '',
    '',
    'Thank you for joining HealthGuardian.',
    '',
    'HealthGuardian',
  ].filter(Boolean).join('\n')

  const safeName = escapeHtml(name)
  const safeLoginUrl = escapeHtml(loginUrl)
  const html = [
    `<p>Hello ${safeName},</p>`,
    '<p>Good news. Your request to join HealthGuardian as a doctor has been approved by the admin team.</p>',
    '<p>You can now sign in to your HealthGuardian account and access doctor features.</p>',
    loginUrl ? `<p><a href="${safeLoginUrl}">Sign in to HealthGuardian</a></p>` : '',
    '<p>Thank you for joining HealthGuardian.</p>',
    '<p>HealthGuardian</p>',
  ].filter(Boolean).join('')

  return sendMail({ to, subject, text, html, suppressDevLog: true })
}

module.exports = {
  sendMail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendDoctorApprovalEmail,
  createTransport,
}
