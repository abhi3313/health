const crypto = require('crypto')
const { OAuth2Client } = require('google-auth-library')
const User     = require('../models/User')
const { verifyAndConsumeOtp } = require('../utils/otpService')
const { sendPasswordResetEmail } = require('../utils/mailer')
const { writeAuditLog } = require('../utils/audit')

const PASSWORD_RESET_EXPIRES_MINUTES = 15
const FORGOT_PASSWORD_MESSAGE = 'If this email exists, reset instructions have been sent.'
const GOOGLE_PASSWORD_RESET_MESSAGE = 'This account uses Google Sign-In. Please reset your password through your Google Account.'

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/+$/, '')
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function isGoogleOnlyAccount(user) {
  return user?.authProvider === 'google'
}

function getConfiguredGoogleClientIds() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.VITE_GOOGLE_CLIENT_ID,
    ...(process.env.GOOGLE_CLIENT_IDS || '').split(','),
  ]
    .map((x) => String(x || '').trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

// ── Helpers ────────────────────────────────────────────────
const sendToken = (res, user, statusCode, message) => {
  const token     = user.generateToken()
  const safeUser  = user.toSafeObject()

  return res.status(statusCode).json({
    success: true,
    message,
    data: { token, user: safeUser },
  })
}

// ── POST /api/auth/register ────────────────────────────────
const register = async (req, res) => {
  const {
    name, email, password, role = 'patient',
    phone, dateOfBirth, bloodGroup, gender,
    specialization, licenseNumber, hospital,
    otpCode,
  } = req.body

  const requireOtp = process.env.REQUIRE_REGISTER_OTP === 'true'
  if (requireOtp || otpCode) {
    if (!otpCode || String(otpCode).trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Enter the 6-digit email verification code.' })
    }
    const v = await verifyAndConsumeOtp(email, 'register', otpCode)
    if (!v.ok) {
      return res.status(400).json({ success: false, message: v.message })
    }
  }

  const allowedRoles = ['patient', 'doctor']
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role. Choose patient or doctor.' })
  }

  const existing = await User.findOne({ email })
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' })
  }

  // Validate dateOfBirth is not in the future
  if (dateOfBirth && new Date(dateOfBirth) > new Date()) {
    return res.status(400).json({ success: false, message: 'Date of birth cannot be in the future.' })
  }

  const user = await User.create({
    name, email, password, role, phone,
    dateOfBirth, bloodGroup, gender,
    specialization, licenseNumber, hospital,
    authProvider: 'local',
    isApproved: role === 'patient',
    emailVerified: !!(requireOtp || otpCode),
  })

  await writeAuditLog({
    user:     user._id,
    action:   'USER_REGISTERED',
    resource: 'User',
    details:  { role },
    ip:       req.ip,
  })

  if (role === 'doctor') {
    await writeAuditLog({
      user:       user._id,
      action:     'DOCTOR_AWAITING_APPROVAL',
      resource:   'User',
      resourceId: user._id,
      details:    { name: user.name, email: user.email, specialization: user.specialization, licenseNumber: user.licenseNumber },
      ip:         req.ip,
    })
  }

  sendToken(res, user, 201, 'Account created successfully!')
}

// ── POST /api/auth/login ───────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' })
  }

  const user = await User.findOne({ email }).select('+password')
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' })
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact admin.' })
  }

  // Update last login
  user.lastLogin  = new Date()
  user.loginCount = (user.loginCount || 0) + 1
  await user.save({ validateBeforeSave: false })

  await writeAuditLog({
    user:     user._id,
    action:   'USER_LOGIN',
    resource: 'User',
    ip:       req.ip,
    userAgent:req.headers['user-agent'],
  })

  sendToken(res, user, 200, `Welcome back, ${user.name}!`)
}

// ── GET /api/auth/me ───────────────────────────────────────
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
  res.json({ success: true, message: 'User fetched successfully', data: { user: user.toSafeObject() } })
}

// Fields users may change on their own profile (everything else is ignored)
const ALLOWED_PROFILE_KEYS = new Set([
  'name', 'phone', 'avatar', 'address',
  'dateOfBirth', 'bloodGroup', 'gender',
  'emergencyContact', 'allergies', 'chronicConditions',
  'importantMedicalConditions', 'emergencyNotes',
  'specialization', 'licenseNumber', 'hospital', 'experience', 'qualifications', 'consultationFee',
])

// ── PUT /api/auth/me ───────────────────────────────────────
const updateMe = async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  for (const key of Object.keys(body)) {
    if (!ALLOWED_PROFILE_KEYS.has(key)) continue
    user.set(key, body[key])
  }

  // Validate dateOfBirth is not in the future
  if (body.dateOfBirth && new Date(body.dateOfBirth) > new Date()) {
    return res.status(400).json({ success: false, message: 'Date of birth cannot be in the future.' })
  }

  await user.save({ validateBeforeSave: true })
  res.json({ success: true, message: 'Profile updated successfully', data: { user: user.toSafeObject() } })
}

