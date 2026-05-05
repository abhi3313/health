const bcrypt = require('bcryptjs')
const OtpCode = require('../models/OtpCode')
const { sendOtpEmail } = require('./mailer')

const TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

function generateSixDigit() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Replace any existing OTP for this email+purpose, store new code, send email.
 */
async function createAndSendOtp(email, purpose) {
  await OtpCode.deleteMany({ email, purpose })
  const code = generateSixDigit()
  const codeHash = await bcrypt.hash(code, 8)
  await OtpCode.create({
    email,
    purpose,
    codeHash,
    expiresAt: new Date(Date.now() + TTL_MS),
  })
  await sendOtpEmail(email, code, purpose)
}

/**
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
async function verifyAndConsumeOtp(email, purpose, rawCode) {
  if (!rawCode || String(rawCode).trim().length < 6) {
    return { ok: false, message: 'Enter the 6-digit code.' }
  }
  const row = await OtpCode.findOne({ email, purpose }).sort({ createdAt: -1 })
  if (!row || new Date() > row.expiresAt) {
    return { ok: false, message: 'Invalid or expired code. Request a new one.' }
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, message: 'Too many attempts. Request a new code.' }
  }
  const match = await bcrypt.compare(String(rawCode).trim(), row.codeHash)
  if (!match) {
    row.attempts += 1
    await row.save()
    return { ok: false, message: 'Invalid code.' }
  }
  await OtpCode.deleteMany({ email, purpose })
  return { ok: true }
}

module.exports = { createAndSendOtp, verifyAndConsumeOtp, TTL_MS, MAX_ATTEMPTS }
