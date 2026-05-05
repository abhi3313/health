const User = require('../models/User')
const AuditLog = require('../models/AuditLog')
const { createAndSendOtp, verifyAndConsumeOtp } = require('../utils/otpService')
const { sendToken } = require('./authController')

// ── POST /api/auth/otp/send ─────────────────────────────────
const requestOtp = async (req, res) => {
  const { email, purpose } = req.body

  if (purpose === 'login') {
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found for this email.' })
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended.' })
    }
  } else if (purpose === 'register') {
    const exists = await User.findOne({ email })
    if (exists) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' })
    }
  }

  await createAndSendOtp(email, purpose)
  res.json({ success: true, message: 'Verification code sent to your email.' })
}

// ── POST /api/auth/otp/login ────────────────────────────────
const loginWithOtp = async (req, res) => {
  const { email, code } = req.body

  const v = await verifyAndConsumeOtp(email, 'login', code)
  if (!v.ok) {
    return res.status(400).json({ success: false, message: v.message })
  }

  const user = await User.findOne({ email })
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' })
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'Your account has been suspended.' })
  }

  user.lastLogin  = new Date()
  user.loginCount = (user.loginCount || 0) + 1
  user.emailVerified = true
  await user.save({ validateBeforeSave: false })

  await AuditLog.create({
    user:      user._id,
    action:    'USER_LOGIN_OTP',
    resource:  'User',
    ip:        req.ip,
    userAgent: req.headers['user-agent'],
  })

  sendToken(res, user, 200, `Welcome back, ${user.name}!`)
}

module.exports = { requestOtp, loginWithOtp }