// ── PUT /api/auth/change-password ─────────────────────────
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' })
  }

  const user = await User.findById(req.user._id).select('+password')
  if (!(await user.matchPassword(currentPassword))) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' })
  }

  user.password = newPassword
  await user.save()

  sendToken(res, user, 200, 'Password changed successfully!')
}

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim()

  const user = await User.findOne({ email })
  if (!user) {
    return res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE })
  }

  if (isGoogleOnlyAccount(user)) {
    return res.status(200).json({ success: true, message: GOOGLE_PASSWORD_RESET_MESSAGE })
  }

  const resetToken = crypto.randomBytes(32).toString('hex')
  user.resetPasswordToken = hashResetToken(resetToken)
  user.resetPasswordExpire = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000)
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  await user.save({ validateBeforeSave: false })

  const resetUrl = `${getFrontendUrl()}/reset-password/${resetToken}`

  try {
    await sendPasswordResetEmail(user.email, resetUrl, PASSWORD_RESET_EXPIRES_MINUTES)
  } catch (err) {
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined
    await user.save({ validateBeforeSave: false })

    if (process.env.NODE_ENV === 'development') {
      console.error('Password reset email failed:', err.message)
    }

    return res.status(500).json({
      success: false,
      message: 'Could not send reset instructions right now. Please try again later.',
    })
  }

  return res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE })
}

// PUT /api/auth/reset-password/:token
const resetPassword = async (req, res) => {
  const token = String(req.params.token || '').trim()
  const { password, confirmPassword } = req.body

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' })
  }

  const resetPasswordToken = hashResetToken(token)
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+password')

  if (!user) {
    return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' })
  }

  if (isGoogleOnlyAccount(user)) {
    return res.status(400).json({ success: false, message: GOOGLE_PASSWORD_RESET_MESSAGE })
  }

  user.password = password
  user.resetPasswordToken = undefined
  user.resetPasswordExpire = undefined
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  await user.save()

  return res.status(200).json({ success: true, message: 'Password reset successfully. You can now sign in.' })
}

// ── POST /api/auth/logout ──────────────────────────────────
const logout = async (req, res) => {
  await writeAuditLog({ user: req.user._id, action: 'USER_LOGOUT', resource: 'User', ip: req.ip })
  res.json({ success: true, message: 'Logged out successfully', data: null })
}

// ── POST /api/auth/google (Google ID token from frontend GIS) ─
const googleAuth = async (req, res) => {
  const { idToken } = req.body
  if (!idToken) {
    return res.status(400).json({ success: false, message: 'Google credential is required.' })
  }
  const configuredClientIds = getConfiguredGoogleClientIds()

  if (!configuredClientIds.length) {
    return res.status(503).json({ success: false, message: 'Google sign-in is not configured on this server.' })
  }

  const client = new OAuth2Client()
  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: configuredClientIds })
    payload = ticket.getPayload()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired Google sign-in.' })
  }

  const sub   = payload.sub
  const email = (payload.email || '').toLowerCase()
  if (!email) {
    return res.status(400).json({ success: false, message: 'Google did not provide an email for this account.' })
  }
  if (payload.email_verified !== true) {
    return res.status(401).json({ success: false, message: 'Google account email is not verified.' })
  }

  let user = await User.findOne({ $or: [{ googleId: sub }, { email }] })

  if (!user) {
    user = await User.create({
      name:          payload.name || email.split('@')[0],
      email,
      password:      crypto.randomBytes(32).toString('hex'),
      googleId:      sub,
      oauthProvider: 'google',
      authProvider:  'google',
      role:          'patient',
      isApproved:    true,
      emailVerified: true,
      avatar:        payload.picture || '',
      lastLogin:     new Date(),
      loginCount:    1,
    })

    await writeAuditLog({
      user:     user._id,
      action:   'USER_REGISTERED_OAUTH',
      resource: 'User',
      details:  { provider: 'google' },
      ip:       req.ip,
    })
  } else {
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact admin.' })
    }
    if (!user.googleId) {
      user.googleId = sub
      user.oauthProvider = 'google'
    }
    if (payload.picture && !user.avatar) user.avatar = payload.picture
    user.emailVerified = true
    user.lastLogin     = new Date()
    user.loginCount    = (user.loginCount || 0) + 1
    await user.save({ validateBeforeSave: true })

    await writeAuditLog({
      user:      user._id,
      action:    'USER_LOGIN_OAUTH',
      resource:  'User',
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
    })
  }

  sendToken(res, user, 200, `Welcome back, ${user.name}!`)
}

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
  googleAuth,
  sendToken,
}
