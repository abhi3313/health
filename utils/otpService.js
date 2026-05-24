const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const OtpCode = require('../models/OtpCode')
const { sendOtpEmail } = require('./mailer')

const TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const VALID_PURPOSES = new Set(['login', 'register'])

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function generateSixDigit() {
  return String(crypto.randomInt(100000, 1000000))
}

function normalizePurpose(purpose) {
  const value = String(purpose || '').trim().toLowerCase()
  if (!VALID_PURPOSES.has(value)) {
    throw new Error('Invalid OTP purpose')
  }
  return value
}

/**
 * Replace any existing OTP for this email+purpose, store new code, send email.
 */
async function createAndSendOtp(email, purpose) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedPurpose = normalizePurpose(purpose)

  await OtpCode.deleteMany({
    $or: [
      { email: normalizedEmail, purpose: normalizedPurpose },
      { expiresAt: { $lte: new Date() } },
    ],
  })

  const code = generateSixDigit()
  const codeHash = await bcrypt.hash(code, 8)
  const row = await OtpCode.create({
    email: normalizedEmail,
    purpose: normalizedPurpose,
    codeHash,
    expiresAt: new Date(Date.now() + TTL_MS),
  })

  try {
    await sendOtpEmail(normalizedEmail, code, normalizedPurpose)
  } catch (err) {
    await OtpCode.deleteOne({ _id: row._id })
    throw err
  }
}

/**
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
async function verifyAndConsumeOtp(email, purpose, rawCode) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedPurpose = normalizePurpose(purpose)
  const code = String(rawCode || '').trim()

  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: 'Enter the 6-digit code.' }
  }
  const row = await OtpCode.findOne({ email: normalizedEmail, purpose: normalizedPurpose }).sort({ createdAt: -1 })
  if (!row || new Date() > row.expiresAt) {
    if (row) await OtpCode.deleteOne({ _id: row._id })
    return { ok: false, message: 'Invalid or expired code. Request a new one.' }
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await OtpCode.deleteOne({ _id: row._id })
    return { ok: false, message: 'Too many attempts. Request a new code.' }
  }
  const match = await bcrypt.compare(code, row.codeHash)
  if (!match) {
    row.attempts += 1
    await row.save()
    return { ok: false, message: 'Invalid code.' }
  }
  await OtpCode.deleteMany({ email: normalizedEmail, purpose: normalizedPurpose })
  return { ok: true }
}

module.exports = { createAndSendOtp, verifyAndConsumeOtp, TTL_MS, MAX_ATTEMPTS }
